import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { trpc } from "./lib/trpc";


// Debug logging
console.log('🚀 Initializing tRPC client...');
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated") {
    if (event.action.type === "error") {
      const error = event.query.state.error;
      redirectToLoginIfUnauthorized(error);
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated") {
    if (event.action.type === "error") {
      const error = event.mutation.state.error;
      redirectToLoginIfUnauthorized(error);
      console.error("[API Mutation Error]", error);
    } else if (event.action.type === "success") {
      console.log("[API Mutation Success]", event.mutation.state.data);
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          signal: controller.signal,
        }).then(async (r) => {
          clearTimeout(timeoutId);
          console.log('🟢 tRPC response status:', r.status);
          if (!r.ok) {
            const text = await r.text();
            console.error('🔴 tRPC error response:', r.status, text.substring(0, 500));
          }
          return r;
        }).catch(e => {
          clearTimeout(timeoutId);
          console.error('🔴 tRPC fetch error:', e.message || String(e));
          throw e;
        });
      },
    }),
  ],
});

console.log('🚀 Rendering React app...');

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

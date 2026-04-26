import "dotenv/config";
// Default to development so scripts work on Windows without cross-env
if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import net from "net";
import os from "os";
import selfsigned from "selfsigned";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ocrRouter } from "../routes/ocr";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/** Get this machine's local IPv4 address (e.g. 192.168.1.16) for same-WiFi access */
function getLocalIPv4(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const config of iface) {
      if (config.family === "IPv4" && !config.internal) return config.address;
    }
  }
  return null;
}

/** Generate a self-signed cert for localhost + local IP so HTTPS works from phone (camera needs secure context) */
function getDevHttpsCert(): { key: string; cert: string } {
  const localIp = getLocalIPv4();
  const altNames: Array<{ type: number; value?: string; ip?: string }> = [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
  ];
  if (localIp) altNames.push({ type: 7, ip: localIp });
  const attrs = [{ name: "commonName", value: "localhost" }];
  const options = {
    days: 365,
    keySize: 2048,
    extensions: [
      { name: "basicConstraints", cA: true },
      { name: "keyUsage", keyCertSign: true, digitalSignature: true, keyEncipherment: true },
      { name: "subjectAltName", altNames },
    ],
  };
  const pems = selfsigned.generate(attrs, options);
  return { key: pems.private, cert: pems.cert };
}

async function startServer() {
  const app = express();
  const useHttps = process.env.NODE_ENV === "development";
  const server = useHttps
    ? createHttpsServer(getDevHttpsCert(), app)
    : createHttpServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // REST API routes
  app.use("/api/ocr", ocrRouter);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    console.log('🔧 Development mode - using Vite');
    await setupVite(app, server);
  } else {
    console.log('📦 Production mode - using static files');
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Listen on all interfaces so you can open the app from your phone on the same Wi-Fi
  const protocol = useHttps ? "https" : "http";
  server.listen(port, "0.0.0.0", () => {
    const localIp = getLocalIPv4();
    const appUrl = `${protocol}://${localIp ?? "<your-pc-ip>"}:${port}/`;
    console.log(`🚀 Server running on ${protocol}://localhost:${port}/`);
    console.log(`📱 App on your phone (same Wi-Fi, use HTTPS for camera): ${appUrl}`);
    if (useHttps) console.log(`   (Accept the certificate warning on your phone to allow camera)`);
    if (!localIp) console.log(`   (Find PC IP: run "ipconfig" on Windows, "ifconfig" on Mac/Linux)`);
    console.log(`📡 REST API: ${protocol}://localhost:${port}/api/ocr/recognize`);
    console.log(`🔄 tRPC API: ${protocol}://localhost:${port}/api/trpc`);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

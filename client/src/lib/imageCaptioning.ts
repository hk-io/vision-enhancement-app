/**
 * Image captioning using Transformers.js (image-to-text).
 * Describes the scene for accessibility (e.g. read aloud to user).
 *
 * In the browser, Transformers.js defaults to trying `/models/` on the same origin first.
 * Our Express+Vite dev server serves `index.html` for unknown paths, so those fetches return
 * HTML → JSON parse error. Force remote-only loading from Hugging Face.
 */
import { env, pipeline } from "@xenova/transformers";

/** Never use `/models/` on this origin — dev server returns index.html and it gets cached as JSON. */
env.allowLocalModels = false;
env.allowRemoteModels = true;

type ImageInput = HTMLImageElement | HTMLCanvasElement | string;
type CaptionPipeline = (image: ImageInput, options?: { max_new_tokens?: number }) => Promise<unknown>;

let captionPipeline: CaptionPipeline | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;
let purgedStaleCache = false;

/** Old sessions cached HTML (SPA fallback) under transformers-cache; purge once so HF JSON loads. */
async function purgeStaleTransformersCacheOnce(): Promise<void> {
  if (purgedStaleCache) return;
  purgedStaleCache = true;
  if (typeof caches === "undefined") return;
  try {
    await caches.delete("transformers-cache");
    console.log("[Caption] Cleared stale transformers browser cache (dev server fix).");
  } catch {
    /* ignore */
  }
}

export async function loadCaptionModel(): Promise<void> {
  if (captionPipeline) return;
  if (isLoading && loadPromise) return loadPromise;

  loadPromise = (async () => {
    isLoading = true;
    try {
      await purgeStaleTransformersCacheOnce();
      console.log("Loading image captioning model...");
      captionPipeline = (await pipeline("image-to-text", "Xenova/vit-gpt2-image-captioning", {
        progress_callback: (p: { progress?: number }) => {
          const raw = p.progress;
          if (raw == null || Number.isNaN(raw)) return;
          // Hub sends 0–1; some callbacks send 0–100 already — avoid "3923%" in console
          const pct = raw > 1 ? Math.round(raw) : Math.round(raw * 100);
          console.log("Caption model download:", Math.min(100, pct) + "%");
        },
      })) as unknown as CaptionPipeline;
      console.log("Image captioning model loaded");
    } catch (e) {
      console.error("Image captioning model failed to load:", e);
      captionPipeline = null;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export function isCaptionModelReady(): boolean {
  return captionPipeline !== null;
}

/**
 * Max time for load + caption (first run downloads ~hundreds of MB from Hugging Face).
 * 10 min is reasonable on slow Wi‑Fi; inference alone is usually &lt; 30s after load.
 */
export const CAPTION_TOTAL_TIMEOUT_MS = 600_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/**
 * Same as captionImage but fails if the whole operation (model load + inference) exceeds `timeoutMs`.
 */
export async function captionImageWithTimeout(
  image: ImageInput,
  timeoutMs: number = CAPTION_TOTAL_TIMEOUT_MS
): Promise<string> {
  const msg = `Describe timed out after ${Math.round(timeoutMs / 60_000)} minutes. Try again on a better connection, or wait — the first run downloads a large model.`;
  return withTimeout(captionImage(image), timeoutMs, msg);
}

/**
 * Generate a short caption for the image. Use after loadCaptionModel().
 * @param image - canvas, img element, or image URL (data URL or http)
 */
export async function captionImage(image: ImageInput): Promise<string> {
  await loadCaptionModel();
  if (!captionPipeline) throw new Error("Caption model not loaded");

  try {
    const out = await captionPipeline(image, { max_new_tokens: 50 });
    const arr = Array.isArray(out) ? out : [out];
    const first = arr[0];
    const text =
      first && typeof first === "object" && "generated_text" in first
        ? String((first as { generated_text: string }).generated_text).trim()
        : "";
    if (text) console.log("Caption result:", text);
    return text || "I can't describe this image.";
  } catch (e) {
    console.error("Caption error:", e);
    throw e;
  }
}

import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

import { captionImageWithTimeout } from "./imageCaptioning";

type ImageInput = HTMLCanvasElement | HTMLImageElement | string;
const SCENE_MAX_EDGE = 1280;
const SCENE_VLM_MAX_EDGE = 960;
const SMOL_TIMEOUT_MS = 45_000;

let cocoModel: cocoSsd.ObjectDetection | null = null;
let cocoLoadPromise: Promise<cocoSsd.ObjectDetection> | null = null;
let smolProcessor: any = null;
let smolModel: any = null;
let smolLoadPromise: Promise<boolean> | null = null;

async function loadCocoModel(): Promise<cocoSsd.ObjectDetection> {
  if (cocoModel) return cocoModel;
  if (cocoLoadPromise) return cocoLoadPromise;
  cocoLoadPromise = (async () => {
    await tf.ready();
    const m = await cocoSsd.load();
    cocoModel = m;
    return m;
  })();
  return cocoLoadPromise;
}

async function toCanvas(image: ImageInput): Promise<HTMLCanvasElement> {
  if (image instanceof HTMLCanvasElement) return image;
  if (typeof image === "string") {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Failed to load image"));
      i.src = image;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No canvas context");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  const c = document.createElement("canvas");
  c.width = image.naturalWidth || image.width;
  c.height = image.naturalHeight || image.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No canvas context");
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return c;
}

function resizeCanvasToMaxEdge(source: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return source;
  const scale = maxEdge / longEdge;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * scale));
  out.height = Math.max(1, Math.round(h * scale));
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function buildPrompt(objectHints: string[]): string {
  const unique = Array.from(new Set(objectHints.map((s) => s.trim()).filter(Boolean)));
  const top = unique.slice(0, 8);
  const hint = top.length ? `Objects I see: ${top.join(", ")}.` : "Objects I see: (none detected).";
  return (
    `${hint}\n` +
    "Write a natural, human-friendly scene description for a visually impaired user in 6-10 sentences. " +
    "Start with the overall setting, then describe the most important objects and where they are. " +
    "Focus on practical details a person would care about (what is present, where it is, and what stands out). " +
    "Use plain language, avoid repetition, and avoid meta/model phrases like 'detected objects' or 'the scene appears'. " +
    "If something is unclear, mention it briefly once and continue with useful details."
  );
}

async function loadSmolVlm(): Promise<boolean> {
  if (smolProcessor && smolModel) return true;
  if (smolLoadPromise) return smolLoadPromise;
  smolLoadPromise = (async () => {
    try {
      const t: any = await import("@xenova/transformers");
      const AutoProcessor = t.AutoProcessor;
      const AutoModelForVision2Seq = t.AutoModelForVision2Seq;
      if (!AutoProcessor || !AutoModelForVision2Seq) return false;

      const modelId = "HuggingFaceTB/SmolVLM-256M-Instruct";
      const [processor, model] = await Promise.all([
        AutoProcessor.from_pretrained(modelId),
        AutoModelForVision2Seq.from_pretrained(modelId, {
          device: (t.env && (t.env.backends?.webgpu ? "webgpu" : undefined)) ?? undefined,
        }),
      ]);
      smolProcessor = processor;
      smolModel = model;
      return true;
    } catch {
      smolProcessor = null;
      smolModel = null;
      return false;
    }
  })();
  return smolLoadPromise;
}

function isLowMemoryDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = Number(nav.deviceMemory ?? 0);
  return Number.isFinite(mem) && mem > 0 && mem <= 4;
}

function summarizeDetections(preds: any[]): string {
  if (!preds.length) return "";
  const counts = new Map<string, number>();
  for (const p of preds) {
    const k = String(p?.class || "").toLowerCase().trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (!top.length) return "";
  return top.map(([name, count]) => (count > 1 ? `${count} ${name}s` : name)).join(", ");
}

function buildFallbackNarrative(caption: string, preds: any[]): string {
  const cleanCaption = String(caption || "").replace(/\s+/g, " ").trim();
  const detectedSummary = summarizeDetections(preds);
  const parts: string[] = [];
  if (cleanCaption) parts.push(cleanCaption.charAt(0).toUpperCase() + cleanCaption.slice(1));
  if (detectedSummary) parts.push(`You can see ${detectedSummary}.`);
  if (preds.length > 0) {
    const top = [...preds]
      .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
      .slice(0, 3)
      .map((p) => String(p?.class || "").toLowerCase())
      .filter(Boolean);
    if (top.length) {
      parts.push(`The most noticeable items are ${top.join(", ")}.`);
    }
  }
  let base = parts.join(" ").trim() || "The image shows an indoor scene with limited visible detail.";
  base = base
    .replace(/\b(the scene appears|detected objects?|most prominent items appear to be)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (base.split(/\s+/).length >= 70) return dedupeSentences(base);
  const extra = [
    "The space has a clear foreground and background, so object positions are fairly easy to follow.",
    "Some fine details are still hard to confirm from this view, but the main layout and key objects are visible.",
  ].join(" ");
  return dedupeSentences(`${base} ${extra}`.trim());
}

function dedupeSentences(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    const key = s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.join(" ");
}

function ensureLongDescription(text: string, preds: any[]): string {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\b(detected objects?|the scene appears|most prominent items appear to be)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!normalized) return buildFallbackNarrative("", preds);
  // If text is already reasonably complete, keep it (after de-duplication) instead of forcing template expansion.
  if (normalized.split(/[.!?]\s+/).length >= 4) return dedupeSentences(normalized);
  const words = normalized.split(/\s+/).filter(Boolean).length;
  if (words >= 90) return dedupeSentences(normalized);
  // If model output is too short, enrich with object-driven context.
  return dedupeSentences(buildFallbackNarrative(normalized, preds));
}

async function tryDescribeWithSmolVLM(canvas: HTMLCanvasElement, prompt: string): Promise<string | null> {
  try {
    const ok = await loadSmolVlm();
    if (!ok || !smolProcessor || !smolModel) return null;

    const run = async () => {
      const inputs = await smolProcessor(canvas, prompt, { return_tensors: "pt" });
      const out = await smolModel.generate({
        ...inputs,
        max_new_tokens: 240,
        temperature: 0.15,
        top_p: 0.9,
      });
      const decoded = await smolProcessor.batch_decode(out, { skip_special_tokens: true });
      const text = Array.isArray(decoded) ? String(decoded[0] ?? "").trim() : String(decoded ?? "").trim();
      return text || null;
    };

    const text = await Promise.race<string | null>([
      run(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SMOL_TIMEOUT_MS)),
    ]);
    return text;
  } catch {
    return null;
  }
}

export async function warmupDescribeSceneModels(): Promise<void> {
  // Warm only lightweight models in background; avoid heavy VLM preloads on mobile.
  void loadCocoModel().catch(() => {});
}

export async function describeScene(image: ImageInput): Promise<{ text: string; objects: string[]; used: "smolvlm" | "caption-fallback" }> {
  const sourceCanvas = await toCanvas(image);
  const sceneCanvas = resizeCanvasToMaxEdge(sourceCanvas, SCENE_MAX_EDGE);
  const vlmCanvas = resizeCanvasToMaxEdge(sceneCanvas, SCENE_VLM_MAX_EDGE);

  let objects: string[] = [];
  let preds: any[] = [];
  try {
    const model = await loadCocoModel();
    preds = await model.detect(sceneCanvas as any);
    objects = preds
      .filter((p) => (p?.score ?? 0) >= 0.5)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((p) => String(p.class || "").toLowerCase())
      .filter(Boolean);
  } catch {
    objects = [];
    preds = [];
  }

  const prompt = buildPrompt(objects);

  const safeToUseSmol = Math.max(vlmCanvas.width, vlmCanvas.height) <= SCENE_VLM_MAX_EDGE;

  if (safeToUseSmol) {
    const smol = await tryDescribeWithSmolVLM(vlmCanvas, prompt);
    if (smol) {
      return { text: ensureLongDescription(smol, preds), objects, used: "smolvlm" };
    }
  }

  // Fallback: existing caption model, plus object hints prepended so it's less generic.
  // Transformers.js caption pipeline can be picky about accepted image types.
  // Passing a canvas may throw "Unsupported input type: object" on some builds.
  // Converting to a data URL ensures the pipeline gets a supported input type.
  const captionInputUrl = sceneCanvas.toDataURL("image/jpeg", 0.88);
  try {
    const caption = await captionImageWithTimeout(captionInputUrl);
    return { text: ensureLongDescription(buildFallbackNarrative(caption, preds), preds), objects, used: "caption-fallback" };
  } catch {
    // Final safety fallback: still return useful text without crashing.
    return { text: ensureLongDescription(buildFallbackNarrative("", preds), preds), objects, used: "caption-fallback" };
  }
}


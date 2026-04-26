/**
 * Zero-DCE++ model loader + canvas inference.
 * Uses letterboxing into the fixed model size (no non-uniform stretch) so faces and geometry
 * match the paper setup more closely than squashing the full image to 300×200.
 */

import * as tf from "@tensorflow/tfjs";

let zeroDCEModel: tf.GraphModel | null = null;

export function getZeroDCEModel(): tf.GraphModel | null {
  return zeroDCEModel;
}

/** Model expects fixed input shape [batch, height=200, width=300, 3] */
export const ZERO_DCE_INPUT_HEIGHT = 200;
export const ZERO_DCE_INPUT_WIDTH = 300;

const IN_H = ZERO_DCE_INPUT_HEIGHT;
const IN_W = ZERO_DCE_INPUT_WIDTH;

// The converted TF graph has 2 output nodes.
// In this exported graph, output index 0 is the final enhanced RGB image.
// (If we pick the other head, the image may clip to black.)
const DCE_RGB_OUTPUT_INDEX = 0;
// Reduce highlight saturation a bit (0-1). Helps prevent faces from washing out.
const ZERO_DCE_CLIP_MAX = 0.98;

/**
 * Run Zero-DCE++ in-place on RGBA canvas (RGB channels). Fails if model not loaded.
 */
export async function runZeroDceOnCanvas(canvas: HTMLCanvasElement): Promise<boolean> {
  const model = getZeroDCEModel();
  if (!model) return false;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  const w = canvas.width;
  const h = canvas.height;
  if (w < 1 || h < 1) return false;

  // Use "cover" crop (no black padding) so the network sees the photo content,
  // not extra padded black pixels that can shift brightness/histograms.
  const scaleCover = Math.max(IN_W / w, IN_H / h);
  const rw = Math.max(1, Math.round(w * scaleCover));
  const rh = Math.max(1, Math.round(h * scaleCover));
  const cropXOnCover = Math.floor((rw - IN_W) / 2);
  const cropYOnCover = Math.floor((rh - IN_H) / 2);

  const coverCanvas = document.createElement("canvas");
  coverCanvas.width = rw;
  coverCanvas.height = rh;
  const coverCtx = coverCanvas.getContext("2d", { willReadFrequently: true });
  if (!coverCtx) return false;
  coverCtx.drawImage(canvas, 0, 0, w, h, 0, 0, rw, rh);

  // PadCanvas is the actual model input: center-cropped to exactly 300x200.
  const padCanvas = document.createElement("canvas");
  padCanvas.width = IN_W;
  padCanvas.height = IN_H;
  const pctx = padCanvas.getContext("2d", { willReadFrequently: true });
  if (!pctx) return false;
  pctx.drawImage(coverCanvas, cropXOnCover, cropYOnCover, IN_W, IN_H, 0, 0, IN_W, IN_H);

  let tensor: tf.Tensor4D | null = null;
  let enhancedTensor: tf.Tensor | null = null;
  let enhancedSqueezed: tf.Tensor3D | null = null;
  let clipped: tf.Tensor3D | null = null;
  const predictOutputs: tf.Tensor[] = [];

  const padOut = document.createElement("canvas");
  padOut.width = IN_W;
  padOut.height = IN_H;

  try {
    tensor = tf.browser.fromPixels(padCanvas).div(255.0).expandDims(0) as tf.Tensor4D;

    const rawOut = model.predict(tensor) as tf.Tensor | tf.Tensor[];

    if (Array.isArray(rawOut)) {
      const idx = Math.min(DCE_RGB_OUTPUT_INDEX, rawOut.length - 1);
      enhancedTensor = rawOut[idx];
      rawOut.forEach((t, i) => {
        if (i !== idx) predictOutputs.push(t);
      });
    } else {
      enhancedTensor = rawOut;
    }

    if (!enhancedTensor) return false;

    enhancedSqueezed = enhancedTensor.squeeze() as tf.Tensor3D;
    clipped = tf.clipByValue(enhancedSqueezed, 0, ZERO_DCE_CLIP_MAX);

    await tf.browser.toPixels(clipped, padOut);

    // Paste enhanced crop back onto the scaled cover canvas,
    // then crop center back to the original size.
    const enhancedCover = document.createElement("canvas");
    enhancedCover.width = rw;
    enhancedCover.height = rh;
    const ectx = enhancedCover.getContext("2d", { willReadFrequently: true });
    if (!ectx) return false;

    // Start from the original cover (so we don't lose edges outside the model crop).
    ectx.drawImage(coverCanvas, 0, 0);
    // Overwrite the crop region with the model output.
    ectx.drawImage(padOut, 0, 0, IN_W, IN_H, cropXOnCover, cropYOnCover, IN_W, IN_H);

    const cropXOnOriginal = Math.floor((rw - w) / 2);
    const cropYOnOriginal = Math.floor((rh - h) / 2);

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(enhancedCover, cropXOnOriginal, cropYOnOriginal, w, h, 0, 0, w, h);

    return true;
  } catch (e) {
    console.error("Zero-DCE++ on canvas failed:", e);
    return false;
  } finally {
    clipped?.dispose();
    enhancedSqueezed?.dispose();
    enhancedTensor?.dispose();
    predictOutputs.forEach((t) => t.dispose());
    tensor?.dispose();
  }
}

export async function loadZeroDCEModel(): Promise<void> {
  try {
    console.log("Loading Zero-DCE++ model...");
    zeroDCEModel = await tf.loadGraphModel("/models/zero-dce/model.json");

    const warmup = tf.zeros([1, ZERO_DCE_INPUT_HEIGHT, ZERO_DCE_INPUT_WIDTH, 3]);
    const warmupResult = zeroDCEModel.predict(warmup);
    if (Array.isArray(warmupResult)) {
      warmupResult.forEach((t) => t.dispose());
    } else if (warmupResult && typeof (warmupResult as tf.Tensor).dispose === "function") {
      (warmupResult as tf.Tensor).dispose();
    }
    warmup.dispose();

    console.log("Zero-DCE++ model loaded and warmed up");
  } catch (e) {
    console.error("Zero-DCE++ model failed to load:", e);
    zeroDCEModel = null;
  }
}

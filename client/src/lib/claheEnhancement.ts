/**
 * Vision enhancement pipeline: one combined feature (LOW / MEDIUM / HIGH).
 * Branch by mean L: BRIGHT (≥70) unsharp L only; DIM (≥30) CLAHE + unsharp L; DARK (<30) CLAHE + milder unsharp L + Retinex.
 * User can override branch via enhancementMode (auto | bright | dim | dark) for preference/accessibility.
 */

import { applyRetinex } from "./retinexWebGL";

export type ContrastLevel = "low" | "medium" | "high";
/** @deprecated Use ContrastLevel */
export type EnhancementLevel = ContrastLevel;

export type EnhancementMode = "auto" | "bright" | "dim" | "dark";

const BRIGHT_THRESHOLD = 70;
const DIM_MIN = 30;

/** Dark frames are noisy; scale unsharp below dim so CLAHE+Retinex stays usable without excess grain. */
const DARK_UNSHARP_SIGMA_MULT = 0.85;
const DARK_UNSHARP_AMOUNT_MULT = 0.65;

const settings: Record<
  ContrastLevel,
  { clip: number; tileSize: number; sigma: number; sharpAmount: number; retinexStrength: number }
> = {
  low:    { clip: 2.0, tileSize: 8, sigma: 1.5, sharpAmount: 2.5, retinexStrength: 0.3 },
  medium: { clip: 3.0, tileSize: 8, sigma: 2.0, sharpAmount: 3.5, retinexStrength: 0.6 },
  high:   { clip: 4.0, tileSize: 8, sigma: 3.0, sharpAmount: 5.0, retinexStrength: 0.9 },
};

let _lastPipelineLog = 0;
/** Last pipeline result — read by overlay to show mode and brightness on screen */
export let lastPipelineInfo: { branch: "bright" | "dim" | "dark"; meanL: number } = { branch: "bright", meanL: 0 };

function pipelineLog(branch: "bright" | "dim" | "dark", meanL: number, level: ContrastLevel, forced: boolean): void {
  lastPipelineInfo = { branch, meanL };
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  if (now - _lastPipelineLog < 1000) return;
  _lastPipelineLog = now;
  const src = forced ? " (user override)" : "";
  console.log(
    `[Pipeline] ${branch.toUpperCase()} (mean L=${Math.round(meanL)}) level=${level}${src} | ` +
    (branch === "bright"
      ? "unsharp L only"
      : branch === "dim"
        ? "CLAHE+unsharp L"
        : "CLAHE+unsharp L+Retinex")
  );
}

function applyUnsharpMask(cv: any, channels: any, sigma: number, sharpAmount: number): void {
  const lBlurred = new cv.Mat();
  cv.GaussianBlur(channels.get(0), lBlurred, new cv.Size(0, 0), sigma);
  cv.addWeighted(
    channels.get(0),
    sharpAmount,
    lBlurred,
    -(sharpAmount - 1.0),
    0,
    channels.get(0)
  );
  lBlurred.delete();
}

function applyCLAHEToChannels(cv: any, channels: any, clip: number, tileSize: number): void {
  const clahe = new cv.CLAHE(clip, new cv.Size(tileSize, tileSize));
  clahe.apply(channels.get(0), channels.get(0));
  clahe.delete();
}

function writeLabToCanvas(
  cv: any,
  labMat: any,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): void {
  const dst = new cv.Mat();
  cv.cvtColor(labMat, dst, cv.COLOR_Lab2RGB);
  const w = canvas.width;
  const h = canvas.height;
  const outputData = new Uint8ClampedArray(w * h * 4);
  const dstData = dst.data;
  for (let i = 0; i < w * h; i++) {
    outputData[i * 4]     = dstData[i * 3];
    outputData[i * 4 + 1] = dstData[i * 3 + 1];
    outputData[i * 4 + 2] = dstData[i * 3 + 2];
    outputData[i * 4 + 3] = 255;
  }
  ctx.putImageData(new ImageData(outputData, w, h), 0, 0);
  dst.delete();
}

export function applyCLAHE(
  cv: any,
  videoElement: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  level: ContrastLevel,
  options?: { mode?: EnhancementMode; processScale?: number }
): void {
  const processScale = Math.min(1, Math.max(0.25, options?.processScale ?? 1));
  const useHalfRes = processScale < 1;
  const processW = Math.max(1, Math.floor(canvas.width * processScale));
  const processH = Math.max(1, Math.floor(canvas.height * processScale));

  const processCanvas = useHalfRes
    ? Object.assign(document.createElement("canvas"), { width: processW, height: processH })
    : canvas;
  const ctx = processCanvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(videoElement, 0, 0, processCanvas.width, processCanvas.height);

  let src = cv.imread(processCanvas);
  let rgbMat = new cv.Mat();
  let labMat = new cv.Mat();
  let channels = new cv.MatVector();

  try {
    cv.cvtColor(src, rgbMat, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgbMat, labMat, cv.COLOR_RGB2Lab);
    cv.split(labMat, channels);

    const L = channels.get(0);
    let sum = 0;
    const len = L.rows * L.cols;
    for (let i = 0; i < len; i++) sum += L.data[i];
    const meanL = len > 0 ? sum / len : 0;

    const { clip, tileSize, sigma, sharpAmount, retinexStrength } = settings[level];
    const forceBranch = options?.mode && options.mode !== "auto" ? options.mode : null;
    const branch: "bright" | "dim" | "dark" = forceBranch
      ? forceBranch
      : meanL >= BRIGHT_THRESHOLD
        ? "bright"
        : meanL >= DIM_MIN
          ? "dim"
          : "dark";

    if (branch === "bright") {
      pipelineLog("bright", meanL, level, !!forceBranch);
      applyUnsharpMask(cv, channels, sigma, sharpAmount);
    } else if (branch === "dim") {
      pipelineLog("dim", meanL, level, !!forceBranch);
      applyCLAHEToChannels(cv, channels, clip, tileSize);
      applyUnsharpMask(cv, channels, sigma, sharpAmount);
    } else {
      pipelineLog("dark", meanL, level, !!forceBranch);
      applyCLAHEToChannels(cv, channels, clip, tileSize);
      applyUnsharpMask(
        cv,
        channels,
        sigma * DARK_UNSHARP_SIGMA_MULT,
        sharpAmount * DARK_UNSHARP_AMOUNT_MULT
      );
    }

    cv.merge(channels, labMat);
    writeLabToCanvas(cv, labMat, processCanvas, ctx);

    if (branch === "dark") {
      applyRetinex(processCanvas, retinexStrength);
    }

    if (useHalfRes) {
      const displayCtx = canvas.getContext("2d", { willReadFrequently: false })!;
      displayCtx.drawImage(processCanvas, 0, 0, processW, processH, 0, 0, canvas.width, canvas.height);
    }
    canvas.style.filter = "none";
  } finally {
    src.delete();
    rgbMat.delete();
    labMat.delete();
    channels.delete();
  }
}

export function applyCLAHEToCanvas(
  canvas: HTMLCanvasElement,
  level: ContrastLevel,
  options?: { mode?: EnhancementMode }
): void {
  const cv = (typeof window !== "undefined" && (window as any).cv) || null;
  const video = typeof document !== "undefined" ? document.querySelector("video") : null;
  if (cv && video instanceof HTMLVideoElement) applyCLAHE(cv, video, canvas, level, options);
}

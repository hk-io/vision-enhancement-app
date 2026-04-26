/**
 * Vision Enhancer Component - AR Text Detection with Two-Phase Enhancement
 *
 * Phase 1: CLAHE (fast, offline, 60 FPS)
 * Phase 2: Zero-DCE++ (AI-based, optional quality mode)
 *
 * Workflow:
 * 1. User selects LOW/MEDIUM/HIGH preset button
 * 2. CLAHE enhancement applies to live camera stream in real-time
 * 3. User clicks "AR" button to freeze frame and detect text
 * 4. ARTextOverlay renders detected text with styling options
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useCamera } from "@/hooks/useCamera";
import {
  useEASTTextDetection,
  type TextBox,
} from "@/hooks/useEASTTextDetection";
import { applyCLAHE, type EnhancementMode, lastPipelineInfo } from "@/lib/claheEnhancement";
import { loadZeroDCEModel, runZeroDceOnCanvas } from "@/lib/zeroDCE";
import { describeScene, warmupDescribeSceneModels } from "@/lib/describeScene";
import Tesseract from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Settings,
  X,
  SwitchCamera,
  Square,
  Loader2,
  RefreshCw,
  Upload,
  Info,
  Zap,
  Microscope,
  Eye,
  Contrast,
  Speech,
  Check,
  Maximize2,
  Minimize2,
  Download,
} from "lucide-react";
import {
  SmartTextIcon,
  SmartReadIcon,
  DescribeSceneIcon,
  TtsOnIcon,
} from "@/components/clearvision/ClearVisionIcons";
import {
  ARTextOverlay,
  type TextDetectionBox,
} from "@/components/ARTextOverlay";
import { TextExtractionModal } from "@/components/TextExtractionModal";

/**
 * Enhancement settings interface
 */
interface EnhancementSettings {
  edgeStrength: number;
  contrastLevel: "none" | "low" | "medium" | "high";
  enhancementMode: EnhancementMode;
  /** "performance" = process at half res (higher FPS), "quality" = full res (better look, lower FPS) */
  processQuality: "performance" | "quality";
  enableZeroDCE: boolean;
}

/**
 * Default enhancement values
 */
const DEFAULT_SETTINGS: EnhancementSettings = {
  edgeStrength: 0.0,
  contrastLevel: "none",
  enhancementMode: "auto",
  processQuality: "performance",
  enableZeroDCE: false,
};

/** Shared shape for bottom action rows (matches rounded-xl Button feel, not “AI chip” style) */
const MAIN_ROW_BTN =
  "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
/** Main action buttons — same radius, height, and label style for all four. */
const CV_ACTION_BTN =
  "cv-font pointer-events-auto flex min-h-[72px] w-full min-w-0 max-w-[200px] flex-col items-center justify-center gap-1 rounded-2xl border border-transparent px-1.5 text-[0.72rem] font-bold leading-snug text-white shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[74px] sm:gap-1 sm:px-2 sm:text-[0.88rem] sm:leading-tight";

/** Top bar: colors from clearvision.css (--cv-vision-*) so prod/static builds always match. */
const TOP_BAR_CTRL_H = "h-9 min-h-[36px] sm:h-10 sm:min-h-[40px]";
const TOP_BAR_RADIUS = "rounded-[11px]";
const TOP_BAR_GOLD_TEXT = "cv-vision-gold-text";
const TOP_BAR_GOLD_BORDER = "cv-vision-top-border";
const TOP_BAR_GOLD_BG = "cv-vision-top-bg";
const TOP_BAR_GOLD_BG_HOVER = "cv-vision-top-hover";
const TOP_BAR_ICON_BTN =
  `flex ${TOP_BAR_CTRL_H} w-9 min-w-[36px] max-w-[36px] shrink-0 items-center justify-center ${TOP_BAR_RADIUS} border ${TOP_BAR_GOLD_BORDER} ${TOP_BAR_GOLD_BG_HOVER} transition-colors ${TOP_BAR_GOLD_TEXT} sm:w-10 sm:min-w-[40px] sm:max-w-[40px]`;
/** FPS: same height as icon buttons; number + “fps” on one line. */
const TOP_BAR_FPS_BOX = `cv-font flex ${TOP_BAR_CTRL_H} w-auto min-w-[36px] max-w-[3.75rem] shrink-0 flex-row items-center justify-center gap-0.5 ${TOP_BAR_RADIUS} border ${TOP_BAR_GOLD_BORDER} ${TOP_BAR_GOLD_BG} px-1.5 py-0 ${TOP_BAR_GOLD_TEXT} sm:min-w-[40px] sm:max-w-[4rem] sm:px-2`;
const TOP_BAR_ICON_INNER = "h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5";
/** Enhancement strip — sizing in Tailwind; gold from CSS variables */
const ENH_GOLD = "cv-vision-gold-text";
const ENH_GOLD_BORDER = "cv-vision-enh-border";
const ENH_ACTIVE = "cv-vision-enh-active";

const SPEAK_UI_STORAGE_KEY = "visionAppSpeakFeedback";

/**
 * Text-to-speech announcement for accessibility
 */
function announceSelection(message: string) {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

function speakText(text: string) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  utterance.lang = "en-US";
  utterance.onstart = () => console.log("Speech started");
  utterance.onend = () => console.log("Speech finished");
  utterance.onerror = (e) => console.error("Speech error:", e);
  window.speechSynthesis.speak(utterance);
}

function splitSmartReadSentences(rawText: string): string[] {
  const normalized = rawText
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) return [];

  const trimAndKeep = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);

  let base: string[] = [];
  const maybeIntl = Intl as any;
  if (maybeIntl?.Segmenter) {
    try {
      const seg = new maybeIntl.Segmenter("en", { granularity: "sentence" });
      base = trimAndKeep(Array.from(seg.segment(normalized), (x: any) => String(x.segment || "")));
    } catch {
      base = [];
    }
  }
  if (base.length === 0) {
    base = trimAndKeep(normalized.split(/(?<=[.!?])\s+|\n+/));
  }

  // Merge tiny OCR fragments back into surrounding sentence chunks.
  const merged: string[] = [];
  for (const part of base) {
    const wordCount = part.split(/\s+/).filter(Boolean).length;
    const tiny = wordCount < 4 && !/[.!?]$/.test(part);
    if (tiny && merged.length > 0) merged[merged.length - 1] = `${merged[merged.length - 1]} ${part}`.trim();
    else merged.push(part);
  }
  return trimAndKeep(merged);
}

function splitSceneNarrationSentences(rawText: string): string[] {
  const normalized = rawText.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const maybeIntl = Intl as any;
  if (maybeIntl?.Segmenter) {
    try {
      const seg = new maybeIntl.Segmenter("en", { granularity: "sentence" });
      const s = Array.from(seg.segment(normalized), (x: any) => String(x.segment || "").trim()).filter(Boolean);
      if (s.length) return s;
    } catch {
      /* fallback below */
    }
  }
  return normalized.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Longest edge cap — very large frames add noise and slow OCR without helping accuracy. */
const SMART_READ_OCR_MAX_EDGE = 1920;
const SMART_READ_OCR_MIN_EDGE = 1280;

function copyCanvasToMaxEdge(source: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const long = Math.max(w, h);
  const scale = long > maxEdge ? maxEdge / long : 1;
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const out = document.createElement("canvas");
  out.width = nw;
  out.height = nh;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, nw, nh);
  return out;
}

/** Upscale small captures for OCR (helps distant text), cap at 2x to avoid heavy noise amplification. */
function ensureSmartReadMinEdge(source: HTMLCanvasElement, minEdge: number): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const long = Math.max(w, h);
  if (long >= minEdge) return source;
  const scale = Math.min(2, minEdge / Math.max(1, long));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * scale));
  out.height = Math.max(1, Math.round(h * scale));
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

/** When contrast preset is off and OpenCV is unavailable — grayscale + min–max stretch for Tesseract. */
function applySimpleOcrNormalize(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    min = Math.min(min, y);
    max = Math.max(max, y);
    d[i] = y;
    d[i + 1] = y;
    d[i + 2] = y;
  }
  const range = max - min || 1;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(((d[i] - min) / range) * 255);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Document-focused binarization (Otsu) to separate text from background. */
function applyOtsuBinarize(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const hist = new Array<number>(256).fill(0);
  const gray = new Uint8Array(width * height);
  let total = 0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    gray[p] = y;
    hist[y]++;
    total++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxBetween = -1;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxBetween) {
      maxBetween = between;
      threshold = t;
    }
  }

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = gray[p] >= threshold ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/** Prepare capture for local Tesseract (never mutates the live preview canvas). */
function buildSmartReadOcrCanvas(
  capture: HTMLCanvasElement,
  settings: EnhancementSettings
): HTMLCanvasElement {
  const sized = copyCanvasToMaxEdge(capture, SMART_READ_OCR_MAX_EDGE);
  const working = ensureSmartReadMinEdge(sized, SMART_READ_OCR_MIN_EDGE);
  const cv = (window as any).cv;
  if (settings.contrastLevel !== "none" && cv) {
    applyCLAHE(
      cv,
      working as unknown as HTMLVideoElement,
      working,
      settings.contrastLevel,
      {
        mode: settings.enhancementMode,
        processScale: settings.processQuality === "performance" ? 0.5 : 1,
      }
    );
  } else {
    applySimpleOcrNormalize(working);
  }
  return working;
}

function buildSmartReadOcrVariants(
  capture: HTMLCanvasElement,
  settings: EnhancementSettings
): HTMLCanvasElement[] {
  const base = buildSmartReadOcrCanvas(capture, settings);
  const variants: HTMLCanvasElement[] = [base];

  // Variant 2: document binarization from normalized/enhanced base.
  const bw = document.createElement("canvas");
  bw.width = base.width;
  bw.height = base.height;
  const bwCtx = bw.getContext("2d", { willReadFrequently: true });
  if (bwCtx) {
    bwCtx.drawImage(base, 0, 0);
    applyOtsuBinarize(bw);
    variants.push(bw);
  }

  // Variant 3: slightly downscaled binarized copy can reduce noise on textured backgrounds.
  const down = copyCanvasToMaxEdge(bw, Math.max(1000, Math.round(Math.max(bw.width, bw.height) * 0.85)));
  if (down !== bw) variants.push(down);

  return variants;
}

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isLikelyGibberishLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (t.length <= 2) return true;
  const compact = t.replace(/\s/g, "");
  if (!compact) return true;
  const letters = (compact.match(/[A-Za-z]/g) || []).length;
  const digits = (compact.match(/[0-9]/g) || []).length;
  const symbols = Math.max(0, compact.length - letters - digits);
  const symbolRatio = symbols / compact.length;
  const letterRatio = letters / compact.length;
  // Strong gibberish patterns: too many symbols, almost no letters.
  if (symbolRatio > 0.35) return true;
  if (letterRatio < 0.35 && digits < 3) return true;
  // Repeated punctuation streaks often come from OCR noise.
  if (/[=~`^_|\\/\[\]\{\}]{3,}/.test(t)) return true;
  return false;
}

/** Clean document OCR output: remove noisy lines + merge wrapped lines into paragraphs. */
function cleanDocumentOcrText(raw: string): string {
  const normalized = normalizeExtractedText(raw);
  if (!normalized) return "";
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isLikelyGibberishLine(l));

  const merged: string[] = [];
  for (const line of lines) {
    if (merged.length === 0) {
      merged.push(line);
      continue;
    }
    const prev = merged[merged.length - 1];
    const prevEndsSentence = /[.!?:;)]$/.test(prev);
    const currStartsLower = /^[a-z]/.test(line);
    const prevHyphen = /-$/.test(prev);
    const shortLine = line.length < 28;
    // Merge wrapped OCR lines into previous sentence/paragraph.
    if (prevHyphen) {
      merged[merged.length - 1] = `${prev.slice(0, -1)}${line}`;
    } else if (!prevEndsSentence || currStartsLower || shortLine) {
      merged[merged.length - 1] = `${prev} ${line}`.replace(/\s{2,}/g, " ").trim();
    } else {
      merged.push(line);
    }
  }

  return merged.join("\n");
}

function scoreExtractedText(raw: string, confidence?: number): number {
  if (!raw) return 0;
  const text = cleanDocumentOcrText(raw);
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const compact = text.replace(/\s/g, "");
  const chars = compact.length;
  if (chars === 0) return 0;
  const alphaCount = (compact.match(/[A-Za-z]/g) || []).length;
  const digitCount = (compact.match(/[0-9]/g) || []).length;
  const symbolCount = Math.max(0, chars - alphaCount - digitCount);
  const alphaRatio = alphaCount / chars;
  const symbolRatio = symbolCount / chars;
  const avgWordLen = chars / Math.max(1, wordCount);
  const conf = Number.isFinite(confidence) ? Math.max(0, Math.min(100, Number(confidence))) : 0;

  // Favor readable language-like OCR output and confidence, penalize noisy symbol-heavy gibberish.
  return (
    conf * 3 +
    alphaRatio * 140 +
    wordCount * 2 +
    Math.min(40, chars / 4) -
    symbolRatio * 180 -
    Math.max(0, avgWordLen - 14) * 6
  );
}

export default function VisionEnhancerOverlay() {
  // Camera management
  const {
    stream,
    error,
    isLoading,
    hasPermission,
    videoRef,
    startCamera,
    stopCamera,
    switchCamera,
    canSwitch,
    facingMode,
  } = useCamera();

  // Enhancement settings state
  const [settings, setSettings] =
    useState<EnhancementSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [fps, setFps] = useState(0);
  const [pipelineDisplay, setPipelineDisplay] = useState<{ branch: "bright" | "dim" | "dark"; meanL: number }>({ branch: "bright", meanL: 0 });
  const [readStatus, setReadStatus] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [showReadPanel, setShowReadPanel] = useState<boolean>(false);
  /** Enhanced document image (data URL) for Read view — user reads this; optional TTS via speaker icon */
  const [enhancedReadDataUrl, setEnhancedReadDataUrl] = useState<string | null>(null);
  const [showReadView, setShowReadView] = useState<boolean>(false);
  // Distinguish which feature created the read view.
  // - "upload": show contrast+edge bar (so user can switch Low/Medium/High)
  // - "smartRead": legacy type only; Smart Read no longer uses this read view
  const [readViewOrigin, setReadViewOrigin] = useState<"upload" | "smartRead" | null>(null);
  /** Upload read view: AI low-light (Zero-DCE++) is on — cleared when toggled off, CLAHE preset changes, close, or new upload */
  const [uploadLowLightBoostApplied, setUploadLowLightBoostApplied] = useState(false);
  /** Upload preview: hide toolbars for a clean full-screen image; may pair with browser Fullscreen API when supported */
  const [uploadReadImmersive, setUploadReadImmersive] = useState(false);
  const readViewRootRef = useRef<HTMLDivElement>(null);
  const hadUploadReadFullscreenRef = useRef(false);
  const [readAloudStatus, setReadAloudStatus] = useState<string>("");
  const [captionText, setCaptionText] = useState<string>("");
  const [showCaptionPanel, setShowCaptionPanel] = useState<boolean>(false);
  const [captionStatus, setCaptionStatus] = useState<string>("");
  const [isSceneProcessing, setIsSceneProcessing] = useState(false);
  const [scenePreviewUrl, setScenePreviewUrl] = useState<string | null>(null);
  const [isCaptionSpeaking, setIsCaptionSpeaking] = useState(false);
  const [activeCaptionSentenceIndex, setActiveCaptionSentenceIndex] = useState(-1);
  const [activeCaptionWordIndex, setActiveCaptionWordIndex] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const featureGuidePanelRef = useRef<HTMLDivElement>(null);
  const captionPanelRef = useRef<HTMLDivElement>(null);

  // Keep the original uploaded image so we can re-apply enhancement when the user changes Low/Medium/High.
  const uploadedOriginalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /** Master switch: spoken hints for controls + read-aloud for descriptions / extract text */
  const [speakUiEnabled, setSpeakUiEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SPEAK_UI_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SPEAK_UI_STORAGE_KEY, speakUiEnabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [speakUiEnabled]);

  const speakUiHint = useCallback((message: string) => {
    if (!speakUiEnabled) return;
    announceSelection(message);
  }, [speakUiEnabled]);

  const speakLongIfEnabled = useCallback((text: string) => {
    if (!speakUiEnabled || !text.trim()) return;
    speakText(text);
  }, [speakUiEnabled]);

  const speakElementTextIfEnabled = useCallback(
    (el: HTMLElement | null) => {
      if (!speakUiEnabled) return;
      if (!el) return;
      const raw = (el.innerText || "").replace(/\s+\n/g, "\n").trim();
      if (!raw) return;

      // Chunk to keep TTS stable on mobile browsers.
      const chunks: string[] = [];
      const maxLen = 220;
      let remaining = raw;
      while (remaining.length > 0) {
        let slice = remaining.slice(0, maxLen);
        const cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
        if (cut > 60) slice = remaining.slice(0, cut + 1);
        chunks.push(slice.trim());
        remaining = remaining.slice(slice.length).trimStart();
      }

      window.speechSynthesis.cancel();
      let i = 0;
      const speakNext = () => {
        if (i >= chunks.length) return;
        const u = new SpeechSynthesisUtterance(chunks[i]);
        u.rate = 0.95;
        u.lang = "en-US";
        u.onend = () => {
          i += 1;
          speakNext();
        };
        window.speechSynthesis.speak(u);
      };
      speakNext();
    },
    [speakUiEnabled]
  );

  /** ClearVision welcome until user starts camera; return here after Stop */
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [showFeatureGuide, setShowFeatureGuide] = useState(false);

  const handleWelcomeStart = useCallback(() => {
    speakUiHint("Starting camera");
    setShowWelcomeScreen(false);
    void startCamera();
  }, [startCamera, speakUiHint]);

  const handleStopWithWelcome = useCallback(() => {
    speakUiHint("Camera stopped");
    stopCamera();
    setShowWelcomeScreen(true);
  }, [stopCamera, speakUiHint]);

  /** Load Zero-DCE++ once when app starts */
  useEffect(() => {
    loadZeroDCEModel();
    // Warm Smart Scene models in background to reduce first-use delay.
    void warmupDescribeSceneModels();
  }, []);

  /**
   * DO NOT auto-start camera on mount
   * Let user click Start button to request permission
   * This prevents the app from getting stuck in black screen
   */

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Text recognition hook
  const {
    detectionBoxes,
    isOCRProcessing,
    frozenFrame,
    isFrozen,
    processFrame,
    reprocessFrozenFrame,
    unfreezeFrame,
    enhancedFrame,
    applyZeroDCEEnhancement,
  } = useEASTTextDetection(videoRef, hasPermission, {
    contrastLevel: settings.contrastLevel,
    enhancementMode: settings.enhancementMode,
    processQuality: settings.processQuality,
  });

  // State for text extraction modal
  const [showTextExtractionModal, setShowTextExtractionModal] = useState(false);
  const [allDetectedText, setAllDetectedText] = useState<string[]>([]);
  const [isSmartReadProcessing, setIsSmartReadProcessing] = useState(false);
  const [smartReadPreviewUrl, setSmartReadPreviewUrl] = useState<string | null>(null);

  // State for AR overlay
  const [arTextBoxes, setArTextBoxes] = useState<TextDetectionBox[]>([]);
  const [showAROverlay, setShowAROverlay] = useState(false);
  const frozenFrameImgRef = useRef<HTMLImageElement>(null);

  // State for AR zoom
  const [arZoom, setArZoom] = useState(1.0); // 1.0 = 100%, 3.0 = 300%
  const [showZoomModal, setShowZoomModal] = useState(false); // Zoom modal state

  // State for AR text styling
  const [arTextStyle, setArTextStyle] = useState({
    backgroundColor: "#000080",
    textColor: "#ffffff",
    fontSizeMultiplier: 1.0,
    fontFamily: "sans-serif",
    bold: false,
  });

  // FPS calculation
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
  const latestFpsRef = useRef(0);
  const frameSkipRef = useRef(0);
  const cvWarnRef = useRef(0);

  // Persist AR text styling to localStorage
  useEffect(() => {
    localStorage.setItem("arTextStyle", JSON.stringify(arTextStyle));
  }, [arTextStyle]);

  // When spoken feedback is ON, read the full open panel content (accessibility: "read the open page").
  useEffect(() => {
    if (!speakUiEnabled) return;
    if (showFeatureGuide) {
      const t = window.setTimeout(() => speakElementTextIfEnabled(featureGuidePanelRef.current), 80);
      return () => window.clearTimeout(t);
    }
    if (showSettings) {
      const t = window.setTimeout(() => speakElementTextIfEnabled(settingsPanelRef.current), 80);
      return () => window.clearTimeout(t);
    }
    if (showCaptionPanel) {
      const t = window.setTimeout(() => speakElementTextIfEnabled(captionPanelRef.current), 80);
      return () => window.clearTimeout(t);
    }
  }, [speakUiEnabled, showFeatureGuide, showSettings, showCaptionPanel, speakElementTextIfEnabled]);

  // Load AR text styling from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("arTextStyle");
    if (saved) {
      try {
        setArTextStyle(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved AR text style:", e);
      }
    }
  }, []);

  /**
   * Sync detection boxes to AR overlay when they change
   */
  useEffect(() => {
    if (detectionBoxes && detectionBoxes.length > 0) {
      const textBoxes: TextDetectionBox[] = detectionBoxes.map((box) => ({
        x: box.box.x,
        y: box.box.y,
        width: box.box.width,
        height: box.box.height,
        text: box.text,
        confidence: box.confidence,
      }));

      console.log(`🔄 Syncing ${textBoxes.length} detection boxes to AR overlay`);
      setArTextBoxes(textBoxes);

      // Also populate all detected text for extraction modal
      const allText = textBoxes.map((box) => box.text);
      setAllDetectedText(allText);

      // Show overlay immediately
      setShowAROverlay(true);
    } else {
      setArTextBoxes([]);
      setAllDetectedText([]);
      // While the camera is still frozen in AR mode, keep the AR UI (toolbar, reprocess)
      // visible even if OCR returns zero regions — otherwise Reprocess "does nothing"
      // and controls disappear.
      if (!isFrozen) {
      setShowAROverlay(false);
    }
    }
  }, [detectionBoxes, isFrozen]);

  /**
   * Simple animation loop: when camera is active and contrast is enabled,
   * run OpenCV CLAHE on the current frame and draw to canvas.
   */
  useEffect(() => {
    let rafId: number;

    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const level = settings.contrastLevel;

      if (video && canvas && hasPermission && !isFrozen && !showReadView && level !== "none") {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (
            canvas.width !== video.videoWidth ||
            canvas.height !== video.videoHeight
          ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
          }
          // Lightweight frame skipping to improve FPS:
          // only run heavy CLAHE processing on every 2nd frame.
          frameSkipRef.current = (frameSkipRef.current + 1) % 2;
          if (frameSkipRef.current === 0) {
            try {
              const cv = (window as any).cv;
              if (!cv) {
                const now = performance.now();
                if (now - cvWarnRef.current > 5000) {
                  console.warn("[Vision] OpenCV (window.cv) not loaded — enhancement disabled. Check that opencv.js has loaded.");
                  cvWarnRef.current = now;
                }
              } else {
                applyCLAHE(cv, video, canvas, level as "low" | "medium" | "high", {
                  mode: settings.enhancementMode,
                  processScale: settings.processQuality === "performance" ? 0.5 : 1,
                });
              }
            } catch (e: any) {
              try {
                const cv = (window as any).cv;
                if (cv && typeof e === "number" && typeof cv.exceptionFromPtr === "function") {
                  const exc = cv.exceptionFromPtr(e);
                  console.error("CLAHE error:", exc.msg);
                  if (typeof exc.delete === "function") {
                    exc.delete();
                  }
                } else {
                  console.error("CLAHE error:", e && e.message ? e.message : e);
                }
              } catch (logErr) {
                console.error("CLAHE error (logging failed):", logErr);
              }
            }
          }
        }
      }

      // FPS counter (approximate)
      fpsCounterRef.current.frames++;
      const now = performance.now();
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        latestFpsRef.current = fpsCounterRef.current.frames;
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }
      
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [hasPermission, isFrozen, showReadView, settings.contrastLevel, settings.enhancementMode, settings.processQuality, videoRef]);

  /**
   * Throttled FPS state update separate from the animation loop
   * so that React re-renders are not tied to every frame.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      setFps(latestFpsRef.current);
      setPipelineDisplay({ ...lastPipelineInfo });
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  /**
   * Handle setting changes (vision/mode speech is handled in toolbar with speakUiHint)
   */
  const handleSettingChange = <K extends keyof EnhancementSettings>(
    key: K,
    value: EnhancementSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Reset all settings to default
   */
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setArTextStyle({
      backgroundColor: "#000080",
      textColor: "#ffffff",
      fontSizeMultiplier: 1.0,
      fontFamily: "sans-serif",
      bold: false,
    });
    speakUiHint("Settings reset to defaults");
  };

  /**
   * Handle AR button click - freeze frame and process for text detection
   */
  const handleARClick = useCallback(async () => {
    console.log("🔍 AR BUTTON CLICKED");
    speakUiHint("Scanning for text");

    try {
      if (!isFrozen && videoRef.current) {
        console.log("⏳ Processing frame...");
        await processFrame(videoRef.current);
        console.log("✅ Frame processing complete");
        speakUiHint("A R scan finished");
      }

      console.log("🔄 Activating AR overlay...");
      setShowAROverlay(true);
    } catch (error) {
      console.error("❌ Error in AR mode:", error);
      speakUiHint("A R scan failed");
    }
  }, [isFrozen, processFrame, speakUiHint]);

  /**
   * Handle reprocess button - reprocess the frozen frame
   */
  const handleReprocessClick = useCallback(async () => {
    console.log("🔄 REPROCESS BUTTON CLICKED");
    // While AR is frozen, <video> is unmounted — must OCR the frozen canvas, not videoRef.
    try {
      if (!isFrozen) {
        console.warn("Reprocess: not frozen");
        return;
      }
      await reprocessFrozenFrame();
      console.log("✅ Reprocessing complete");
    } catch (error) {
      console.error("❌ Error reprocessing:", error);
    }
  }, [isFrozen, reprocessFrozenFrame]);

  /**
   * Handle close AR - return to live camera
   */
  const handleCloseAR = useCallback(() => {
    console.log("❌ Closing AR mode");
    speakUiHint("Closed A R");
    setShowAROverlay(false);
    unfreezeFrame();
    setArTextBoxes([]);
  }, [unfreezeFrame, speakUiHint]);

  /** Smart Read = capture frame -> OCR extraction -> open reading modal (no Zero-DCE++). */
  const handleReadTap = useCallback(async () => {
    speakUiHint("Extracting text");
    setReadStatus("Extracting text...");
    setIsSmartReadProcessing(true);
    setShowReadView(false);
    setReadViewOrigin(null);
    setEnhancedReadDataUrl(null);
    setReadAloudStatus("");

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      setReadStatus("Camera not ready.");
      setTimeout(() => setReadStatus(""), 2000);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    // Front camera preview is mirrored via CSS; mirror the captured pixels too
    // so the exported Zero-DCE result matches what you see.
    if (facingMode === "user") {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }
    setSmartReadPreviewUrl(canvas.toDataURL("image/jpeg", 0.8));

    try {
      const ocrVariants = buildSmartReadOcrVariants(canvas, settings);
      // One-shot `Tesseract.recognize` forwards the 3rd argument only to worker paths, not OCR;
      // use a short-lived worker so page-seg mode and DPI reach the engine.
      const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
        logger: (m) => console.log("Smart Read OCR:", m.status, m.progress),
      });
      let full = "";
      try {
        const candidates: Array<{ text: string; confidence: number }> = [];
        // Document-oriented first, then broader fallback.
        const psmOrder = [Tesseract.PSM.SINGLE_BLOCK, Tesseract.PSM.AUTO, Tesseract.PSM.SPARSE_TEXT];
        for (const variant of ocrVariants) {
          for (const psm of psmOrder) {
            await worker.setParameters({
              tessedit_pageseg_mode: psm,
              user_defined_dpi: "360",
              preserve_interword_spaces: "1",
            } as any);
            const result = await worker.recognize(variant);
            const conf = Number((result as any)?.data?.confidence ?? 0);
            const base = cleanDocumentOcrText(result.data.text || "");
            if (base) candidates.push({ text: base, confidence: conf });
            const lineText = cleanDocumentOcrText((((result as any)?.data?.lines) || []).map((l: any) => String(l?.text || "")).join("\n"));
            if (lineText) candidates.push({ text: lineText, confidence: conf });
          }
        }
        full =
          candidates
            .sort((a, b) => scoreExtractedText(b.text, b.confidence) - scoreExtractedText(a.text, a.confidence))[0]
            ?.text || "";
      } finally {
        await worker.terminate();
      }

      const cleanedFull = cleanDocumentOcrText(full);
      const sentences = splitSmartReadSentences(cleanedFull);

      const lines = sentences.length > 0 ? sentences : cleanedFull ? [cleanedFull] : [];
      setAllDetectedText(lines);
      setShowTextExtractionModal(true);
      setReadStatus("");
      if (lines.length === 0) {
        setReadStatus("No readable text found.");
        setTimeout(() => setReadStatus(""), 2200);
      } else {
        speakUiHint("Text extracted");
      }
    } catch (e) {
      console.error("Smart Read OCR failed:", e);
      setReadStatus("Could not extract text.");
      setTimeout(() => setReadStatus(""), 2500);
    } finally {
      setIsSmartReadProcessing(false);
      setSmartReadPreviewUrl(null);
    }
  }, [
    facingMode,
    speakUiHint,
    settings.contrastLevel,
    settings.enhancementMode,
    settings.processQuality,
  ]);

  /** Upload image from device and run same vision enhancement settings as camera view. */
  const handleUploadImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setReadStatus("Please choose an image file.");
        setTimeout(() => setReadStatus(""), 2500);
        return;
      }

      setReadStatus("Enhancing uploaded image...");
      setShowReadPanel(false);
      setShowReadView(false);
      setEnhancedReadDataUrl(null);
      setReadAloudStatus("");
      setUploadLowLightBoostApplied(false);
      setUploadReadImmersive(false);
      hadUploadReadFullscreenRef.current = false;

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Failed to read image file"));
          reader.readAsDataURL(file);
        });

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = () => reject(new Error("Could not load selected image"));
          i.src = dataUrl;
        });

        const uploadCanvas = document.createElement("canvas");
        uploadCanvas.width = img.naturalWidth || img.width;
        uploadCanvas.height = img.naturalHeight || img.height;
        const uploadCtx = uploadCanvas.getContext("2d", { willReadFrequently: true });
        if (!uploadCtx) throw new Error("Failed to create canvas context");
        uploadCtx.drawImage(img, 0, 0, uploadCanvas.width, uploadCanvas.height);

        // Save original for re-processing (contrast/edge controls inside the Upload/Describe view).
        uploadedOriginalCanvasRef.current = uploadCanvas;

        // Work on a copy so the original stays unmodified.
        const enhancedCanvas = document.createElement("canvas");
        enhancedCanvas.width = uploadCanvas.width;
        enhancedCanvas.height = uploadCanvas.height;
        const enhancedCtx = enhancedCanvas.getContext("2d", { willReadFrequently: true });
        if (!enhancedCtx) throw new Error("Failed to create enhancement canvas context");
        enhancedCtx.drawImage(uploadCanvas, 0, 0);

        const level = settings.contrastLevel;
        const cv = (window as any).cv;
        if (level !== "none" && cv) {
          // applyCLAHE is typed for video input, but canvas is a valid drawImage source.
          applyCLAHE(
            cv,
            enhancedCanvas as unknown as HTMLVideoElement,
            enhancedCanvas,
            level as "low" | "medium" | "high",
            {
              mode: settings.enhancementMode,
              processScale: settings.processQuality === "performance" ? 0.5 : 1,
            }
          );
        } else if (level !== "none" && !cv) {
          console.warn("OpenCV not loaded — skipping contrast/edge enhancement for upload.");
          setReadStatus("OpenCV not loaded (contrast enhancement skipped).");
          setTimeout(() => setReadStatus(""), 2500);
        }

        setEnhancedReadDataUrl(enhancedCanvas.toDataURL("image/png"));
        setReadViewOrigin("upload");
        setShowReadView(true);
        setReadStatus("");
        speakUiHint("Uploaded image enhanced");
      } catch (e) {
        console.error("Upload enhancement failed:", e);
        setReadStatus("Could not process uploaded image.");
        setTimeout(() => setReadStatus(""), 3000);
      }
    },
    [settings.contrastLevel, settings.enhancementMode, settings.processQuality, speakUiHint]
  );

  const reapplyUploadedEnhancement = useCallback(
    async (
      nextLevel: EnhancementSettings["contrastLevel"],
      opts?: { announcePreset?: boolean; preserveLowLightBoost?: boolean }
    ) => {
      const announcePreset = opts?.announcePreset !== false;
      const preserveBoost = opts?.preserveLowLightBoost === true;
      const original = uploadedOriginalCanvasRef.current;
      if (!original) return;

      const enhancedCanvas = document.createElement("canvas");
      enhancedCanvas.width = original.width;
      enhancedCanvas.height = original.height;
      const enhancedCtx = enhancedCanvas.getContext("2d", { willReadFrequently: true });
      if (!enhancedCtx) return;
      enhancedCtx.drawImage(original, 0, 0);

      // Zero-DCE must see the raw upload (linear-ish RGB in [0,1]), not CLAHE output — otherwise
      // highlights stack and faces blow out. Contrast/edges run after DCE when boost is on.
      let dceOk = true;
      if (preserveBoost) {
        setReadStatus("Updating contrast and low-light boost...");
        dceOk = await runZeroDceOnCanvas(enhancedCanvas);
        if (!dceOk) {
          enhancedCtx.drawImage(original, 0, 0);
        }
      }

      const cv = (window as any).cv;
      if (nextLevel !== "none" && cv) {
        applyCLAHE(
          cv,
          enhancedCanvas as unknown as HTMLVideoElement,
          enhancedCanvas,
          nextLevel as "low" | "medium" | "high",
          {
            mode: settings.enhancementMode,
            processScale: settings.processQuality === "performance" ? 0.5 : 1,
          }
        );
      } else if (nextLevel !== "none" && !cv) {
        setReadStatus("OpenCV not loaded (contrast enhancement skipped).");
        setTimeout(() => setReadStatus(""), 2500);
      }

      setEnhancedReadDataUrl(enhancedCanvas.toDataURL("image/png"));
      if (preserveBoost) {
        setUploadLowLightBoostApplied(dceOk);
        setReadStatus("");
        if (!dceOk) {
          setReadStatus("Low-light boost could not be reapplied (model busy).");
          setTimeout(() => setReadStatus(""), 2500);
        }
      } else {
        setUploadLowLightBoostApplied(false);
      }

      if (announcePreset) {
        const labels = { none: "Off", low: "Mild", medium: "Medium", high: "Strong" } as const;
        speakUiHint(`Uploaded image: ${labels[nextLevel]} enhancement`);
      }
    },
    [settings.enhancementMode, settings.processQuality, speakUiHint]
  );

  /** Toggle: on = run Zero-DCE once on current preview; off = restore CLAHE-only from original (no stacking). */
  const applyZeroDceToUploadedImage = useCallback(async () => {
    if (uploadLowLightBoostApplied) {
      void reapplyUploadedEnhancement(settings.contrastLevel, { announcePreset: false, preserveLowLightBoost: false });
      setReadStatus("");
      speakUiHint("Low light boost off");
      return;
    }

    const original = uploadedOriginalCanvasRef.current;
    if (!original) return;
    setReadStatus("Applying Zero-DCE++...");
    try {
      const c = document.createElement("canvas");
      c.width = original.width;
      c.height = original.height;
      const cctx = c.getContext("2d", { willReadFrequently: true });
      if (!cctx) throw new Error("Canvas context unavailable");
      cctx.drawImage(original, 0, 0);

      const ok = await runZeroDceOnCanvas(c);
      if (!ok) {
        setReadStatus("Zero-DCE++ model not ready.");
        setTimeout(() => setReadStatus(""), 2000);
        return;
      }

      const level = settings.contrastLevel;
      const cv = (window as any).cv;
      if (level !== "none" && cv) {
        applyCLAHE(
          cv,
          c as unknown as HTMLVideoElement,
          c,
          level as "low" | "medium" | "high",
          {
            mode: settings.enhancementMode,
            processScale: settings.processQuality === "performance" ? 0.5 : 1,
          }
        );
      }

      setReadStatus("");
      setEnhancedReadDataUrl(c.toDataURL("image/png"));
      setUploadLowLightBoostApplied(true);
      if (level !== "none" && !cv) {
        setReadStatus("OpenCV not loaded (contrast enhancement skipped).");
        setTimeout(() => setReadStatus(""), 2500);
      }
      speakUiHint("Low light boost applied");
    } catch (e) {
      console.error("Upload Zero-DCE++ failed:", e);
      setReadStatus("Could not apply Zero-DCE++.");
      setTimeout(() => setReadStatus(""), 2200);
    }
  }, [
    speakUiHint,
    uploadLowLightBoostApplied,
    reapplyUploadedEnhancement,
    settings.contrastLevel,
    settings.enhancementMode,
    settings.processQuality,
  ]);

  const exitReadViewFullscreen = useCallback(async () => {
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const closeReadView = useCallback(() => {
    hadUploadReadFullscreenRef.current = false;
    void exitReadViewFullscreen();
    window.speechSynthesis.cancel();
    setShowReadView(false);
    setReadViewOrigin(null);
    setEnhancedReadDataUrl(null);
    uploadedOriginalCanvasRef.current = null;
    setReadAloudStatus("");
    setUploadLowLightBoostApplied(false);
    setUploadReadImmersive(false);
  }, [exitReadViewFullscreen]);

  const saveEnhancedUploadImage = useCallback(() => {
    if (!enhancedReadDataUrl) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const a = document.createElement("a");
    a.href = enhancedReadDataUrl;
    a.download = `vision-enhancement-${stamp}.png`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    speakUiHint("Image saved");
  }, [enhancedReadDataUrl, speakUiHint]);

  const enterUploadReadImmersive = useCallback(async () => {
    speakUiHint("Full screen");
    setUploadReadImmersive(true);
    const el = readViewRootRef.current;
    if (!el) return;
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        hadUploadReadFullscreenRef.current = true;
      } else if (anyEl.webkitRequestFullscreen) {
        anyEl.webkitRequestFullscreen();
        hadUploadReadFullscreenRef.current = true;
      } else {
        hadUploadReadFullscreenRef.current = false;
      }
    } catch {
      hadUploadReadFullscreenRef.current = false;
    }
  }, [speakUiHint]);

  const exitUploadReadImmersive = useCallback(async () => {
    speakUiHint("Exit full screen");
    setUploadReadImmersive(false);
    hadUploadReadFullscreenRef.current = false;
    await exitReadViewFullscreen();
  }, [speakUiHint, exitReadViewFullscreen]);

  useEffect(() => {
    const fullscreenEl = () =>
      document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;

    const onFs = () => {
      if (!fullscreenEl() && hadUploadReadFullscreenRef.current) {
        hadUploadReadFullscreenRef.current = false;
        setUploadReadImmersive(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  /** Optional TTS: run OCR on the enhanced document and read aloud (triggered by speaker icon). */
  const handleReadAloudTap = useCallback(async () => {
    if (!enhancedReadDataUrl) return;
    setReadAloudStatus("Reading text...");
    try {
      const result = await Tesseract.recognize(enhancedReadDataUrl, "eng", {
        logger: (m) => console.log("Tesseract:", m.status, m.progress),
      });
      const text = result.data.text.trim();
      setReadAloudStatus("");
      if (text && text.length >= 2) {
        if (speakUiEnabled) {
          speakText(text);
        } else {
          setReadAloudStatus("Text found. Turn on Speak (top right) to hear it.");
          setTimeout(() => setReadAloudStatus(""), 4000);
        }
      } else {
        setReadAloudStatus("No text found.");
        setTimeout(() => setReadAloudStatus(""), 2000);
      }
    } catch (e) {
      console.error("Tesseract OCR failed:", e);
      setReadAloudStatus("Could not read text.");
      setTimeout(() => setReadAloudStatus(""), 2000);
    }
  }, [enhancedReadDataUrl, speakUiEnabled]);

  /** Smart Scene: object hints + SmolVLM (caption fallback), then optional TTS */
  const handleDescribeTap = useCallback(async () => {
    setCaptionStatus("Preparing Smart Scene...");
    setShowCaptionPanel(false);
    setCaptionText("");
    setIsSceneProcessing(true);
    setScenePreviewUrl(null);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsCaptionSpeaking(false);

    // Capture frame once into a snapshot so the enhancement loop doesn't overwrite it before scene analysis runs
    let imageSource: HTMLCanvasElement | string;

    if (showReadView && enhancedReadDataUrl) {
      imageSource = enhancedReadDataUrl;
      setScenePreviewUrl(enhancedReadDataUrl);
    } else {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        setCaptionStatus("Camera not ready.");
        speakUiHint("Camera not ready");
        setTimeout(() => setCaptionStatus(""), 2000);
        return;
      }

      const w = video.videoWidth;
      const h = video.videoHeight;
      const snapshot = document.createElement("canvas");
      snapshot.width = w;
      snapshot.height = h;
      const ctx = snapshot.getContext("2d", { willReadFrequently: true })!;

      if (facingMode === "user") {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, w, h);
      }

      imageSource = snapshot;
      setScenePreviewUrl(snapshot.toDataURL("image/jpeg", 0.8));
    }

    setCaptionStatus("Analyzing scene...");
    try {
      const result = await describeScene(imageSource);
      setCaptionText(result.text);
      setShowCaptionPanel(true);
      setCaptionStatus("");
      speakLongIfEnabled(result.text);
    } catch (e) {
      console.error("Describe failed:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      const msg =
        errMsg.includes("timed out") || errMsg.includes("Timeout")
          ? "Taking too long. Try better WiFi or wait for the model to finish downloading."
          : errMsg && errMsg !== "undefined"
            ? `Could not analyze scene. (${errMsg})`
            : "Could not analyze scene.";
      setCaptionStatus(msg);
      speakUiHint(msg);
      setTimeout(() => setCaptionStatus(""), 5000);
    } finally {
      setIsSceneProcessing(false);
      setScenePreviewUrl(null);
    }
  }, [showReadView, enhancedReadDataUrl, speakLongIfEnabled, speakUiHint, facingMode]);

  const handleCaptionReadAloud = useCallback(() => {
    if (!captionText.trim()) return;
    if (!("speechSynthesis" in window)) return;
    if (isCaptionSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsCaptionSpeaking(false);
      setActiveCaptionSentenceIndex(-1);
      setActiveCaptionWordIndex(-1);
      return;
    }
    const sentences = splitSceneNarrationSentences(captionText);
    if (!sentences.length) return;
    setIsCaptionSpeaking(true);
    let i = 0;
    const speakNext = () => {
      if (i >= sentences.length) {
        setIsCaptionSpeaking(false);
        setActiveCaptionSentenceIndex(-1);
        setActiveCaptionWordIndex(-1);
        return;
      }
      const sentence = sentences[i];
      setActiveCaptionSentenceIndex(i);
      setActiveCaptionWordIndex(-1);
      const u = new SpeechSynthesisUtterance(sentence);
      u.rate = 0.95;
      u.lang = "en-US";
      u.onboundary = (e) => {
        if (e.name !== "word") return;
        const spoken = sentence.slice(0, e.charIndex);
        const idx = spoken.trim() ? spoken.trim().split(/\s+/).length : 0;
        setActiveCaptionWordIndex(idx);
      };
      u.onend = () => {
        i += 1;
        speakNext();
      };
      u.onerror = () => {
        setIsCaptionSpeaking(false);
        setActiveCaptionSentenceIndex(-1);
        setActiveCaptionWordIndex(-1);
      };
      window.speechSynthesis.speak(u);
    };
    window.speechSynthesis.cancel();
    speakNext();
  }, [captionText, isCaptionSpeaking]);

  useEffect(() => {
    if (showCaptionPanel) return;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsCaptionSpeaking(false);
    setActiveCaptionSentenceIndex(-1);
    setActiveCaptionWordIndex(-1);
  }, [showCaptionPanel]);

  useEffect(() => {
    if (!showCaptionPanel || !captionText.trim()) return;
    // Auto-start narration when panel opens.
    handleCaptionReadAloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCaptionPanel, captionText]);

  /**
   * Handle text click in AR overlay
   */
  const handleTextClick = useCallback(
    (text: string) => {
    console.log("📝 Text clicked:", text);
      if (speakUiEnabled && text.trim()) {
        window.speechSynthesis.cancel();
        speakText(text.trim());
      }
    },
    [speakUiEnabled]
  );

    return (
    <div className="cv-font fixed inset-0 overflow-hidden bg-black">
      {/* ─── ClearVision welcome (same flow as Start Camera) ─── */}
      {showWelcomeScreen && (
        <div className="cv-welcome-radial relative z-[200] flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#0A0E2A]">
          <div className="cv-animate-fade-up z-[1] flex flex-col items-center gap-5 px-6 text-center sm:gap-[22px]">
            <div>
              <h1 className="cv-font-mega text-center text-[2.3rem] font-extrabold leading-none tracking-tight text-white sm:text-[2.9rem]">
                Vision Enhancement
              </h1>
            </div>
            <p className="max-w-[min(100%,420px)] text-[1.05rem] font-normal leading-relaxed text-[rgba(255,255,255,0.55)] sm:text-[1.1rem]">
              Sharpen the camera in real time, read text in AR, extract text with Smart Read, and describe scenes with AI.
            </p>
            <button
              type="button"
              onClick={handleWelcomeStart}
              disabled={isLoading}
              className="mt-3 flex items-center gap-3 rounded-[50px] border-none bg-[#FFD600] px-12 py-5 font-bold text-black shadow-[0_8px_30px_rgba(255,214,0,0.4)] transition-[transform,box-shadow] hover:scale-[1.04] hover:shadow-[0_12px_44px_rgba(255,214,0,0.55)] active:scale-[0.97] disabled:opacity-60 sm:px-16 sm:text-xl"
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              Start Camera
            </button>
      </div>
        </div>
      )}

      {!showWelcomeScreen && (
        <>
      {/* Loading overlay - shows while camera is initializing */}
      {isLoading && !error && (
        <div className="fixed inset-0 flex items-center justify-center z-40 bg-black/60">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-white border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">Initializing camera...</p>
            <p className="text-gray-300 text-sm mt-2">Please wait</p>
          </div>
        </div>
      )}

      {/* Error message display */}
      {error && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80">
          <div className="bg-red-900 text-white p-6 rounded-lg max-w-sm text-center">
            <h2 className="text-xl font-bold mb-4">Camera Error</h2>
            <p className="mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowWelcomeScreen(false);
                  void startCamera();
                }}
                className="bg-white text-red-900 px-6 py-2 rounded font-semibold hover:bg-gray-100"
              >
                Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 text-white px-6 py-2 rounded font-semibold hover:bg-gray-700"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main container */}
      <div
        className="relative w-full h-full flex items-center justify-center bg-black"
        style={{ overflow: "visible" }}
      >
        {/* Enhanced canvas overlay - displays CLAHE + Zero-DCE++ enhancement */}
        {/* Raw video display - base layer */}
        {hasPermission && !isFrozen && (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              transform: facingMode === "user" ? "scaleX(-1)" : "none",
              // When contrast enhancement is active, hide raw video so only
              // the processed CLAHE canvas is visible (prevents "foggy" overlay).
              opacity: settings.contrastLevel !== "none" ? 0 : 1,
            }}
            ref={videoRef}
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Enhanced canvas overlay - displays CLAHE + Zero-DCE++ enhancement on top */}
        {/* Canvas ALWAYS in DOM for ref attachment - visibility controlled by display style */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            transform: facingMode === "user" ? "scaleX(-1)" : "none",
            // For debugging: always show enhancement canvas when camera is on
            display: hasPermission && !isFrozen ? "block" : "none",
            pointerEvents: "none",
          }}
        />

        {/* Frozen frame display — same mirror as live view when using front camera */}
        {isFrozen && frozenFrame && (
          <img
            ref={frozenFrameImgRef}
            src={frozenFrame.toDataURL()}
            alt="Frozen frame"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              transform: facingMode === "user" ? "scaleX(-1)" : "none",
            }}
          />
        )}

        {/* Text Extraction Modal */}
        <TextExtractionModal
          allText={allDetectedText}
          isOpen={showTextExtractionModal}
          speakEnabled={speakUiEnabled}
          onClose={() => setShowTextExtractionModal(false)}
        />

        {/* Smart Read processing overlay: freeze frame + spinner so OCR has time to run */}
        {isSmartReadProcessing && smartReadPreviewUrl && (
          <div className="fixed inset-0 z-[115] bg-black">
            <img
              src={smartReadPreviewUrl}
              alt="Smart Read capture"
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
              <p className="cv-font text-base font-semibold">Reading text from frame...</p>
              <p className="cv-font text-sm text-white/80">Hold still for a moment</p>
            </div>
          </div>
        )}

        {/* Zoom modal - opens when Zoom button is clicked */}
        {showZoomModal && (
          <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="cv-font w-80 max-w-[90vw] rounded-[20px] border border-[rgba(255,214,0,0.25)] bg-[#111530] p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Zoom Smart Text labels</h3>
                <Button
                  onClick={() => setShowZoomModal(false)}
                  variant="ghost"
                  size="icon"
                  className="text-[#FFD600] hover:bg-white/10 hover:text-[#FFD600]"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="mb-4 flex items-center gap-4">
                <span className="text-sm font-semibold text-[#FFD600]">1x</span>
                <Slider
                  value={[arZoom]}
                  onValueChange={(value) => setArZoom(value[0])}
                  min={1.0}
                  max={3.0}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-[#FFD600]">3x</span>
              </div>
              <div className="mb-4 text-center">
                <span className="text-2xl font-extrabold text-white">{arZoom.toFixed(1)}x</span>
              </div>
              <Button
                onClick={() => setShowZoomModal(false)}
                className="w-full rounded-[14px] bg-[#FFD600] font-extrabold text-black hover:brightness-105"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Top-left — Stop + switch (Start is on welcome screen) */}
        <div className="pointer-events-auto absolute left-[18px] top-0 z-50 flex h-[68px] items-center gap-2 pt-[env(safe-area-inset-top)] max-[480px]:left-2 max-[480px]:gap-1.5">
          {hasPermission && (
            <>
              {isLoading && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="text-sm font-medium">Waiting for camera...</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleStopWithWelcome}
                className="cv-font flex items-center gap-2.5 rounded-[50px] border-none bg-[#C62828] px-6 py-3 text-base font-bold text-white transition-colors hover:bg-[#B71C1C] max-[480px]:gap-2 max-[480px]:px-4 max-[480px]:py-2.5 max-[480px]:text-sm"
              >
                <span className="h-[13px] w-[13px] shrink-0 rounded-[3px] bg-white" aria-hidden />
                Stop
              </button>
              {canSwitch && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    speakUiHint("Switched camera");
                    switchCamera();
                  }}
                  className={`${TOP_BAR_ICON_BTN} ${TOP_BAR_GOLD_BG}`}
                  aria-label="Switch camera"
                >
                  <SwitchCamera className={TOP_BAR_ICON_INNER} aria-hidden />
                </button>
              )}
            </>
          )}
        </div>

        {/* Top bar — FPS, pipeline detail, speak, feature guide, settings */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-[68px] items-center justify-end bg-gradient-to-b from-black/90 via-black/50 to-transparent px-[18px] pt-[max(0.25rem,env(safe-area-inset-top))] max-[480px]:px-2">
          <div className="pointer-events-auto flex max-w-[min(100%,520px)] flex-wrap items-center justify-end gap-2 max-[480px]:max-w-[calc(100%-5.5rem)] max-[480px]:gap-1 sm:flex-nowrap">
            <div
              className={TOP_BAR_FPS_BOX}
              title={hasPermission ? "Approximate frames per second" : "Camera off"}
            >
              {hasPermission ? (
                <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap leading-none">
                  <span className="text-[0.7rem] font-extrabold tabular-nums sm:text-[0.75rem]">{fps}</span>
                  <span className="cv-vision-gold-text text-[0.5rem] font-bold uppercase tracking-wide opacity-95 sm:text-[0.52rem]">
                    fps
                  </span>
                </span>
              ) : (
                <span className="text-[0.55rem] font-bold leading-tight">Off</span>
              )}
            </div>

            {settings.contrastLevel !== "none" && (
              <div className="hidden max-w-[200px] gap-1 overflow-x-auto text-[10px] font-mono text-white/90 sm:flex sm:max-w-none">
                <span className="whitespace-nowrap rounded bg-black/50 px-1.5 py-1">
                  <span className="text-[#FFD600]">✓</span> {settings.contrastLevel} · {pipelineDisplay.branch}
                </span>
                <span
                  className="whitespace-nowrap rounded bg-black/50 px-1.5 py-1"
                  title="Pipeline branch by brightness (L)."
                >
                  {pipelineDisplay.branch === "bright" && "Edge"}
                  {pipelineDisplay.branch === "dim" && "CLAHE+edge"}
                  {pipelineDisplay.branch === "dark" && "CLAHE+edge+Retinex"}
                </span>
                <span className="whitespace-nowrap rounded bg-black/50 px-1.5 py-1">L={Math.round(pipelineDisplay.meanL)}</span>
            </div>
          )}

            {settings.contrastLevel !== "none" && hasPermission && (
              <div className="flex shrink-0 items-center gap-1 rounded bg-green-600/80 px-2 py-1 text-[10px] font-mono text-white animate-pulse max-[480px]:hidden">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                LIVE
            </div>
          )}
          
            <button
              type="button"
              onClick={() => {
                setSpeakUiEnabled((prev) => {
                  const next = !prev;
                  if (!next && "speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  } else if (next) {
                    announceSelection("Speak feedback on. Actions and descriptions will be read aloud.");
                  }
                  return next;
                });
              }}
              className={`${TOP_BAR_ICON_BTN} ${
                speakUiEnabled ? "cv-vision-speak-on" : TOP_BAR_GOLD_BG
              }`}
              title={
                speakUiEnabled
                  ? "Spoken feedback on. Tap to turn off."
                  : "Spoken feedback off. Tap to hear buttons and descriptions read aloud."
              }
              aria-pressed={speakUiEnabled}
              aria-label={speakUiEnabled ? "Turn off spoken feedback" : "Turn on spoken feedback"}
            >
              <div className="relative flex h-[18px] w-[18px] items-center justify-center sm:h-5 sm:w-5">
                <Speech className={TOP_BAR_ICON_INNER} aria-hidden />
                {!speakUiEnabled && (
                  <span
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <span className="h-[2px] w-[18px] rotate-45 rounded bg-current opacity-80 sm:w-5" />
                  </span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowFeatureGuide(true);
              }}
              className={`${TOP_BAR_ICON_BTN} ${TOP_BAR_GOLD_BG}`}
              aria-label="Feature guide"
            >
              <Info className={TOP_BAR_ICON_INNER} aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSettings(true);
              }}
              className={`${TOP_BAR_ICON_BTN} ${TOP_BAR_GOLD_BG}`}
              aria-label="Settings"
            >
              <Settings className={TOP_BAR_ICON_INNER} aria-hidden />
            </button>
          </div>
        </div>

        {/* Smart Scene: loading status */}
        {captionStatus && (
          <div
            style={{
              position: "fixed",
              bottom: 100,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.8)",
              color: "#FFFFFF",
              padding: "10px 20px",
              borderRadius: 20,
              fontSize: 16,
              fontWeight: 600,
              zIndex: 9999,
              whiteSpace: "nowrap",
            }}
          >
            {captionStatus}
            </div>
          )}

        {/* Smart Scene output panel */}
        {showCaptionPanel && captionText && (
          <div
            ref={captionPanelRef}
            style={{
              position: "fixed",
              bottom: 100,
              left: 16,
              right: 16,
              background: "#1a1a2e",
              color: "#FFFFFF",
              padding: 14,
              borderRadius: 12,
              fontSize: 16,
              lineHeight: 1.5,
              zIndex: 9999,
              maxHeight: "38vh",
              overflowY: "auto",
            }}
          >
            <div className="mb-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCaptionReadAloud}
                title={isCaptionSpeaking ? "Stop reading" : "Read aloud"}
                aria-label={isCaptionSpeaking ? "Stop reading" : "Read aloud"}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500"
              >
                <TtsOnIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsCaptionSpeaking(false);
                  setActiveCaptionSentenceIndex(-1);
                  setActiveCaptionWordIndex(-1);
                  setShowCaptionPanel(false);
                  setCaptionText("");
                }}
                title="Close"
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-700 text-white hover:bg-neutral-600"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="space-y-3">
              {splitSceneNarrationSentences(captionText).map((sentence, sIdx) => {
                const isActiveSentence = sIdx === activeCaptionSentenceIndex;
                const words = sentence.split(/\s+/);
                return (
                  <p
                    key={`scene-s-${sIdx}`}
                    className={`leading-relaxed ${isActiveSentence ? "rounded-md bg-white/10 px-2 py-1" : ""}`}
                  >
                    {words.map((word, wIdx) => {
                      const activeWord = isActiveSentence && wIdx === activeCaptionWordIndex;
                      return (
                        <span
                          key={`scene-s-${sIdx}-w-${wIdx}`}
                          className={activeWord ? "rounded bg-blue-500 px-1 text-white" : ""}
                        >
                          {word}
                          {wIdx < words.length - 1 ? " " : ""}
                        </span>
                      );
                    })}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* Read: loading status while enhancing */}
        {readStatus && !(showReadView && readViewOrigin === "upload" && uploadReadImmersive) && (
          <div
            style={{
              position: "fixed",
              bottom: 100,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.8)",
              color: "#FFFFFF",
              padding: "10px 20px",
              borderRadius: 20,
              fontSize: 16,
              fontWeight: 600,
              zIndex: 9999,
              whiteSpace: "nowrap",
            }}
          >
            {readStatus}
          </div>
        )}

        {/* Read view — enhanced document for reading; small speaker icon for optional TTS */}
        {showReadView && enhancedReadDataUrl && (
          <div
            ref={readViewRootRef}
            className="min-h-0 w-full"
            style={{
              position: "fixed",
              inset: 0,
              background: "#000",
              zIndex: 9998,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {readViewOrigin === "upload" && (
              <div
                className="pointer-events-auto fixed right-3 z-[10001] flex gap-2"
                style={{ top: "max(12px, env(safe-area-inset-top, 0px))" }}
              >
                {!uploadReadImmersive ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void enterUploadReadImmersive()}
                      title="Full screen — hide controls"
                      aria-label="Full screen"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm hover:bg-black/90"
                    >
                      <Maximize2 className="h-5 w-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={saveEnhancedUploadImage}
                      title="Save image to device"
                      aria-label="Save to device"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm hover:bg-black/90"
                    >
                      <Download className="h-5 w-5" aria-hidden />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void exitUploadReadImmersive()}
                      title="Exit full screen — show controls"
                      aria-label="Exit full screen"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm hover:bg-black/90"
                    >
                      <Minimize2 className="h-5 w-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={saveEnhancedUploadImage}
                      title="Save image to device"
                      aria-label="Save to device"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm hover:bg-black/90"
                    >
                      <Download className="h-5 w-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={closeReadView}
                      title="Close"
                      aria-label="Close"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm hover:bg-black/90"
                    >
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                  </>
                )}
              </div>
            )}

            <img
              src={enhancedReadDataUrl}
              alt="Enhanced document"
              style={{
                maxWidth: "100%",
                maxHeight: uploadReadImmersive && readViewOrigin === "upload" ? "100dvh" : "100%",
                width: "100%",
                flex: uploadReadImmersive && readViewOrigin === "upload" ? 1 : undefined,
                minHeight: 0,
                objectFit: "contain",
              }}
            />

            {readViewOrigin === "upload" && !uploadReadImmersive && (
              <div
                className="pointer-events-none fixed left-3 right-3 z-[9999] flex flex-col items-center gap-2"
                style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))" }}
              >
                {/* CLAHE / contrast — separate from optional AI low-light boost */}
                <div className="pointer-events-auto flex w-full max-w-lg flex-col items-center gap-1">
                  <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-[50px] border border-[rgba(255,214,0,0.25)] bg-black/75 px-3 py-2 backdrop-blur-md">
                    {(["none", "low", "medium", "high"] as const).map((level) => {
                      const labels = { none: "Off", low: "Mild", medium: "Medium", high: "Strong" } as const;
                      const active = settings.contrastLevel === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => {
                            handleSettingChange("contrastLevel", level);
                            void reapplyUploadedEnhancement(level, {
                              preserveLowLightBoost: uploadLowLightBoostApplied,
                            });
                          }}
                          className={`cv-font rounded-[50px] px-3 py-2 text-[0.82rem] font-semibold transition-colors ${
                            active
                              ? "bg-[#FFD600] font-bold text-black"
                              : "bg-transparent text-[rgba(255,255,255,0.6)] hover:text-white"
                          }`}
                        >
                          {labels[level]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Optional AI low-light enhancement (TensorFlow.js Zero-DCE++), not the same as CLAHE */}
                <div className="pointer-events-auto flex w-full max-w-lg flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void applyZeroDceToUploadedImage()}
                    title={
                      uploadLowLightBoostApplied
                        ? "Tap again to turn off and restore the image with only contrast/edges (no AI stacking)."
                        : "Tap once to apply AI low-light boost (Zero-DCE++). Tap again to turn it off. Best for dark photos; bright images may look washed out."
                    }
                    className={`cv-font flex min-h-[44px] w-full max-w-sm items-center justify-center gap-2 rounded-[50px] border px-4 py-2.5 text-[0.82rem] font-bold transition-colors ${
                      uploadLowLightBoostApplied
                        ? "border-emerald-400/90 bg-emerald-950/85 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.35)]"
                        : "border-white/20 bg-neutral-900/90 text-white hover:border-white/35 hover:bg-neutral-800/95"
                    }`}
                  >
                    {uploadLowLightBoostApplied ? (
                      <>
                        <Check className="h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2.5} aria-hidden />
                        Low-light boost on
                      </>
                    ) : (
                      "Apply low-light boost"
                    )}
                  </button>
                </div>
              </div>
            )}

            {readAloudStatus && !(readViewOrigin === "upload" && uploadReadImmersive) && (
              <div
                style={{
                  position: "fixed",
                  bottom: 56,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.8)",
                  color: "#FFF",
                  padding: "6px 12px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {readAloudStatus}
              </div>
            )}
            {!(readViewOrigin === "upload" && uploadReadImmersive) && (
            <div
              style={{
                position: "fixed",
                bottom: 16,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              {readViewOrigin !== "upload" && (
                <button
                  type="button"
                  onClick={handleReadAloudTap}
                  title="Read aloud"
                  className={`${MAIN_ROW_BTN} h-11 w-11 min-w-0 rounded-xl bg-blue-600 p-0 text-white hover:bg-blue-500`}
                >
                  <TtsOnIcon className="h-6 w-6" />
                </button>
              )}
              {readViewOrigin === "upload" && (
                <button
                  type="button"
                  onClick={handleDescribeTap}
                  title="Smart Scene"
                  className={`${MAIN_ROW_BTN} bg-violet-600 text-white hover:bg-violet-500`}
                >
                  <DescribeSceneIcon className="h-5 w-5 shrink-0" />
                  Smart Scene
                </button>
              )}
              <button
                type="button"
                onClick={closeReadView}
                className={`${MAIN_ROW_BTN} bg-neutral-700 text-white hover:bg-neutral-600`}
              >
                <X className="h-4 w-4" aria-hidden />
                Close
              </button>
            </div>
            )}
          </div>
        )}

        {/* Smart Scene processing overlay: snapshot is captured once; user can move while analysis runs */}
        {isSceneProcessing && scenePreviewUrl && (
          <div className="fixed inset-0 z-[116] bg-black">
            <img
              src={scenePreviewUrl}
              alt="Smart Scene capture"
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
              <p className="cv-font text-base font-semibold">Analyzing captured scene...</p>
              <p className="cv-font text-sm text-white/80">Snapshot captured. You can move now.</p>
            </div>
          </div>
        )}

        {/* Main screen: vision strip + optional AR toolbar + AR / Read / Describe */}
        {!showReadView && !showCaptionPanel && !isSceneProcessing && (
          <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center gap-3 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-10 max-[480px]:gap-2 max-[480px]:px-2 sm:px-4">
            {showAROverlay && isFrozen && (
              <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-[50px] border cv-vision-ar-frozen-border bg-black/80 px-3 py-2 shadow-lg backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => void handleReprocessClick()}
                  disabled={isOCRProcessing}
                  className="cv-font flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {isOCRProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                  Reprocess
                </button>
                <button
                  type="button"
                  onClick={handleCloseAR}
                  className="cv-font flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] bg-[#C62828] px-4 py-2 text-sm font-bold text-white hover:bg-[#B71C1C]"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Close Smart Text
                </button>
          </div>
        )}

            {/* Keep bottom UI mode-focused: when AR is active, show only AR controls above. */}
            {!showAROverlay && (
            <>
            {/* Centered column; enhancement pill is width-capped so it stays clearly narrower than the screen */}
            <div className="pointer-events-auto mx-auto flex w-full max-w-[640px] flex-col items-center gap-2 sm:gap-2">
              <div className="flex w-full justify-center px-2">
              <div
                className={`flex max-w-[min(21rem,calc(100vw-2.25rem))] flex-row flex-nowrap items-center justify-center gap-1.5 overflow-hidden rounded-[50px] border-[1.5px] ${ENH_GOLD_BORDER} bg-black/75 px-2.5 py-2 backdrop-blur-md sm:max-w-[min(24rem,calc(100vw-2.75rem))] sm:gap-2 sm:px-3 sm:py-2`}
              >
                <span
                  className={`cv-font flex shrink-0 items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-wide sm:text-[0.8rem] ${ENH_GOLD}`}
                >
                  <Eye className="h-[14px] w-[14px] shrink-0 sm:h-[15px] sm:w-[15px]" aria-hidden />
                  Enhancement
                </span>
                <div className="flex shrink-0 flex-nowrap items-center gap-0.5 sm:gap-1">
                  {(["none", "low", "medium", "high"] as const).map((level) => {
                    const labels = { none: "Off", low: "Mild", medium: "Medium", high: "Strong" } as const;
                    const active = settings.contrastLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => {
                          handleSettingChange("contrastLevel", level);
                          if (level === "none") speakUiHint("Enhancement off");
                          else speakUiHint(`${labels[level]} enhancement`);
                        }}
                        className={`cv-font shrink-0 rounded-[50px] px-2.5 py-1.5 text-[0.68rem] font-semibold transition-colors sm:px-3 sm:py-2 sm:text-[0.78rem] ${
                          active ? ENH_ACTIVE : "bg-transparent text-[rgba(255,255,255,0.45)] hover:text-white"
                        }`}
                      >
                        {labels[level]}
                      </button>
                    );
                  })}
                </div>
              </div>
              </div>

            {settings.contrastLevel !== "none" && (
              <div className="flex w-full justify-center px-2">
                <div
                  className={`flex max-w-[min(21rem,calc(100vw-2.25rem))] flex-nowrap items-center justify-center gap-1.5 overflow-hidden rounded-[50px] border ${ENH_GOLD_BORDER} bg-black/70 px-2.5 py-2 backdrop-blur-sm sm:max-w-[min(24rem,calc(100vw-2.75rem))] sm:gap-2 sm:px-3`}
                >
                  <span className={`cv-font px-0.5 text-[11px] font-bold uppercase tracking-wider sm:text-[12px] ${ENH_GOLD}`}>
                    Mode
                  </span>
                  {(["auto", "bright", "dim", "dark"] as const).map((mode) => {
                    const labels = { auto: "Auto", bright: "Bright", dim: "Dim", dark: "Dark" };
                    const active = settings.enhancementMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          handleSettingChange("enhancementMode", mode);
                          speakUiHint(`Mode ${labels[mode]}`);
                        }}
                        className={`cv-font min-h-[34px] rounded-[50px] px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:min-h-[38px] sm:px-3.5 sm:text-[12px] ${
                          active ? ENH_ACTIVE : "bg-transparent text-[rgba(255,255,255,0.5)] hover:text-white"
                        }`}
                      >
                        {labels[mode]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>

            <div className="pointer-events-auto grid w-full max-w-[640px] grid-cols-4 items-stretch gap-1.5 px-0.5 sm:gap-3 sm:px-1">
                      <button
                type="button"
                        onClick={() => {
                  speakUiHint("Upload image");
                  fileInputRef.current?.click();
                }}
                className={`${CV_ACTION_BTN} border border-white/15 bg-[#1a1f3d] text-[#f1f5ff] hover:border-white/25 hover:bg-[#1f2644]`}
              >
                <Upload className={`h-6 w-6 shrink-0 ${ENH_GOLD}`} aria-hidden />
                <span className="whitespace-nowrap text-center">Upload</span>
                      </button>
                      <button
                type="button"
                onClick={showAROverlay ? handleCloseAR : handleARClick}
                disabled={!hasPermission || (isOCRProcessing && !showAROverlay)}
                style={{ backgroundColor: "#0D47A1" }}
                className={CV_ACTION_BTN}
              >
                {isOCRProcessing && !showAROverlay ? (
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                ) : (
                  <SmartTextIcon className="h-6 w-6 shrink-0 text-white" />
                )}
                <span className="whitespace-nowrap text-center">Smart Text</span>
              </button>
              <button
                type="button"
                onClick={handleReadTap}
                disabled={!hasPermission}
                style={{ backgroundColor: "#1B5E20" }}
                className={CV_ACTION_BTN}
              >
                <SmartReadIcon className="h-6 w-6 shrink-0" />
                <span className="whitespace-nowrap text-center">Smart Read</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDescribeTap()}
                disabled={!hasPermission}
                style={{ backgroundColor: "#311B92" }}
                className={CV_ACTION_BTN}
              >
                <DescribeSceneIcon className="h-6 w-6 shrink-0" />
                <span className="whitespace-nowrap text-center">Smart Scene</span>
              </button>
            </div>
            </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUploadImage(file);
            e.currentTarget.value = "";
          }}
        />

        {/* Settings — bottom sheet (same options as before) */}
        {showSettings && (
          <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 backdrop-blur-sm"
            role="presentation"
            onClick={() => setShowSettings(false)}
            onKeyDown={(e) => e.key === "Escape" && setShowSettings(false)}
          >
            <div
              ref={settingsPanelRef}
              className="cv-sheet-animate cv-font max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-[28px] border-t border-[rgba(255,214,0,0.2)] bg-[#111530] px-6 pb-10 pt-2 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="cv-settings-title"
            >
              <div className="mx-auto mb-5 mt-1 h-1 w-10 rounded-full bg-[rgba(255,214,0,0.3)]" />
              <h2 id="cv-settings-title" className="mb-1 flex items-center gap-2 text-2xl font-extrabold">
                <Settings className="h-6 w-6 text-white/70" aria-hidden />
                Settings
              </h2>
              <p className="mb-6 text-[0.88rem] leading-relaxed text-[rgba(255,255,255,0.55)]">
                These options only change <strong className="text-white">how hard the device works</strong> on the live
                preview and <strong className="text-white">how Smart Text labels look</strong> (colors, size, font). Your{" "}
                <strong className="text-white">Enhancement</strong> strip on the main screen still controls contrast and
                sharpness. Tap the <strong className="text-[#FFD600]">speech</strong> icon at the top when you want buttons and
                open panels read aloud.
              </p>

              <p className="cv-font mb-3 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[#FFD600]">
                Processing speed
              </p>
              <div className="mb-6 flex gap-2.5">
                <button
                  type="button"
                        onClick={() => {
                    handleSettingChange("processQuality", "performance");
                    speakUiHint("Faster processing");
                  }}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-[14px] border-[1.5px] p-4 text-center text-[0.88rem] font-semibold leading-snug transition-colors ${
                    settings.processQuality === "performance"
                      ? "border-[#FFD600] bg-[rgba(255,214,0,0.07)] text-[#FFD600]"
                      : "border-[rgba(255,255,255,0.12)] bg-[#1a1f3d] text-[rgba(255,255,255,0.55)] hover:border-[rgba(255,214,0,0.3)]"
                  }`}
                >
                  <Zap className="h-5 w-5 text-amber-400" />
                  <span>Faster</span>
                  <span className="text-[0.75rem] font-normal opacity-90">Smaller internal frame, smoother on phones</span>
                      </button>
                      <button
                  type="button"
                        onClick={() => {
                    handleSettingChange("processQuality", "quality");
                    speakUiHint("Best quality processing");
                  }}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-[14px] border-[1.5px] p-4 text-center text-[0.88rem] font-semibold leading-snug transition-colors ${
                    settings.processQuality === "quality"
                      ? "border-[#FFD600] bg-[rgba(255,214,0,0.07)] text-[#FFD600]"
                      : "border-[rgba(255,255,255,0.12)] bg-[#1a1f3d] text-[rgba(255,255,255,0.55)] hover:border-[rgba(255,214,0,0.3)]"
                  }`}
                >
                  <Microscope className="h-5 w-5 text-slate-400" />
                  <span>Best Quality</span>
                  <span className="text-[0.75rem] font-normal opacity-90">Full-size processing, sharper detail</span>
                      </button>
                </div>

              <div className="mb-6 h-px bg-[rgba(255,255,255,0.12)]" />

              <p className="cv-font mb-3 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[#FFD600]">
                Smart Text labels{" "}
                <span className="ml-1 inline-block rounded-md border border-[rgba(255,214,0,0.3)] bg-[rgba(255,214,0,0.15)] px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-[#FFD600]">
                  High contrast helps most
                </span>
              </p>

              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="w-[100px] text-[0.88rem] font-semibold text-[rgba(255,255,255,0.55)]">Background</span>
                  <input
                    type="color"
                    value={arTextStyle.backgroundColor}
                  onChange={(e) => setArTextStyle({ ...arTextStyle, backgroundColor: e.target.value })}
                  className="h-12 w-12 cursor-pointer rounded-[10px] border-[1.5px] border-[rgba(255,214,0,0.3)] bg-transparent p-0.5"
                  aria-label="Smart Text label background color"
                />
                <span className="text-[0.78rem] text-[rgba(255,255,255,0.55)]">Strong contrast behind labels</span>
                </div>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="w-[100px] text-[0.88rem] font-semibold text-[rgba(255,255,255,0.55)]">Text color</span>
                  <input
                    type="color"
                    value={arTextStyle.textColor}
                  onChange={(e) => setArTextStyle({ ...arTextStyle, textColor: e.target.value })}
                  className="h-12 w-12 cursor-pointer rounded-[10px] border-[1.5px] border-[rgba(255,214,0,0.3)] bg-transparent p-0.5"
                  aria-label="Smart Text label text color"
                />
                <span className="text-[0.78rem] text-[rgba(255,255,255,0.55)]">Try yellow on dark gray if navy feels too strong</span>
              </div>

              <p className="cv-font mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[#FFD600]">Font size</p>
              <div className="mb-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                      setArTextStyle({
                        ...arTextStyle,
                      fontSizeMultiplier: Math.max(0.8, Math.round((arTextStyle.fontSizeMultiplier - 0.1) * 10) / 10),
                    })
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#1a1f3d] text-xl hover:border-[rgba(255,214,0,0.3)]"
                >
                  -
                </button>
                <span className="min-w-[48px] text-center text-base font-semibold">
                  {arTextStyle.fontSizeMultiplier.toFixed(1)}×
                </span>
                <button
                  type="button"
                  onClick={() =>
                      setArTextStyle({
                        ...arTextStyle,
                      fontSizeMultiplier: Math.min(2, Math.round((arTextStyle.fontSizeMultiplier + 0.1) * 10) / 10),
                    })
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#1a1f3d] text-xl hover:border-[rgba(255,214,0,0.3)]"
                >
                  +
                </button>
                <Slider
                  className="ml-2 flex-1"
                  value={[arTextStyle.fontSizeMultiplier]}
                  onValueChange={(value) => setArTextStyle({ ...arTextStyle, fontSizeMultiplier: value[0] })}
                    min={0.8}
                    max={2.0}
                    step={0.1}
                  />
                </div>

              <div className="mb-2">
                <label className="mb-2 block text-[0.88rem] font-semibold text-[rgba(255,255,255,0.55)]">Font family</label>
                  <select
                    value={arTextStyle.fontFamily}
                  onChange={(e) => setArTextStyle({ ...arTextStyle, fontFamily: e.target.value })}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#1a1f3d] p-3 text-sm text-white"
                  >
                    <option value="sans-serif">Sans-serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                  </select>
                </div>

              <div className="mb-6 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="boldText"
                    checked={arTextStyle.bold}
                  onChange={(e) => setArTextStyle({ ...arTextStyle, bold: e.target.checked })}
                  className="h-4 w-4 accent-[#FFD600]"
                />
                <label htmlFor="boldText" className="text-sm font-medium text-white/90">
                  Bold text
                  </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetSettings();
                    speakUiHint("Settings reset");
                  }}
                  className="cv-font flex-1 rounded-[14px] border border-[rgba(255,255,255,0.2)] py-4 text-sm font-bold text-white hover:bg-white/5"
                >
                  Reset
                </button>
              </div>
              <button
                type="button"
                  onClick={() => setShowSettings(false)}
                className="cv-font mt-3 w-full rounded-[14px] bg-[#FFD600] py-4 text-base font-extrabold text-black hover:brightness-105"
                >
                Done
              </button>
              </div>
          </div>
        )}

        {/* Feature guide — accurate feature descriptions */}
        {showFeatureGuide && (
          <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 backdrop-blur-sm"
            role="presentation"
            onClick={() => setShowFeatureGuide(false)}
            onKeyDown={(e) => e.key === "Escape" && setShowFeatureGuide(false)}
          >
            <div
              ref={featureGuidePanelRef}
              className="cv-sheet-animate cv-font max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-[28px] border-t border-[rgba(255,214,0,0.2)] bg-[#111530] px-6 pb-10 pt-2 text-white"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="cv-info-title"
            >
              <div className="mx-auto mb-5 mt-1 h-1 w-10 rounded-full bg-[rgba(255,214,0,0.3)]" />
              <h2 id="cv-info-title" className="mb-5 text-2xl font-extrabold">
                Feature Guide
              </h2>

              <div className="mb-3.5 rounded-2xl border border-[rgba(255,214,0,0.45)] bg-[#1a1f3d] p-[18px]">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,214,0,0.2)] text-[#FFD600]">
                    <Contrast className="h-6 w-6" strokeWidth={2.25} aria-hidden />
                  </div>
                  <div className="text-base font-bold leading-snug">
                    Contrast and edge enhancement{" "}
                    <span className="font-semibold text-white">(live)</span>
                  </div>
                </div>
                <p className="mb-2 text-[0.88rem] leading-relaxed text-white">
                  Use the bottom <strong className="text-white">Enhancement</strong> strip to choose Off, Mild, Medium, or
                  Strong for the <strong className="text-white">live camera</strong>. While it is on, OpenCV.js applies{" "}
                  <strong className="text-white">CLAHE</strong> for local contrast, an <strong className="text-white">unsharp</strong>{" "}
                  mask on brightness for crisper edges, and in very dark scenes adds <strong className="text-white">Retinex</strong>{" "}
                  for shadow detail. <strong className="text-white">Mode</strong> (Auto, Bright, Dim, Dark) follows average
                  brightness or locks to a branch you prefer. The same controls appear on the <strong className="text-white">upload</strong>{" "}
                  screen for that photo only. Everything here runs locally and is separate from Google Vision, Tesseract, and
                  the optional Zero-DCE++ toggle on uploads.
                </p>
                <div className="text-[0.75rem] font-bold uppercase tracking-wider text-[#FFD600]">Technique</div>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-white">
                  OpenCV.js CLAHE for contrast, luminance unsharp mask for edges, optional WebGL Retinex, adaptive or manual
                  mode from mean brightness.
                </p>
              </div>

              <div className="mb-3.5 rounded-2xl border border-[rgba(13,71,161,0.4)] bg-[#1a1f3d] p-[18px]">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#0D47A1]">
                    <SmartTextIcon className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-base font-bold">Smart Text</div>
                </div>
              <p className="mb-2 text-[0.88rem] leading-relaxed text-white">
                  Tap once and the app <strong className="text-white">freezes what the camera sees right now</strong>, sends
                  that still image to your server, then paints a bold label on each word it finds. If Enhancement is on, the
                  same contrast and edge settings are applied to that snapshot before OCR. Change Enhancement while frozen,
                  then tap <strong className="text-white">Reprocess</strong> to run recognition again. For long passages, search,
                  and read-aloud in a full-screen reader, use <strong className="text-white">Smart Read</strong> instead.
                </p>
                <div className="text-[0.75rem] font-bold uppercase tracking-wider text-[#FFD600]">Technique</div>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-white">
                  Google Cloud Vision on the server; high-contrast overlays in the browser. Optional OpenCV CLAHE and
                  sharpening on the frozen frame when presets are enabled.
                </p>
              </div>

              <div className="mb-3.5 rounded-2xl border border-[rgba(27,94,32,0.4)] bg-[#1a1f3d] p-[18px]">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#1B5E20]">
                    <SmartReadIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-base font-bold">Smart Read</div>
                </div>
              <p className="mb-2 text-[0.88rem] leading-relaxed text-white">
                  When you tap Smart Read, the app grabs <strong className="text-white">one clear snapshot</strong> (with a
                  short loading state), runs <strong className="text-white">Tesseract.js</strong> entirely on your device, and
                  opens a full-screen reader. Text is split into sentences with highlighting; matches light up when you{" "}
                  <strong className="text-white">search</strong> (type or use voice). Use the reader&apos;s{" "}
                  <strong className="text-white">Read</strong> button for speech—no need to turn on the top-bar speech toggle
                  first. This path never runs <strong className="text-white">Zero-DCE++</strong>; the optional AI low-light
                  boost stays on <strong className="text-white">uploaded</strong> photos only.
                </p>
                <div className="text-[0.75rem] font-bold uppercase tracking-wider text-[#FFD600]">Technique</div>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-white">
                  Tesseract.js LSTM with several page layouts and image variants (including binarization) so documents read
                  cleaner; Web Speech API for read-aloud and optional auto-read on open.
                </p>
              </div>

              <div className="mb-3.5 rounded-2xl border border-[rgba(49,27,146,0.4)] bg-[#1a1f3d] p-[18px]">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#311B92]">
                    <DescribeSceneIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-base font-bold">Smart Scene</div>
                </div>
                <p className="mb-2 text-[0.88rem] leading-relaxed text-white">
                  You get <strong className="text-white">one still picture</strong>—not a live minute-by-minute feed—from the{" "}
                  <strong className="text-white">camera</strong> or from the <strong className="text-white">upload</strong>{" "}
                  preview. After a few moments of on-device work, a panel opens with a longer, plain-language description. The
                  pipeline stays in the browser: <strong className="text-white">COCO-SSD</strong> lists likely objects, then{" "}
                  <strong className="text-white">SmolVLM</strong> (Transformers.js) turns the image plus that list into text; if
                  SmolVLM cannot load, <strong className="text-white">vit-gpt2 image captioning</strong> fills in with the same
                  hints. You can have the description read aloud from the panel. <strong className="text-white">Zero-DCE++</strong>{" "}
                  is not used here.
                </p>
                <div className="text-[0.75rem] font-bold uppercase tracking-wider text-[#FFD600]">Technique</div>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-white">
                  TensorFlow.js COCO-SSD; Transformers.js (SmolVLM or Xenova vit-gpt2 captioning fallback). Web Speech API
                  when speech is enabled. First run may download model weights.
                </p>
              </div>

              <div className="mb-6 rounded-2xl border border-[rgba(255,214,0,0.35)] bg-[#1a1f3d] p-[18px]">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,214,0,0.2)] text-[#FFD600]">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="text-base font-bold">Upload</div>
                </div>
              <p className="mb-2 text-[0.88rem] leading-relaxed text-white">
                  Choose a photo from your device. The full-screen view has two independent controls:{" "}
                  <strong className="text-white">Contrast &amp; edges</strong> (Off/Mild/Medium/Strong) uses the same OpenCV.js
                  path as live Enhancement. Below that, <strong className="text-white">Apply low-light boost</strong> is a{" "}
                  <strong className="text-white">toggle</strong>: one tap applies Zero-DCE++ once on your contrast/edges
                  preview; tap again to turn it off and restore contrast-only from the original file (it does not stack
                  multiple AI passes). Best for dark photos; bright images may look washed out. If low-light boost is already
                  on, changing Off/Mild/Medium/Strong <strong className="text-white">rebuilds contrast from the original</strong>{" "}
                  and <strong className="text-white">re-applies</strong> the boost on top so order does not matter.{" "}
                  <strong className="text-white">Smart Scene</strong> uses the scene pipeline above when this view is open.
                </p>
                <div className="text-[0.75rem] font-bold uppercase tracking-wider text-[#FFD600]">Technique</div>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-white">
                  OpenCV.js CLAHE, unsharp mask, Retinex when the pipeline selects the dark branch. Optional TensorFlow.js
                  Zero-DCE++ graph model for AI low-light boost only on upload.
                </p>
              </div>

              <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#1a1f3d] p-[18px]">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,255,255,0.08)] text-[#FFD600]">
                    <Speech className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="text-base font-bold">Read aloud &amp; spoken UI</div>
                </div>
              <p className="mb-2 text-[0.88rem] leading-relaxed text-white">
                  The <strong className="text-white">speech</strong> icon in the top bar is for short spoken hints and, when a
                  guide or settings sheet is open, an overview of what is on that sheet. It is not a full-screen reader by
                  itself. <strong className="text-white">Smart Read</strong> and <strong className="text-white">Smart Scene</strong> each
                  include their own speaker controls for long passages.
                </p>
                <div className="text-[0.75rem] font-bold uppercase tracking-wider text-[#FFD600]">Technique</div>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-white">
                Web Speech API (<code className="text-white">speechSynthesis</code>).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowFeatureGuide(false)}
                className="w-full rounded-[14px] bg-[#FFD600] py-4 text-base font-extrabold text-black hover:brightness-105"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* AR Text Overlay - HTML divs with navy blue backgrounds */}
        {showAROverlay && isFrozen && frozenFrameImgRef.current && (
          <ARTextOverlay
            displayElement={frozenFrameImgRef.current}
            textBoxes={arTextBoxes}
            isEnabled={showAROverlay}
            onTextClick={handleTextClick}
            textStyle={arTextStyle}
            zoom={arZoom}
          />
        )}
      </div>
        </>
      )}
    </div>
  );
}

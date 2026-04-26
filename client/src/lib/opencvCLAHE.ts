/**
 * OpenCV.js CLAHE — uses official build from docs.opencv.org/4.10.0/opencv.js
 * Load that script in index.html; this module resolves cv (handles Promise) and applies CLAHE on LAB L.
 */

const OPENCV_CDN = 'https://docs.opencv.org/4.10.0/opencv.js';

let cvResolved: any = null;
let initPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No document'));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/** Resolve global cv (official build can expose cv as a Promise). Poll briefly if not ready. */
async function getCv(): Promise<any> {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  if (!w) return null;
  for (let i = 0; i < 100; i++) {
    let cv = w.cv;
    if (cv) {
      if (cv instanceof Promise) cv = await cv;
      if (cv && typeof cv.createCLAHE === 'function') return cv;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

export async function initializeOpenCV(): Promise<void> {
  if (cvResolved) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      await loadScript(OPENCV_CDN);
      const cv = await getCv();
      if (cv) {
        cvResolved = cv;
      }
    } catch (e) {
      console.error('[OpenCV CLAHE] Init failed:', e);
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

export function isOpenCVReady(): boolean {
  return cvResolved != null && typeof cvResolved.createCLAHE === 'function';
}

/**
 * Apply CLAHE to canvas (bright room): LAB L-channel only, then merge back.
 * Uses official OpenCV.js createCLAHE(clipLimit, new cv.Size(8,8)).
 */
export async function applyCLAHEBrightRoom(
  canvas: HTMLCanvasElement,
  clipLimit: number = 2.0
): Promise<void> {
  if (!isOpenCVReady() || canvas.width < 10 || canvas.height < 10) return;

  const cv = cvResolved;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    console.log('[OpenCV CLAHE] DEBUG grayscale test running');
    // DEBUG: make the whole image grayscale using OpenCV so the change is obvious.
    // If you do NOT see a grayscale image when contrast is ENABLED, the overlay path is broken.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const src = cv.matFromImageData(imageData);

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    src.delete();

    const rgbaOut = new cv.Mat();
    cv.cvtColor(gray, rgbaOut, cv.COLOR_GRAY2RGBA);
    gray.delete();

    cv.imshow(canvas, rgbaOut);
    rgbaOut.delete();
  } catch (e) {
    console.error('[OpenCV CLAHE]', e);
  }
}

export async function applyCLAHEDarkRoom(
  canvas: HTMLCanvasElement,
  clipLimit: number = 2.0
): Promise<void> {
  await applyCLAHEBrightRoom(canvas, clipLimit);
}

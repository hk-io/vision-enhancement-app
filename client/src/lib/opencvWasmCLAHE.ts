/**
 * OpenCV CLAHE Enhancement
 * Uses global cv object loaded from CDN (opencv.js)
 */

let cvReady = false;

export async function initializeOpenCVWasm(): Promise<void> {
  if (cvReady) {
    return;
  }

  // Wait for cv object to be available - timeout after 5 seconds
  const maxAttempts = 10; // 5 seconds at 500ms intervals
  let attempts = 0;

  return new Promise((resolve) => {
    const checkCV = () => {
      const cv = (globalThis as any).cv;
      
      if (cv && cv.createCLAHE && cv.Mat && cv.cvtColor) {
        cvReady = true;
        console.log('✓ OpenCV.js loaded successfully with CLAHE support');
        resolve();
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkCV, 500);
      } else {
        console.warn('⚠ OpenCV.js not available after 5 seconds - enhancement disabled');
        resolve(); // Resolve anyway to not block the app
      }
    };

    checkCV();
  });
}

export function isOpenCVWasmReady(): boolean {
  const cv = (globalThis as any).cv;
  return cvReady && cv && cv.createCLAHE && cv.Mat && cv.cvtColor;
}

export function getOpenCVWasm(): any {
  const cv = (globalThis as any).cv;
  if (!cv || !cv.createCLAHE) {
    throw new Error('OpenCV.js not initialized');
  }
  return cv;
}

/**
 * Apply CLAHE enhancement to canvas using OpenCV
 */
export async function applyCLAHEToCanvas(
  canvas: HTMLCanvasElement,
  clipLimit: number = 2.0,
  tileGridSize: number = 8
): Promise<void> {
  if (!isOpenCVWasmReady()) {
    console.warn('OpenCV.js not ready, skipping CLAHE');
    return;
  }

  const cv = getOpenCVWasm();
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    // Get image data from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create Mat from image data
    const src = cv.matFromImageData(imageData);
    
    // Convert RGBA to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Apply CLAHE
    const clahe = cv.createCLAHE(clipLimit, new cv.Size(tileGridSize, tileGridSize));
    const enhanced = new cv.Mat();
    clahe.apply(gray, enhanced);
    
    // Convert back to RGBA
    const result = new cv.Mat();
    cv.cvtColor(enhanced, result, cv.COLOR_GRAY2RGBA);
    
    // Copy result back to canvas
    ctx.putImageData(new ImageData(result.data, result.cols, result.rows), 0, 0);
    
    // Clean up
    src.delete();
    gray.delete();
    enhanced.delete();
    result.delete();
    clahe.delete();
  } catch (error) {
    console.error('✗ Error applying CLAHE:', error);
  }
}

/**
 * Apply CLAHE with brightness adjustment for dark room mode
 */
export async function applyCLAHEWithBrightnessToCanvas(
  canvas: HTMLCanvasElement,
  brightnessFactor: number = 1.5,
  clipLimit: number = 3.0,
  tileGridSize: number = 8
): Promise<void> {
  if (!isOpenCVWasmReady()) {
    console.warn('OpenCV.js not ready, skipping CLAHE with brightness');
    return;
  }

  const cv = getOpenCVWasm();
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    // Get image data from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create Mat from image data
    const src = cv.matFromImageData(imageData);
    
    // Convert RGBA to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Apply CLAHE
    const clahe = cv.createCLAHE(clipLimit, new cv.Size(tileGridSize, tileGridSize));
    const enhanced = new cv.Mat();
    clahe.apply(gray, enhanced);
    
    // Adjust brightness
    const brightened = new cv.Mat();
    enhanced.convertTo(brightened, -1, brightnessFactor, 0);
    
    // Convert back to RGBA
    const result = new cv.Mat();
    cv.cvtColor(brightened, result, cv.COLOR_GRAY2RGBA);
    
    // Copy result back to canvas
    ctx.putImageData(new ImageData(result.data, result.cols, result.rows), 0, 0);
    
    // Clean up
    src.delete();
    gray.delete();
    enhanced.delete();
    brightened.delete();
    result.delete();
    clahe.delete();
  } catch (error) {
    console.error('✗ Error applying CLAHE with brightness:', error);
  }
}

/**
 * Legacy function for compatibility
 */
export function applyCLAHE(
  imageData: ImageData,
  clipLimit: number = 2.0,
  tileGridSize: number = 8
): ImageData {
  if (!isOpenCVWasmReady()) {
    console.warn('OpenCV.js not initialized, returning original ImageData');
    return imageData;
  }

  const cv = getOpenCVWasm();
  let src: any = null;
  let gray: any = null;
  let clahe: any = null;
  let enhanced: any = null;
  let result: any = null;

  try {
    src = cv.matFromImageData(imageData);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    clahe = cv.createCLAHE(clipLimit, new cv.Size(tileGridSize, tileGridSize));
    enhanced = new cv.Mat();
    clahe.apply(gray, enhanced);

    result = new cv.Mat();
    cv.cvtColor(enhanced, result, cv.COLOR_GRAY2RGBA);

    const outputImageData = new ImageData(
      new Uint8ClampedArray(result.data),
      result.cols,
      result.rows
    );

    return outputImageData;
  } catch (error) {
    console.error('Error in applyCLAHE:', error);
    return imageData;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (enhanced) enhanced.delete();
    if (result) result.delete();
    if (clahe) clahe.delete();
  }
}

/**
 * Legacy function for compatibility
 */
export function applyCLAHEWithBrightness(
  imageData: ImageData,
  brightnessFactor: number = 1.5,
  clipLimit: number = 3.0,
  tileGridSize: number = 8
): ImageData {
  if (!isOpenCVWasmReady()) {
    console.warn('OpenCV.js not initialized, returning original ImageData');
    return imageData;
  }

  const cv = getOpenCVWasm();
  let src: any = null;
  let gray: any = null;
  let clahe: any = null;
  let enhanced: any = null;
  let brightened: any = null;
  let result: any = null;

  try {
    src = cv.matFromImageData(imageData);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    clahe = cv.createCLAHE(clipLimit, new cv.Size(tileGridSize, tileGridSize));
    enhanced = new cv.Mat();
    clahe.apply(gray, enhanced);

    brightened = new cv.Mat();
    enhanced.convertTo(brightened, -1, brightnessFactor, 0);

    result = new cv.Mat();
    cv.cvtColor(brightened, result, cv.COLOR_GRAY2RGBA);

    const outputImageData = new ImageData(
      new Uint8ClampedArray(result.data),
      result.cols,
      result.rows
    );

    return outputImageData;
  } catch (error) {
    console.error('Error in applyCLAHEWithBrightness:', error);
    return imageData;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (clahe) clahe.delete();
    if (enhanced) enhanced.delete();
    if (brightened) brightened.delete();
    if (result) result.delete();
  }
}

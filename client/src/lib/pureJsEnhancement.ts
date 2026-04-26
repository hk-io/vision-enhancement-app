/**
 * Smooth Pure JavaScript Vision Enhancement Pipeline
 * No tiles, no pixelation - uses global histogram equalization
 * 
 * Step 1: Global histogram equalization for smooth contrast boost
 * Step 2: Fast unsharp mask for edge sharpening
 * Step 3: Saturation boost in HSV space
 */

export type EnhancementLevel = 'low' | 'medium' | 'high' | 'none';

interface EnhancementConfig {
  histogramStrength: number;
  unsharpAmount: number;
  saturationBoost: number;
}

const ENHANCEMENT_CONFIGS: Record<EnhancementLevel, EnhancementConfig> = {
  none: {
    histogramStrength: 0.0,
    unsharpAmount: 0.0,
    saturationBoost: 1.0,
  },
  low: {
    histogramStrength: 0.5,
    unsharpAmount: 0.5,
    saturationBoost: 1.3,
  },
  medium: {
    histogramStrength: 0.7,
    unsharpAmount: 0.8,
    saturationBoost: 1.5,
  },
  high: {
    histogramStrength: 0.9,
    unsharpAmount: 1.2,
    saturationBoost: 1.8,
  },
};

// ============================================================================
// Fast Brightness Calculation (Luminance)
// ============================================================================

function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ============================================================================
// Global Histogram Equalization (No Tiles = No Pixelation)
// ============================================================================

function applyGlobalHistogramEqualization(
  imageData: ImageData,
  strength: number
): void {
  const data = imageData.data;

  // Compute histogram of luminance
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = getLuminance(r, g, b);
    const bin = Math.min(255, Math.max(0, Math.round(lum)));
    hist[bin]++;
  }

  // Compute CDF (Cumulative Distribution Function)
  const cdf = new Array(256).fill(0);
  cdf[0] = hist[0];
  for (let i = 1; i < hist.length; i++) {
    cdf[i] = cdf[i - 1] + hist[i];
  }

  // Normalize CDF to 0-255 range
  const pixelCount = imageData.width * imageData.height;
  const cdfMin = cdf.find(v => v > 0) || 1;
  const cdfScale = 255 / (pixelCount - cdfMin);

  const lut = new Array(256);
  for (let i = 0; i < 256; i++) {
    const equalized = Math.round((cdf[i] - cdfMin) * cdfScale);
    // Blend with original using strength parameter
    lut[i] = Math.round(i + (equalized - i) * strength);
  }

  // Apply LUT to image
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = getLuminance(r, g, b);
    const lumBin = Math.min(255, Math.max(0, Math.round(lum)));
    const newLum = lut[lumBin];

    // Apply brightness change while preserving color
    const factor = newLum / Math.max(1, lum);
    const clampedFactor = Math.min(2.0, Math.max(0.5, factor));

    data[i] = Math.min(255, Math.round(r * clampedFactor));
    data[i + 1] = Math.min(255, Math.round(g * clampedFactor));
    data[i + 2] = Math.min(255, Math.round(b * clampedFactor));
  }
}

// ============================================================================
// Fast Unsharp Mask with Gaussian Approximation
// ============================================================================

function applyFastUnsharpMask(imageData: ImageData, amount: number): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Create blurred copy using fast Gaussian approximation (3x3 kernel)
  const blurred = new Uint8ClampedArray(data.length);
  blurred.set(data);

  // Fast 3x3 Gaussian blur
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kernelSum = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c;
            sum += blurred[idx] * kernel[ki];
            ki++;
          }
        }

        const idx = (y * width + x) * 4 + c;
        blurred[idx] = Math.round(sum / kernelSum);
      }
    }
  }

  // Apply unsharp mask: original + amount * (original - blurred)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const original = data[i + c];
      const blur = blurred[i + c];
      const sharpened = original + amount * (original - blur);
      data[i + c] = Math.max(0, Math.min(255, Math.round(sharpened)));
    }
  }
}

// ============================================================================
// Fast Saturation Boost using HSV
// ============================================================================

function boostSaturationFast(imageData: ImageData, multiplier: number): void {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Skip if grayscale
    if (delta === 0) continue;

    // Calculate hue
    let h = 0;
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / delta + 2) / 6;
    else h = ((r - g) / delta + 4) / 6;

    // Boost saturation
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    const boostedS = Math.min(1, s * multiplier);

    // Convert back to RGB
    const c = v * boostedS;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = v - c;

    let newR = 0, newG = 0, newB = 0;
    if (h < 1 / 6) [newR, newG, newB] = [c, x, 0];
    else if (h < 2 / 6) [newR, newG, newB] = [x, c, 0];
    else if (h < 3 / 6) [newR, newG, newB] = [0, c, x];
    else if (h < 4 / 6) [newR, newG, newB] = [0, x, c];
    else if (h < 5 / 6) [newR, newG, newB] = [x, 0, c];
    else [newR, newG, newB] = [c, 0, x];

    data[i] = Math.round((newR + m) * 255);
    data[i + 1] = Math.round((newG + m) * 255);
    data[i + 2] = Math.round((newB + m) * 255);
  }
}

// ============================================================================
// Main Enhancement Function with Frame Skipping
// ============================================================================

export interface EnhancementResult {
  meanBrightness: number;
  isDarkRoom: boolean;
}

let frameCounter = 0;
let lastEnhancedFrame = -1;

export function applyPureJsEnhancement(
  canvas: HTMLCanvasElement,
  level: EnhancementLevel = 'medium'
): EnhancementResult {
  try {
    // If user selected 'none', skip enhancement entirely
    if (level === 'none') {
      return { meanBrightness: 0, isDarkRoom: false };
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { meanBrightness: 0, isDarkRoom: false };
    }

    frameCounter++;
    const config = ENHANCEMENT_CONFIGS[level];

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate mean brightness
    let brightnessSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      brightnessSum += getLuminance(r, g, b);
    }
    const meanBrightness = brightnessSum / (imageData.width * imageData.height);

    // Log every 30 frames
    if (frameCounter % 30 === 0) {
      console.log(`📊 Frame brightness: ${meanBrightness.toFixed(1)}`);
    }

    // Route to Zero-DCE++ if dark
    if (meanBrightness < 30) {
      if (frameCounter % 30 === 0) {
        console.log(`🌙 Dark room detected (${meanBrightness.toFixed(1)} < 30)`);
      }
      return { meanBrightness, isDarkRoom: true };
    }

    // Always process and display frames (no skipping to avoid flashing)
    // The enhancement itself is fast enough at this resolution

    // Apply three-step enhancement (only if not 'none')
    if (config.histogramStrength > 0) {
      applyGlobalHistogramEqualization(imageData, config.histogramStrength);
    }
    if (config.unsharpAmount > 0) {
      applyFastUnsharpMask(imageData, config.unsharpAmount);
    }
    if (config.saturationBoost !== 1.0) {
      boostSaturationFast(imageData, config.saturationBoost);
    }

    // Put back to canvas
    ctx.putImageData(imageData, 0, 0);

    if (frameCounter % 30 === 0) {
      console.log(`🎨 Pure JS - Level=${level} | Histogram=${config.histogramStrength} | Sharpen=${config.unsharpAmount} | Saturation=${config.saturationBoost}`);
    }

    return { meanBrightness, isDarkRoom: false };
  } catch (error) {
    console.error('❌ Pure JS enhancement error:', error);
    return { meanBrightness: 0, isDarkRoom: false };
  }
}

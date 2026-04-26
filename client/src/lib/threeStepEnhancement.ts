/**
 * Three-Step Vision Enhancement Pipeline using OpenCV.js only
 *
 * Bright Room (brightness ≥ 30): OpenCV CLAHE on LAB L channel only
 * Dark Room (brightness < 30): OpenCV CLAHE + WebGL Retinex shader
 * No JavaScript fallback — requires real OpenCV CLAHE.
 */

import { RetinexShader } from './retinexShader';
import { initializeOpenCV, isOpenCVReady, applyCLAHEBrightRoom, applyCLAHEDarkRoom } from './opencvCLAHE';

export type EnhancementLevel = 'low' | 'medium' | 'high' | 'none';

interface EnhancementConfig {
  clipLimit: number;
  retinexStrength?: number; // For dark room mode
}

const ENHANCEMENT_CONFIGS: Record<EnhancementLevel, EnhancementConfig> = {
  none: {
    clipLimit: 0.0,
  },
  low: {
    clipLimit: 1.0,
    retinexStrength: 0.3,
  },
  medium: {
    clipLimit: 2.0,
    retinexStrength: 0.6,
  },
  high: {
    clipLimit: 3.5,
    retinexStrength: 0.9,
  },
};

let retinexShader: RetinexShader | null = null;
let frameCounter = 0;
let opencvInitialized = false;

/**
 * Calculate mean brightness of canvas
 */
function calculateBrightness(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 128;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sum += (r + g + b) / 3;
  }

  return sum / (data.length / 4);
}

/**
 * Apply three-step enhancement pipeline
 * Step 1: Calculate brightness to determine room conditions
 * Step 2: Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * Step 3: Apply Retinex shader in dark room mode for tone mapping
 */
export async function applyThreeStepEnhancement(
  canvas: HTMLCanvasElement,
  level: EnhancementLevel = 'medium'
): Promise<void> {
  console.log('📊 [threeStepEnhancement] applyThreeStepEnhancement called with level:', level);
  if (level === 'none') {
    console.log('📊 [threeStepEnhancement] Level is none, skipping');
    return;
  }

  // Initialize OpenCV on first use
  if (!opencvInitialized) {
    console.log('📊 [threeStepEnhancement] Initializing OpenCV...');
    await initializeOpenCV();
    opencvInitialized = isOpenCVReady();
    console.log('📊 [threeStepEnhancement] OpenCV initialized:', opencvInitialized);
  }

  if (!isOpenCVReady()) {
    console.error('📊 [threeStepEnhancement] OpenCV not ready — ensure /opencv.js loads (no fallback).');
    return;
  }

  try {
    const brightness = calculateBrightness(canvas);
    const isDarkRoom = brightness < 30;
    console.log('📊 [threeStepEnhancement] Brightness:', brightness, 'isDarkRoom:', isDarkRoom);

    const config = ENHANCEMENT_CONFIGS[level];
    if (!config) {
      console.error('📊 [threeStepEnhancement] No config for level:', level);
      return;
    }

    if (isDarkRoom) {
      console.log('📊 [threeStepEnhancement] Dark room mode, applying CLAHE + Retinex');
      // Dark room: Apply CLAHE + WebGL Retinex shader
      await applyCLAHEDarkRoom(canvas, config.clipLimit);
      
      // Apply WebGL Retinex shader for tone mapping
      if (!retinexShader) {
        retinexShader = new RetinexShader(canvas, canvas.width, canvas.height);
      }
      
      const retinexStrength = config.retinexStrength || 0.6;
      retinexShader.apply(canvas, retinexStrength);
    } else {
      console.log('📊 [threeStepEnhancement] Bright room mode, applying CLAHE only');
      // Bright room: Apply CLAHE only
      await applyCLAHEBrightRoom(canvas, config.clipLimit);
    }
    console.log('📊 [threeStepEnhancement] Enhancement complete');
  } catch (error) {
    console.error('📊 [threeStepEnhancement] Enhancement error:', error);
  }
}

/**
 * Pure JavaScript CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * No external dependencies - works directly with canvas ImageData
 */

export function applyCLAHE(
  canvas: HTMLCanvasElement,
  clipLimit: number = 2.0,
  tileSize: number = 8
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Convert RGBA to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Apply CLAHE
  const enhanced = claheProcess(gray, width, height, tileSize, clipLimit);

  // Convert back to RGBA
  for (let i = 0; i < data.length; i += 4) {
    const val = enhanced[i / 4];
    data[i] = val;     // R
    data[i + 1] = val; // G
    data[i + 2] = val; // B
    // data[i + 3] = 255; // A (unchanged)
  }

  ctx.putImageData(imageData, 0, 0);
}

function claheProcess(
  gray: Uint8Array,
  width: number,
  height: number,
  tileSize: number,
  clipLimit: number
): Uint8Array {
  const result = new Uint8Array(gray.length);
  const numTilesX = Math.ceil(width / tileSize);
  const numTilesY = Math.ceil(height / tileSize);

  // Process each tile
  for (let ty = 0; ty < numTilesY; ty++) {
    for (let tx = 0; tx < numTilesX; tx++) {
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, width);
      const y1 = Math.min(y0 + tileSize, height);

      // Calculate histogram for this tile
      const hist = new Uint32Array(256);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * width + x;
          hist[gray[idx]]++;
        }
      }

      // Apply clip limit
      const pixelsInTile = (x1 - x0) * (y1 - y0);
      const limit = Math.max(1, Math.ceil(clipLimit * pixelsInTile / 256));
      let clipped = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > limit) {
          clipped += hist[i] - limit;
          hist[i] = limit;
        }
      }

      // Redistribute clipped pixels
      if (clipped > 0) {
        const increment = clipped / 256;
        for (let i = 0; i < 256; i++) {
          hist[i] += increment;
        }
      }

      // Create LUT (Look-Up Table) for this tile
      const lut = new Uint8Array(256);
      let sum = 0;
      const scale = 255 / pixelsInTile;
      for (let i = 0; i < 256; i++) {
        sum += hist[i];
        lut[i] = Math.round(sum * scale);
      }

      // Apply LUT to tile pixels
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * width + x;
          result[idx] = lut[gray[idx]];
        }
      }
    }
  }

  return result;
}

/**
 * Apply CLAHE with brightness boost for dark room mode
 */
export function applyCLAHEWithBrightness(
  canvas: HTMLCanvasElement,
  brightnessFactor: number = 1.5,
  clipLimit: number = 3.0,
  tileSize: number = 8
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Convert RGBA to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Apply CLAHE
  const enhanced = claheProcess(gray, width, height, tileSize, clipLimit);

  // Apply brightness boost and convert back to RGBA
  for (let i = 0; i < data.length; i += 4) {
    const val = Math.min(255, Math.round(enhanced[i / 4] * brightnessFactor));
    data[i] = val;     // R
    data[i + 1] = val; // G
    data[i + 2] = val; // B
    // data[i + 3] = 255; // A (unchanged)
  }

  ctx.putImageData(imageData, 0, 0);
}

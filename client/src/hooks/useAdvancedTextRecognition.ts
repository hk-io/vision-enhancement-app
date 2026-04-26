import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

export interface TextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export function useAdvancedTextRecognition() {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const frameHistoryRef = useRef<Map<string, number>>(new Map()); // Track text across frames

  useEffect(() => {
    const initWorker = async () => {
      try {
        console.log('Initializing Tesseract worker for advanced pipeline...');
        const worker = await Tesseract.createWorker('eng', 1, {
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5/tesseract-core.wasm.js',
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5/dist/worker.min.js',
        });
        workerRef.current = worker;
        setIsReady(true);
        console.log('Tesseract worker ready for advanced pipeline');
      } catch (error) {
        console.error('Failed to initialize Tesseract:', error);
        setIsReady(false);
      }
    };

    initWorker();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate().catch(console.error);
      }
    };
  }, []);

  /**
   * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
   * for better contrast in complex lighting conditions
   */
  const applyCLAHE = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // Apply adaptive histogram equalization (simplified CLAHE)
    const tileSize = 32;
    const clipLimit = 2.0;

    for (let ty = 0; ty < canvas.height; ty += tileSize) {
      for (let tx = 0; tx < canvas.width; tx += tileSize) {
        const tileH = Math.min(tileSize, canvas.height - ty);
        const tileW = Math.min(tileSize, canvas.width - tx);

        // Calculate histogram for this tile
        const hist = new Array(256).fill(0);
        for (let y = ty; y < ty + tileH; y++) {
          for (let x = tx; x < tx + tileW; x++) {
            const idx = (y * canvas.width + x) * 4;
            hist[data[idx]]++;
          }
        }

        // Apply clip limit
        const avgBinSize = (tileW * tileH) / 256;
        const clipThreshold = Math.max(1, clipLimit * avgBinSize);
        let clipped = 0;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > clipThreshold) {
            clipped += hist[i] - clipThreshold;
            hist[i] = clipThreshold;
          }
        }

        // Redistribute clipped pixels
        const redistBinSize = clipped / 256;
        for (let i = 0; i < 256; i++) {
          hist[i] += redistBinSize;
        }

        // Calculate CDF
        const cdf = new Array(256);
        cdf[0] = hist[0];
        for (let i = 1; i < 256; i++) {
          cdf[i] = cdf[i - 1] + hist[i];
        }

        // Normalize CDF
        const cdfMin = cdf[0];
        const cdfMax = cdf[255];
        for (let i = 0; i < 256; i++) {
          cdf[i] = Math.round(((cdf[i] - cdfMin) / (cdfMax - cdfMin)) * 255);
        }

        // Apply equalization to tile
        for (let y = ty; y < ty + tileH; y++) {
          for (let x = tx; x < tx + tileW; x++) {
            const idx = (y * canvas.width + x) * 4;
            const val = cdf[data[idx]];
            data[idx] = val;
            data[idx + 1] = val;
            data[idx + 2] = val;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  /**
   * Main recognition pipeline - simplified for reliability
   */
  const recognizeText = async (canvas: HTMLCanvasElement): Promise<TextBox[]> => {
    if (!workerRef.current || !isReady) {
      console.log('Tesseract not ready');
      return [];
    }

    setIsProcessing(true);
    try {
      console.log('Starting advanced text recognition pipeline...');

      // Step 1: Apply CLAHE enhancement
      const enhancedCanvas = applyCLAHE(canvas);

      // Step 2: Run OCR on enhanced image
      const result = await workerRef.current.recognize(enhancedCanvas);
      const words = (result.data as any)?.words || [];

      if (words.length === 0) {
        console.log('No words detected');
        setIsProcessing(false);
        return [];
      }

      const textBoxes: TextBox[] = [];

      // Step 3: Process detected words
      for (const word of words) {
        if (word.confidence > 50 && word.text && word.text.trim().length > 0) {
          const bbox = word.bbox;
          if (bbox) {
            const text = word.text.trim();
            const key = `${Math.round(bbox.x0 / 10)}-${Math.round(bbox.y0 / 10)}-${text}`;

            // Temporal smoothing: track text across frames
            const frameCount = (frameHistoryRef.current.get(key) || 0) + 1;
            frameHistoryRef.current.set(key, frameCount);

            // Boost confidence if text seen in multiple frames
            let confidence = word.confidence / 100;
            if (frameCount > 1) {
              confidence = Math.min(1, confidence * 1.1);
            }

            textBoxes.push({
              text,
              x: Math.round(bbox.x0),
              y: Math.round(bbox.y0),
              width: Math.round(bbox.x1 - bbox.x0),
              height: Math.round(bbox.y1 - bbox.y0),
              confidence,
            });
          }
        }
      }

      // Filter by confidence (>60%)
      const filteredBoxes = textBoxes.filter(box => box.confidence > 0.6);

      console.log(`Pipeline: Found ${words.length} words, ${filteredBoxes.length} high-confidence`);
      setIsProcessing(false);
      return filteredBoxes;
    } catch (error) {
      console.error('Advanced text recognition error:', error);
      setIsProcessing(false);
      return [];
    }
  };

  return {
    recognizeText,
    isReady,
    isProcessing,
  };
}

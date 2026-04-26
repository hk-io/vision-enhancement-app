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

export function useTextRecognition() {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Tesseract.Worker | null>(null);

  useEffect(() => {
    const initWorker = async () => {
      try {
        console.log('Initializing Tesseract worker...');
        const worker = await Tesseract.createWorker('eng', 1, {
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5/tesseract-core.wasm.js',
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5/dist/worker.min.js',
        });
        workerRef.current = worker;
        setIsReady(true);
        console.log('Tesseract worker initialized');
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
   * Preprocess canvas image for better OCR accuracy
   * - Convert to grayscale
   * - Increase contrast
   * - No scaling to avoid coordinate issues
   */
  const preprocessCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Get image data from original canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Apply preprocessing
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to grayscale using luminance formula
      const gray = r * 0.299 + g * 0.587 + b * 0.114;

      // Apply strong contrast enhancement
      let enhanced = (gray - 128) * 2.5 + 128;
      enhanced = Math.max(0, Math.min(255, enhanced));

      // Apply thresholding for cleaner text
      if (enhanced < 80) {
        enhanced = 0;
      } else if (enhanced > 180) {
        enhanced = 255;
      } else {
        // Smooth transition in middle range
        enhanced = (enhanced - 80) * (255 / 100);
      }

      enhanced = Math.max(0, Math.min(255, enhanced));

      // Set all channels to the processed value
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
      // Keep alpha as is
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  const recognizeText = async (canvas: HTMLCanvasElement): Promise<TextBox[]> => {
    if (!workerRef.current || !isReady) {
      console.log('Tesseract not ready');
      return [];
    }

    setIsProcessing(true);
    try {
      console.log('Starting text recognition...');
      
      // Preprocess the canvas (no scaling)
      const processedCanvas = preprocessCanvas(canvas);

      // Run Tesseract OCR
      const result = await workerRef.current.recognize(processedCanvas);

      const textBoxes: TextBox[] = [];
      
      // Extract words from result
      let words: any[] = [];
      
      if ((result.data as any)?.words) {
        words = (result.data as any).words;
        console.log('Found words in result.data.words');
      } else if ((result as any)?.words) {
        words = (result as any).words;
        console.log('Found words in result.words');
      } else if ((result.data as any)?.blocks) {
        console.log('Extracting from blocks structure');
        (result.data as any).blocks.forEach((block: any) => {
          if (block.paragraphs) {
            block.paragraphs.forEach((para: any) => {
              if (para.lines) {
                para.lines.forEach((line: any) => {
                  if (line.words) {
                    words = words.concat(line.words);
                  }
                });
              }
            });
          }
        });
      }

      if (words.length > 0) {
        console.log(`Found ${words.length} words`);
        
        words.forEach((word: any) => {
          // Only include words with high confidence to reduce false positives
          if (word.confidence > 60 && word.text && word.text.trim().length > 0) {
            const bbox = word.bbox;
            if (bbox) {
              textBoxes.push({
                text: word.text.trim(),
                x: Math.round(bbox.x0),
                y: Math.round(bbox.y0),
                width: Math.round(bbox.x1 - bbox.x0),
                height: Math.round(bbox.y1 - bbox.y0),
                confidence: word.confidence / 100,
              });
            }
          }
        });
      } else {
        console.log('No words found in any result structure');
      }

      setIsProcessing(false);
      console.log(`Returning ${textBoxes.length} text boxes`);
      return textBoxes;
    } catch (error) {
      console.error('Text recognition error:', error);
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

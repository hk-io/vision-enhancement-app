/**
 * Hook to manage OCR Web Worker
 * 
 * Handles initialization, text recognition, and cleanup of the OCR worker.
 */

import { useEffect, useRef, useCallback } from 'react';

interface OCRResult {
  id: number;
  text: string;
  confidence: number;
  success: boolean;
}

export function useOCRWorker(onResult: (result: OCRResult) => void) {
  const workerRef = useRef<Worker | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize worker on mount
  useEffect(() => {
    try {
      // Create worker from TypeScript file
      workerRef.current = new Worker(
        new URL('../workers/ocr.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Handle messages from worker
      workerRef.current.onmessage = (event: MessageEvent) => {
        const { type, data } = event.data;

        if (type === 'initialized') {
          isInitializedRef.current = data.success;
          console.log('✅ OCR Worker ready');
        } else if (type === 'result') {
          onResult(event.data);
        } else if (type === 'error') {
          console.error('❌ OCR Worker error:', event.data.message);
        }
      };

      // Initialize worker
      workerRef.current.postMessage({ type: 'init' });

      return () => {
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'terminate' });
          workerRef.current.terminate();
          workerRef.current = null;
        }
      };
    } catch (error) {
      console.error('❌ Failed to create OCR worker:', error);
    }
  }, [onResult]);

  // Function to recognize text from image data
  const recognizeText = useCallback((imageData: ImageData, regionId: number) => {
    if (!workerRef.current || !isInitializedRef.current) {
      console.log('⚠️ OCR Worker not ready');
      return;
    }

    workerRef.current.postMessage({
      type: 'recognize',
      data: {
        imageData,
        id: regionId
      }
    });
  }, []);

  return { recognizeText, isReady: isInitializedRef.current };
}

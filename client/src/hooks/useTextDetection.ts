/**
 * Text Detection Hook using Tesseract.js
 * 
 * This hook provides real-time text detection in video frames
 * for AR text enhancement features.
 */

import { useEffect, useRef, useState } from 'react';
import { createWorker, type Worker } from 'tesseract.js';

export interface TextRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
}

export interface UseTextDetectionOptions {
  enabled: boolean;
  intervalMs?: number;  // How often to run detection (default: 1000ms)
  minConfidence?: number;  // Minimum confidence threshold (default: 60)
}

export function useTextDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseTextDetectionOptions
) {
  const [textRegions, setTextRegions] = useState<TextRegion[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * Initialize Tesseract worker
   */
  useEffect(() => {
    if (!options.enabled) return;

    const initWorker = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        
        console.log('Initializing Tesseract worker...');
        const worker = await createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        });
        
        workerRef.current = worker;
        console.log('Tesseract worker initialized');
        setIsInitializing(false);
      } catch (err) {
        console.error('Failed to initialize Tesseract:', err);
        setError('Failed to initialize text detection');
        setIsInitializing(false);
      }
    };

    initWorker();

    return () => {
      if (workerRef.current) {
        console.log('Terminating Tesseract worker...');
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [options.enabled]);

  /**
   * Run text detection periodically
   */
  useEffect(() => {
    if (!options.enabled || !workerRef.current || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const intervalMs = options.intervalMs || 1000;
    const minConfidence = options.minConfidence || 60;

    // Create canvas for capturing video frames
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const detectText = async () => {
      if (!workerRef.current || !video || video.readyState < 2) {
        return;
      }

      try {
        setIsDetecting(true);

        // Capture current video frame
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        // Run OCR
        const { data } = await workerRef.current.recognize(canvas) as any;
        
        // Extract text regions with sufficient confidence
        const regions: TextRegion[] = (data.words || [])
          .filter((word: any) => word.confidence >= minConfidence)
          .map((word: any) => ({
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
            text: word.text,
            confidence: word.confidence,
          }));

        setTextRegions(regions);
        setIsDetecting(false);
      } catch (err) {
        console.error('Text detection error:', err);
        setIsDetecting(false);
      }
    };

    // Start periodic detection
    detectText(); // Run immediately
    detectionIntervalRef.current = window.setInterval(detectText, intervalMs);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [options.enabled, options.intervalMs, options.minConfidence, videoRef]);

  return {
    textRegions,
    isInitializing,
    isDetecting,
    error,
  };
}

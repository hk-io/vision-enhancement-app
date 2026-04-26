/**
 * Hook for real-time CLAHE enhancement on camera stream
 * 
 * Applies Contrast Limited Adaptive Histogram Equalization to video frames
 * in real-time for low-vision accessibility
 */

import { useEffect, useRef, useState } from 'react';
import type { EnhancementLevel } from '@/lib/claheEnhancement';
import { applyCLAHEToCanvas } from '@/lib/claheEnhancement';

interface UseCLAHEEnhancementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  level: EnhancementLevel;
  enabled: boolean;
}

export function useCLAHEEnhancement({ videoRef, level, enabled }: UseCLAHEEnhancementProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Pure JavaScript CLAHE is always ready
  useEffect(() => {
    setIsReady(true);
  }, []);

  // Process video frames with CLAHE
  useEffect(() => {
    if (!enabled || !videoRef.current || !isReady) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const video = videoRef.current;

    // Create canvas if it doesn't exist
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = video.videoWidth || 1280;
      canvasRef.current.height = video.videoHeight || 720;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const processFrame = () => {
      try {
        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Apply CLAHE enhancement (modifies canvas in place)
        applyCLAHEToCanvas(canvas, level);

        // Continue processing next frame
        animationFrameRef.current = requestAnimationFrame(processFrame);
      } catch (error) {
        console.error('CLAHE frame processing error:', error);
        // Continue processing even if there's an error
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    // Start processing
    animationFrameRef.current = requestAnimationFrame(processFrame);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, videoRef, level, isReady]);

  return {
    canvasRef,
    isReady,
  };
}

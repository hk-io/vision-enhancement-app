/**
 * Custom React Hook for COCO-SSD Object Detection
 * 
 * Detects objects in images using TensorFlow.js COCO-SSD model
 * Returns bounding boxes with object labels and confidence scores
 */

import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface DetectedObject {
  class: string; // Object label (e.g., "book", "keyboard")
  score: number; // Confidence 0-1
  bbox: [number, number, number, number]; // [x, y, width, height]
}

interface ObjectDetectionState {
  objects: DetectedObject[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to detect objects in images using COCO-SSD
 */
export function useObjectDetection() {
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const [state, setState] = useState<ObjectDetectionState>({
    objects: [],
    isLoading: false,
    error: null,
  });

  /**
   * Initialize COCO-SSD model on first load
   */
  useEffect(() => {
    let isMounted = true;

    const initializeModel = async () => {
      try {
        console.log('🤖 Initializing TensorFlow.js backend...');
        await tf.ready();
        console.log('✅ TensorFlow.js backend ready');
        
        console.log('🤖 Loading COCO-SSD model...');
        const model = await cocoSsd.load();
        if (isMounted) {
          modelRef.current = model;
          console.log('✅ COCO-SSD model loaded successfully');
        }
      } catch (err) {
        const error = err as Error;
        console.error('❌ Failed to load COCO-SSD model:', error);
        if (isMounted) {
          setState(prev => ({
            ...prev,
            error: `Failed to load object detection model: ${error.message}`,
          }));
        }
      }
    };

    initializeModel();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Detect objects in a canvas or image element
   */
  const detectObjects = async (
    imageElement: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
  ): Promise<DetectedObject[]> => {
    if (!modelRef.current) {
      console.error('Model not loaded yet');
      setState(prev => ({
        ...prev,
        error: 'Object detection model not ready',
      }));
      return [];
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      console.log('🔍 Detecting objects...');

      const predictions = await modelRef.current.detect(imageElement);

      // Convert predictions to our format
      const detectedObjects: DetectedObject[] = predictions
        .filter((pred: any) => pred.score > 0.5) // Only keep predictions with >50% confidence
        .map((pred: any) => ({
          class: pred.class,
          score: pred.score,
          bbox: pred.bbox as [number, number, number, number],
        }))
        .sort((a: DetectedObject, b: DetectedObject) => b.score - a.score); // Sort by confidence

      console.log(`✅ Detected ${detectedObjects.length} objects:`, 
        detectedObjects.map((o: DetectedObject) => `${o.class} (${(o.score * 100).toFixed(0)}%)`).join(', ')
      );

      setState(prev => ({
        ...prev,
        objects: detectedObjects,
        isLoading: false,
      }));

      return detectedObjects;
    } catch (err) {
      const error = err as Error;
      console.error('❌ Object detection failed:', error);
      setState(prev => ({
        ...prev,
        error: `Detection failed: ${error.message}`,
        isLoading: false,
      }));
      return [];
    }
  };

  /**
   * Clear detected objects
   */
  const clearObjects = () => {
    setState({
      objects: [],
      isLoading: false,
      error: null,
    });
  };

  return {
    ...state,
    detectObjects,
    clearObjects,
    isModelReady: modelRef.current !== null,
  };
}

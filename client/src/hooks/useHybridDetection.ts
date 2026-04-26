/**
 * Hybrid Detection Hook
 * 
 * Combines COCO-SSD object detection with Google Vision text recognition
 * 1. Detects objects using COCO-SSD
 * 2. For each object, extracts text using Google Vision
 * 3. Returns objects with their detected text
 */

import { useCallback, useState } from 'react';
import { useObjectDetection, type DetectedObject } from './useObjectDetection';
import { trpc } from '@/lib/trpc';

export interface DetectedObjectWithText extends DetectedObject {
  hasText: boolean;
  textContent?: string;
  textLoading?: boolean;
  textError?: string;
}

interface HybridDetectionState {
  objects: DetectedObjectWithText[];
  isProcessing: boolean;
  error: string | null;
}

/**
 * Hook for hybrid object detection + text recognition
 */
export function useHybridDetection() {
  const { detectObjects, isModelReady, error: detectionError, isLoading: isModelLoading } = useObjectDetection();
  const [state, setState] = useState<HybridDetectionState>({
    objects: [],
    isProcessing: false,
    error: null,
  });

  // tRPC mutation for OCR
  const ocrMutation = trpc.ocr.recognizeText.useMutation();

  /**
   * Process a frozen frame:
   * 1. Detect objects using COCO-SSD
   * 2. For each object, extract and recognize text
   */
  const processFrame = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (!isModelReady) {
        const errorMsg = isModelLoading 
          ? 'Object detection model is still loading... Please wait a moment and try again.'
          : 'Object detection model failed to load';
        console.error('❌', errorMsg);
        setState(prev => ({
          ...prev,
          error: errorMsg,
        }));
        return;
      }

      try {
        setState(prev => ({
          ...prev,
          isProcessing: true,
          error: null,
        }));

        console.log('🔄 Hybrid detection: Step 1 - Detecting objects...');
        const detectedObjects = await detectObjects(canvas);

        if (detectedObjects.length === 0) {
          console.log('⚠️ No objects detected');
          setState(prev => ({
            ...prev,
            objects: [],
            isProcessing: false,
          }));
          return;
        }

        console.log(`✅ Step 1 complete: ${detectedObjects.length} objects detected`);

        // Initialize objects with text loading state
        const objectsWithText: DetectedObjectWithText[] = detectedObjects.map(obj => ({
          ...obj,
          hasText: false,
          textLoading: true,
        }));

        setState(prev => ({
          ...prev,
          objects: objectsWithText,
        }));

        // Step 2: Extract and recognize text for each object
        console.log('🔄 Hybrid detection: Step 2 - Extracting text from each object...');

        const processObjectText = async (obj: DetectedObject, index: number) => {
          try {
            const [x, y, width, height] = obj.bbox;

            // Create a temporary canvas for this object region
            const objectCanvas = document.createElement('canvas');
            objectCanvas.width = width;
            objectCanvas.height = height;
            const ctx = objectCanvas.getContext('2d');
            if (!ctx) return null;

            // Draw the object region
            ctx.drawImage(
              canvas,
              x,
              y,
              width,
              height,
              0,
              0,
              width,
              height
            );

            // Convert to JPEG and send to Google Vision
            const imageData = objectCanvas.toDataURL('image/jpeg', 0.8);

            console.log(`  📦 Object ${index + 1} (${obj.class}): Sending to Google Vision...`);

            // Call OCR endpoint
            const result = await ocrMutation.mutateAsync({
              imageBase64: imageData.split(',')[1], // Remove data:image/jpeg;base64, prefix
            });

            // Combine all text from clusters, preserving line structure
            const textContent = result.clusters
              .map((c: any) => {
                // Use formatted text if available (respects line breaks)
                if (c.formattedText) {
                  return c.formattedText;
                }
                // Otherwise join text array with spaces
                return Array.isArray(c.text) ? c.text.join(' ') : c.text;
              })
              .filter((text: string) => text && text.trim().length > 0) // Remove empty entries
              .join('\n') // Join clusters with newlines
              .trim();

            console.log(`  ✅ Object ${index + 1} (${obj.class}): Text recognized (${textContent.length} chars)`);
            if (textContent.length > 0) {
              console.log(`     Text preview: "${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}"`);
            }

            return {
              hasText: textContent.length > 0,
              textContent: textContent || undefined,
              textLoading: false,
            };
          } catch (err) {
            const error = err as Error;
            console.error(`  ❌ Object ${index + 1} (${obj.class}): ${error.message}`);
            return {
              hasText: false,
              textLoading: false,
              textError: error.message,
            };
          }
        };

        // Process all objects in parallel
        const textResults = await Promise.all(
          detectedObjects.map((obj, idx) => processObjectText(obj, idx))
        );

        // Merge results - build final objects with all properties
        const finalObjects: DetectedObjectWithText[] = [];
        for (let i = 0; i < detectedObjects.length; i++) {
          const obj = detectedObjects[i];
          const textResult = textResults[i];
          finalObjects.push({
            class: obj.class,
            score: obj.score,
            bbox: obj.bbox,
            hasText: textResult?.hasText ?? false,
            textContent: textResult?.textContent,
            textLoading: textResult?.textLoading ?? false,
            textError: textResult?.textError,
          });
        }

        console.log(`✅ Step 2 complete: Text extracted from all objects`);
        console.log('Summary:', finalObjects.map(o => ({
          class: o.class,
          hasText: o.hasText,
          textLength: o.textContent?.length || 0,
        })));

        setState(prev => ({
          ...prev,
          objects: finalObjects,
          isProcessing: false,
        }));
      } catch (err) {
        const error = err as Error;
        console.error('❌ Hybrid detection failed:', error);
        setState(prev => ({
          ...prev,
          error: error.message,
          isProcessing: false,
        }));
      }
    },
    [isModelReady, isModelLoading, detectObjects, ocrMutation]
  );

  /**
   * Clear all detected objects
   */
  const clear = useCallback(() => {
    setState({
      objects: [],
      isProcessing: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    processFrame,
    clear,
    isModelReady,
    isModelLoading,
    detectionError,
  };
}

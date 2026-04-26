/**
 * Text Detection Hook with Google Cloud Vision OCR
 * 
 * Simplified workflow (like Google Translate):
 * 1. User clicks "AR" button
 * 2. Camera frame freezes
 * 3. Google Cloud Vision processes the frozen frame
 * 4. Text regions are extracted and displayed on overlay
 * 5. User can zoom +/- to adjust text size
 */

import { useRef, useState, useCallback, useEffect, RefObject } from 'react';
import { trpc } from '@/lib/trpc';
import { applyCLAHE, type ContrastLevel, type EnhancementMode } from '@/lib/claheEnhancement';

export interface TextBox {
  text: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

interface UseTextDetectionResult {
  detectionBoxes: TextBox[];
  isOCRProcessing: boolean;
  frozenFrame: HTMLCanvasElement | null;
  isFrozen: boolean;
  processFrame: (videoElement: HTMLVideoElement) => Promise<void>;
  /** Re-run OCR on the current frozen snapshot (use when video is unmounted during AR) */
  reprocessFrozenFrame: () => Promise<void>;
  unfreezeFrame: () => void;
  enhancedFrame: HTMLCanvasElement | null;
  applyZeroDCEEnhancement: (strength: number) => Promise<void>;
}

export interface EnhancementOcrOptions {
  contrastLevel: 'none' | ContrastLevel;
  enhancementMode: EnhancementMode;
  /** "performance" = half-res processing (higher FPS), "quality" = full-res */
  processQuality: 'performance' | 'quality';
}

export function useEASTTextDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  enhancementOptions: EnhancementOcrOptions
): UseTextDetectionResult {
  const [detectionBoxes, setDetectionBoxes] = useState<TextBox[]>([]);
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [frozenFrame, setFrozenFrame] = useState<HTMLCanvasElement | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [enhancedFrame, setEnhancedFrame] = useState<HTMLCanvasElement | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const ocrProcessingRef = useRef(false);
  /** Always points at latest frozen canvas (avoids stale closure on Reprocess). */
  const frozenFrameRef = useRef<HTMLCanvasElement | null>(null);

  // tRPC mutations
  const ocrMutation = trpc.ocr.recognizeText.useMutation();
  const enhancementMutation = trpc.enhancement.enhanceContrast.useMutation();

  const enhanceCanvasForOcr = useCallback(
    (inputCanvas: HTMLCanvasElement): HTMLCanvasElement => {
      if (enhancementOptions.contrastLevel === 'none') return inputCanvas;

      const cv = (window as any).cv;
      if (!cv) return inputCanvas;

      // applyCLAHE expects a "videoElement" but it only uses drawImage(),
      // and a canvas is a valid drawImage source.
      const workingCanvas = document.createElement('canvas');
      workingCanvas.width = inputCanvas.width;
      workingCanvas.height = inputCanvas.height;

      const ctx = workingCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return inputCanvas;

      ctx.drawImage(inputCanvas, 0, 0);

      applyCLAHE(
        cv,
        workingCanvas as unknown as HTMLVideoElement,
        workingCanvas,
        enhancementOptions.contrastLevel,
        {
          mode: enhancementOptions.enhancementMode,
          processScale: enhancementOptions.processQuality === 'performance' ? 0.5 : 1,
        }
      );

      return workingCanvas;
    },
    [enhancementOptions]
  );

  // Unfreeze the frame and return to live camera
  const unfreezeFrame = useCallback(() => {
    console.log('🎬 Unfreezing camera - returning to live feed');
    frozenFrameRef.current = null;
    setFrozenFrame(null);
    setEnhancedFrame(null);
    setIsFrozen(false);
    setDetectionBoxes([]);
  }, []);

  // Process a single frame: freeze, detect, and recognize text
  const processFrame = useCallback(
    async (video: HTMLVideoElement) => {
      if (ocrProcessingRef.current) {
        console.log('⏳ Already processing, skipping...');
        return;
      }

      if (!enabled) {
        console.log('Text enhancement not enabled');
        return;
      }

      try {
        ocrProcessingRef.current = true;
        setIsOCRProcessing(true);
        console.log('🔄 Processing frame...');

        // Create canvas and freeze the current frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        console.log('📸 Frame frozen at', canvas.width, 'x', canvas.height);

        // Optionally apply contrast+edge enhancement to the frozen frame for OCR
        const ocrCanvas = enhanceCanvasForOcr(canvas);

        // Freeze the frame (enhanced for OCR if configured)
        frozenFrameRef.current = ocrCanvas;
        setFrozenFrame(ocrCanvas);
        setIsFrozen(true);

        // Send to Google Cloud Vision for text recognition
        console.log('📡 Sending to Google Cloud Vision API...');
        const imageBase64 = ocrCanvas.toDataURL('image/jpeg', 1.0).split(',')[1];
        console.log(`📸 Image size: ${imageBase64.length} bytes`);

        // Call API with 30 second timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Google Vision API timeout (30s)')), 30000)
        );
        
        const result = await Promise.race([
          ocrMutation.mutateAsync({ imageBase64 }),
          timeoutPromise
        ]) as any;
        console.log('✅ Google Vision response:', result);

        // Use individual text regions directly (like Google Translate)
        if (result.success && result.regions && result.regions.length > 0) {
          console.log(`✅ Received ${result.regions.length} text regions from Google Vision`);
          
          const greenBoxes = result.regions.map((region: any) => {
            // Handle both array (clustered) and string (raw) text formats
            const textContent = Array.isArray(region.text) 
              ? region.text.join(' ')  // Join array of strings into single string
              : region.text;  // Use string directly
            
            return {
              text: textContent,
              box: region.box,
              confidence: region.confidence,
            };
          });
          
          console.log('📦 Regions:', greenBoxes.map((box: any, i: number) => ({
            index: i,
            text: typeof box.text === 'string' ? box.text.substring(0, 30) : 'N/A',
            box: box.box,
          })));
          
          setDetectionBoxes(greenBoxes);
        } else {
          console.log('⚠️ No text recognized by Google Cloud Vision');
          setDetectionBoxes([]);
        }
      } catch (error) {
        console.error('❌ Error processing frame:', error);
        setDetectionBoxes([]);
      } finally {
        ocrProcessingRef.current = false;
        setIsOCRProcessing(false);
      }
    },
    [enabled, ocrMutation, enhanceCanvasForOcr]
  );

  /**
   * Re-run Google Vision on the existing frozen canvas.
   * Required because while AR is frozen the &lt;video&gt; is unmounted, so processFrame(video) cannot run.
   */
  const reprocessFrozenFrame = useCallback(async () => {
    if (ocrProcessingRef.current) {
      console.log("⏳ Already processing, skipping reprocess...");
      return;
    }

    if (!enabled) {
      console.log("Text enhancement not enabled");
      return;
    }

    try {
      ocrProcessingRef.current = true;
      setIsOCRProcessing(true);
      console.log("🔄 Reprocessing frozen frame (canvas)...");

      const canvas = frozenFrameRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        console.warn("❌ No valid frozen frame to reprocess");
        return;
      }

      // Re-apply contrast+edge enhancement to match the current Enhancement strip settings,
      // then run OCR on the enhanced pixels.
      const ocrCanvas = enhanceCanvasForOcr(canvas);
      frozenFrameRef.current = ocrCanvas;
      setFrozenFrame(ocrCanvas);

      const imageBase64 = ocrCanvas.toDataURL("image/jpeg", 1.0).split(",")[1];
      console.log(`📡 Re-sending frozen image to Google Vision (${imageBase64.length} chars base64)...`);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Google Vision API timeout (30s)")), 30000)
      );

      const result = (await Promise.race([
        ocrMutation.mutateAsync({ imageBase64 }),
        timeoutPromise,
      ])) as any;
      console.log("✅ Google Vision response (reprocess):", result);

      if (result.success && result.regions && result.regions.length > 0) {
        const greenBoxes = result.regions.map((region: any) => {
          const textContent = Array.isArray(region.text)
            ? region.text.join(" ")
            : region.text;
          return {
            text: textContent,
            box: region.box,
            confidence: region.confidence,
          };
        });
        setDetectionBoxes(greenBoxes);
      } else {
        console.log("⚠️ No text recognized on reprocess");
        setDetectionBoxes([]);
      }
    } catch (error) {
      console.error("❌ Error reprocessing frozen frame:", error);
      setDetectionBoxes([]);
    } finally {
      ocrProcessingRef.current = false;
      setIsOCRProcessing(false);
    }
  }, [enabled, ocrMutation, enhanceCanvasForOcr]);

  // Apply Zero-DCE++ enhancement to frozen frame
  const applyZeroDCEEnhancement = useCallback(
    async (strength: number) => {
      if (!frozenFrame) {
        console.error('No frozen frame to enhance');
        return;
      }

      try {
        setIsEnhancing(true);
        console.log('Applying Zero-DCE++ enhancement with strength:', strength);

        // Convert canvas to base64
        const imageBase64 = frozenFrame.toDataURL('image/jpeg', 1.0).split(',')[1];

        // Call enhancement API
        const result = await enhancementMutation.mutateAsync({
          imageBase64,
          strength,
        });

        if (result.success && result.enhancedImage) {
          console.log('Enhancement complete, creating enhanced canvas');

          // Create a canvas with the enhanced image
          const img = new Image();
          img.onload = () => {
            const enhancedCanvas = document.createElement('canvas');
            enhancedCanvas.width = img.width;
            enhancedCanvas.height = img.height;
            const ctx = enhancedCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              setEnhancedFrame(enhancedCanvas);
              console.log('Enhanced frame ready for display');
            }
          };
          img.src = `data:image/jpeg;base64,${result.enhancedImage}`;
        } else {
          console.error('Enhancement failed:', result.error);
        }
      } catch (error) {
        console.error('Error during enhancement:', error);
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
      } finally {
        setIsEnhancing(false);
      }
    },
    [frozenFrame, enhancementMutation]
  );

  return {
    detectionBoxes,
    isOCRProcessing,
    frozenFrame,
    isFrozen,
    processFrame,
    reprocessFrozenFrame,
    unfreezeFrame,
    enhancedFrame,
    applyZeroDCEEnhancement,
  };
}

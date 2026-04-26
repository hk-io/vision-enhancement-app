import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { applyThreeStepEnhancement, EnhancementLevel } from '@/lib/threeStepEnhancement';
import { initializeOpenCV, applyCLAHEBrightRoom } from '@/lib/opencvCLAHE';

const DARK_ROOM_THRESHOLD_ENTER = 30;
const DARK_ROOM_THRESHOLD_EXIT = 50;
const DARK_ROOM_STABLE_FRAMES = 5;

export function useTwoPhaseEnhancement(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  strengthLevelRef: React.RefObject<string>
) {
  const [fps, setFps] = useState(0);
  const [isDarkRoomMode, setIsDarkRoomMode] = useState(false);
  const [currentMode, setCurrentMode] = useState('none');

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const meanBrightnessRef = useRef(0);
  const darkRoomFrameCountRef = useRef(0);
  const darkRoomStateRef = useRef(false);
  const zeroDCEPendingRef = useRef(false);
  const processingRef = useRef(false);
  const zeroDCECalledRef = useRef(false);
  const cachedZeroDCEResultRef = useRef<HTMLImageElement | null>(null);
  const enhanceMutation = trpc.enhancement.enhanceContrast.useMutation();

  // TEMP: super-simplified processor for debugging. Always tries to enhance when called.
  const processFrame = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        return;
      }
      if (video.readyState !== 4) {
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw < 100 || vh < 100) {
        return;
      }
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Call OpenCV test (currently grayscale debug)
      await initializeOpenCV();
      await applyCLAHEBrightRoom(canvas, 2.0);
    } catch (error) {
      console.error('Error in processFrame:', error);
    } finally {
      processingRef.current = false;
    }
  }, [videoRef, canvasRef]);

  return { fps, isDarkRoomMode, currentMode, processFrame };
}

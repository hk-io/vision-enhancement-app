/**
 * Custom React Hook for Camera Access
 * 
 * This hook manages the webcam using the browser's MediaDevices API.
 * It handles permission requests, stream management, and error handling.
 * 
 * Language: TypeScript
 * Browser API: navigator.mediaDevices.getUserMedia()
 */

import { useEffect, useRef, useState } from 'react';

export interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  isLoading: boolean;
  hasPermission: boolean;
  facingMode: 'user' | 'environment';
  canSwitch: boolean;
}

/**
 * Hook to access and manage the device camera
 * 
 * @returns Camera state and control functions
 */
export function useCamera() {
  const [state, setState] = useState<CameraState>({
    stream: null,
    error: null,
    isLoading: false,
    hasPermission: false,
    facingMode: 'user', // Default to front camera
    canSwitch: false,
  });
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check if device has multiple cameras
   */
  const checkMultipleCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      return videoDevices.length > 1;
    } catch {
      return false;
    }
  };

  /**
   * Request camera permission and start video stream
   */
  const startCamera = async (facingMode: 'user' | 'environment' = state.facingMode) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Stop existing stream if any
      if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
      }

      // Request camera access - lower resolution for better mobile performance
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: facingMode, // 'user' = front camera, 'environment' = back camera
        },
        audio: false,
      });
      
      // Check if device has multiple cameras
      const canSwitch = await checkMultipleCameras();
      
      streamRef.current = stream;
      console.log('📹 Stream obtained, waiting for video element');
      
      // Set state - camera is ready
      setState({
        stream,
        error: null,
        isLoading: false,
        hasPermission: true,
        facingMode,
        canSwitch,
      });
    } catch (err) {
      const error = err as Error;
      let errorMessage = 'Failed to access camera';
      
      // Provide user-friendly error messages
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      }
      
      setState({
        stream: null,
        error: errorMessage,
        isLoading: false,
        hasPermission: false,
        facingMode,
        canSwitch: false,
      });
    }
  };

  /**
   * Switch between front and back camera
   */
  const switchCamera = async () => {
    const newFacingMode = state.facingMode === 'user' ? 'environment' : 'user';
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    await startCamera(newFacingMode);
  };

  /**
   * Stop the camera stream and release resources
   */
  const stopCamera = () => {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      setState({
        stream: null,
        error: null,
        isLoading: false,
        hasPermission: false,
        facingMode: 'user',
        canSwitch: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  /**
   * Attach stream to video element when it becomes available
   */
  useEffect(() => {
    if (videoRef.current && streamRef.current && state.hasPermission) {
      console.log('📹 Video element ready, attaching stream');
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(err => {
        console.error('Failed to play video:', err);
      });
    }
  }, [state.hasPermission, state.stream]);

  /**
   * Clean up on component unmount
   */
  useEffect(() => {
    return () => {
      if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state.stream]);

  return {
    ...state,
    videoRef,
    startCamera,
    stopCamera,
    switchCamera,
  };
}

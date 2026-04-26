import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ExtractedText {
  text: string;
  confidence: number;
  isCritical: boolean;
}

export function useWebXRAR() {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const xrSessionRef = useRef<any>(null);
  const [isARSupported, setIsARSupported] = useState(false);
  const [isARActive, setIsARActive] = useState(false);
  const [extractedText, setExtractedText] = useState<ExtractedText | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize WebXR
  useEffect(() => {
    const checkWebXRSupport = async () => {
      try {
        const xr = (navigator as any).xr;
        if (!xr) {
          console.warn('WebXR not supported');
          setIsARSupported(false);
          return;
        }

        const isSupported = await xr.isSessionSupported('immersive-ar');
        setIsARSupported(isSupported);
        console.log('WebXR AR Support:', isSupported);
      } catch (err) {
        console.error('Error checking WebXR support:', err);
        setError('WebXR not available on this device');
      }
    };

    checkWebXRSupport();
  }, []);

  // Start AR session
  const startARSession = async (canvas: HTMLCanvasElement) => {
    try {
      const xr = (navigator as any).xr;
      if (!xr) {
        throw new Error('WebXR not supported');
      }

      // Request AR session
      const session: any = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: document.body },
      });

      xrSessionRef.current = session;

      // Initialize Three.js scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        canvas,
      });
      renderer.xr.enabled = true;
      renderer.xr.setSession(session);
      rendererRef.current = renderer;

      // Set up camera
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      cameraRef.current = camera;

      // Add lighting
      const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
      scene.add(light);

      setIsARActive(true);
      setError(null);

      // Start render loop
      renderer.setAnimationLoop((time: number, frame: any) => {
        if (frame) {
          renderer.render(scene, camera);
        }
      });

      // Handle session end
      session.addEventListener('end', () => {
        setIsARActive(false);
        renderer.setAnimationLoop(null);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error starting AR session:', err);
      setError(`Failed to start AR: ${errorMessage}`);
    }
  };

  // Stop AR session
  const stopARSession = async () => {
    if (xrSessionRef.current) {
      await xrSessionRef.current.end();
      xrSessionRef.current = null;
      setIsARActive(false);
    }
  };

  // Create AR text overlay
  const createTextOverlay = (text: string, isCritical: boolean = false) => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    // Create canvas texture for text
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Draw background
    ctx.fillStyle = isCritical ? '#000000' : '#000080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.fillStyle = isCritical ? '#FFFF00' : '#FFFFFF';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word wrap
    const words = text.split(' ');
    let line = '';
    let y = 100;

    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);

      if (metrics.width > 900) {
        ctx.fillText(line, 512, y);
        line = word + ' ';
        y += 100;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 512, y);

    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture });

    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(4, 2);
    const mesh = new THREE.Mesh(geometry, material);

    // Position in front of camera
    mesh.position.z = -3;
    scene.add(mesh);

    // Store reference for cleanup
    return mesh;
  };

  // Extract text from camera frame (would integrate with Google Vision API)
  const extractTextFromFrame = async (imageData: ImageData): Promise<ExtractedText | null> => {
    try {
      // This would call Google Vision API
      // For now, return mock data
      return {
        text: 'Sample Text',
        confidence: 0.95,
        isCritical: false,
      };
    } catch (err) {
      console.error('Error extracting text:', err);
      return null;
    }
  };

  return {
    isARSupported,
    isARActive,
    extractedText,
    error,
    startARSession,
    stopARSession,
    createTextOverlay,
    extractTextFromFrame,
  };
}

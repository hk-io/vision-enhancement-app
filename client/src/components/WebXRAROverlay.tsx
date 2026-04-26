import React, { useEffect, useRef, useState } from 'react';

interface WebXRAROverlayProps {
  isActive: boolean;
  onClose: () => void;
  text: string;
}

/**
 * WebXR AR Overlay Component
 * Displays ZOOM indicator and text in real-world AR view
 * Uses WebXR API for immersive AR experience
 */
export const WebXRAROverlay: React.FC<WebXRAROverlayProps> = ({ isActive, onClose, text }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isARActive, setIsARActive] = useState(false);

  useEffect(() => {
    // Check WebXR support
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        setIsSupported(supported);
      });
    }
  }, []);

  const startARSession = async () => {
    if (!navigator.xr || !canvasRef.current) return;

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: document.body },
      });

      setIsARActive(true);

      // Handle AR frame updates
      const onFrame = (time: number, frame: XRFrame) => {
        const session = frame.session;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl2', { xrCompatible: true });
        if (!gl) return;

        // Clear canvas
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Render ZOOM indicator
        renderZoomIndicator(gl, canvas);

        // Continue animation loop
        session.requestAnimationFrame(onFrame);
      };

      session.requestAnimationFrame(onFrame);

      // Handle session end
      session.addEventListener('end', () => {
        setIsARActive(false);
        onClose();
      });
    } catch (err) {
      console.error('Failed to start AR session:', err);
      setIsARActive(false);
    }
  };

  const renderZoomIndicator = (gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw ZOOM indicator
    ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
    ctx.fillRect(canvas.width / 2 - 60, canvas.height / 2 - 30, 120, 60);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔍 ZOOM', canvas.width / 2, canvas.height / 2);
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-11/12">
        <h2 className="text-xl font-bold mb-4">AR Text Magnifier</h2>

        {!isSupported ? (
          <div className="text-red-600 mb-4">
            ⚠️ WebXR is not supported on this device. Using standard magnifier view.
          </div>
        ) : (
          <div className="mb-4">
            <button
              onClick={startARSession}
              disabled={isARActive}
              className="bg-blue-500 text-white px-6 py-2 rounded font-bold hover:bg-blue-600 disabled:bg-gray-400"
            >
              {isARActive ? '🔴 AR Active' : '▶️ Start AR View'}
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full border-2 border-gray-300 rounded mb-4"
          style={{ display: isARActive ? 'block' : 'none' }}
        />

        {/* Fallback text display */}
        {!isARActive && (
          <div className="bg-blue-900 text-white p-4 rounded mb-4 font-atkinson text-2xl leading-relaxed">
            {text}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-gray-500 text-white px-4 py-2 rounded font-bold hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    </div>
  );
};

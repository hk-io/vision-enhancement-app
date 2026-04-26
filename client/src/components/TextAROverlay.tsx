/**
 * AR Text Overlay Component with Accessible Popup
 * 
 * Features:
 * - Green boxes: Recognized text from Google Cloud Vision (clickable, shows actual text)
 * - Clustered objects: Groups nearby text into logical objects
 * - High-contrast popup: White background, black text, Atkinson Hyperlegible font
 * - Accessible for people with visual impairment
 */

import { useEffect, useRef, useState } from 'react';

export interface DetectedTextRegion {
  text: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface TextCluster {
  id: number;
  text: string[];
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface TextAROverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  detectedRegions: DetectedTextRegion[];
  textClusters?: TextCluster[];
  isEnabled: boolean;
  excludeBoxes?: Array<{ x: number; y: number; width: number; height: number }>; // Boxes to exclude from clustering
}

export default function TextAROverlay({ canvasRef, detectedRegions, textClusters = [], isEnabled, excludeBoxes = [] }: TextAROverlayProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const allRegionsRef = useRef<DetectedTextRegion[]>([]);

  // Filter out clusters that overlap with detected objects
  const filteredClusters = textClusters.filter(cluster => {
    // Check if cluster overlaps with any excluded box
    return !excludeBoxes.some(excludeBox => {
      // Check if cluster box overlaps with exclude box
      const clusterBox = cluster.box;
      return !(
        clusterBox.x + clusterBox.width < excludeBox.x ||
        clusterBox.x > excludeBox.x + excludeBox.width ||
        clusterBox.y + clusterBox.height < excludeBox.y ||
        clusterBox.y > excludeBox.y + excludeBox.height
      );
    });
  });

  // Use filtered clustered objects if available, otherwise fall back to individual regions
  const boxesToDraw = filteredClusters.length > 0 ? filteredClusters : detectedRegions.filter(r => !r.text.startsWith('text_') && r.text.trim().length > 1);
  console.log(`🎨 TextAROverlay: Using ${filteredClusters.length > 0 ? 'clustered' : 'individual'} regions - ${boxesToDraw.length} boxes to draw (filtered from ${textClusters.length} clusters, excluded ${excludeBoxes.length} boxes)`);
  if (boxesToDraw.length > 0) {
    if (textClusters.length > 0) {
      console.log('  Clusters:', textClusters.map(c => ({ id: c.id, text: c.text.join(', ') })));
    } else {
      console.log('  Individual texts:', (boxesToDraw as DetectedTextRegion[]).map(r => r.text).join(', '));
    }
  }

  useEffect(() => {
    console.log(`🎨 TextAROverlay useEffect: isEnabled=${isEnabled}, boxes=${boxesToDraw.length}`);
    if (!isEnabled || !canvasRef.current || !overlayCanvasRef.current) {
      console.log(`🎨 TextAROverlay: Skipping draw - isEnabled=${isEnabled}, canvasRef=${!!canvasRef.current}, overlayCanvasRef=${!!overlayCanvasRef.current}`);
      return;
    }

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('🎨 TextAROverlay: Failed to get canvas context');
      return;
    }

    // Match canvas size to main canvas
    canvas.width = canvasRef.current.width;
    canvas.height = canvasRef.current.height;
    console.log(`📊 Overlay canvas resized to: ${canvas.width}x${canvas.height}`);

    // Calculate display scale - account for CSS scaling
    const mainCanvas = canvasRef.current;
    const displayRect = mainCanvas.getBoundingClientRect();
    const scaleX = displayRect.width / mainCanvas.width;
    const scaleY = displayRect.height / mainCanvas.height;
    console.log(`📐 Scale: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)} (internal: ${mainCanvas.width}x${mainCanvas.height}, display: ${displayRect.width.toFixed(0)}x${displayRect.height.toFixed(0)})`);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw green boxes with text labels for each cluster or region
    boxesToDraw.forEach((item, idx) => {
      const box = item.box;
      const displayText = 'text' in item ? (item as DetectedTextRegion).text : (item as TextCluster).text[0];

      // Scale coordinates from internal canvas space to display space
      const scaledX = box.x * scaleX;
      const scaledY = box.y * scaleY;
      const scaledWidth = box.width * scaleX;
      const scaledHeight = box.height * scaleY;

      // Draw green bounding box - thicker and more visible
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 4;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw semi-transparent green fill
      ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
      ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw "📖 Text" button instead of full text
      const buttonText = '📖 Text';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.font = 'bold 16px Arial';
      const buttonWidth = ctx.measureText(buttonText).width;
      ctx.fillRect(scaledX - 2, Math.max(0, scaledY - 28), buttonWidth + 12, 24);
      ctx.fillStyle = '#00FF00';
      ctx.fillText(buttonText, scaledX + 4, Math.max(18, scaledY - 8));
      
      if (textClusters.length > 0) {
        const cluster = item as TextCluster;
        const clusterText = Array.isArray(cluster.text) ? cluster.text.join(', ') : cluster.text;
        console.log(`  📦 Cluster ${idx+1} (id=${cluster.id}): "${clusterText}" at [${box.x}, ${box.y}, ${box.width}x${box.height}]`);
      } else {
        const region = item as DetectedTextRegion;
        console.log(`  📦 Box ${idx+1}: "${region.text}" at [${box.x}, ${box.y}, ${box.width}x${box.height}]`);
      }
    });

    // Store ALL items for click handling
    allRegionsRef.current = boxesToDraw.map((item) => {
      if ('text' in item && typeof item.text === 'string') {
        return item as DetectedTextRegion;
      } else {
        const cluster = item as any;
        const clusterText = Array.isArray(cluster.text) ? cluster.text.join(' ') : cluster.text;
        return {
          text: cluster.formattedText || clusterText,
          box: cluster.box,
          confidence: 0.9,
        };
      }
    });

    if (boxesToDraw.length === 0) {
      console.log('TextAROverlay: No text regions to display');
      return;
    }
    
    console.log(`✅ TextAROverlay: Drawing ${boxesToDraw.length} boxes (green)`);

  }, [isEnabled, boxesToDraw, textClusters, canvasRef]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('Canvas click event fired!');
    if (!overlayCanvasRef.current || !isEnabled) {
      console.log('Click ignored: overlay disabled or ref missing');
      return;
    }

    const canvas = overlayCanvasRef.current;
    const mainCanvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get click position relative to canvas element
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert screen coordinates to canvas coordinates
    const canvasX = (screenX / rect.width) * canvas.width;
    const canvasY = (screenY / rect.height) * canvas.height;

    // Box coordinates are already in canvas space, no further scaling needed
    const originalX = canvasX;
    const originalY = canvasY;

    console.log(`Click at screen: ${screenX}, ${screenY} | Canvas: ${canvasX}, ${canvasY} | Original: ${originalX}, ${originalY}`);
    console.log(`Checking ${allRegionsRef.current.length} regions...`);

    // Check which region was clicked
    for (const region of allRegionsRef.current) {
      const { box } = region;
      if (
        originalX >= box.x &&
        originalX <= box.x + box.width &&
        originalY >= box.y &&
        originalY <= box.y + box.height
      ) {
        console.log(`✅ Clicked region: "${region.text}"`);
        setSelectedText(region.text);
        return;
      }
    }

    console.log('❌ Click missed all regions');
  };

  return (
    <>
      {/* Overlay canvas for drawing boxes and handling clicks */}
      <canvas
        ref={overlayCanvasRef}
        onClick={handleCanvasClick}
        className="absolute inset-0 cursor-pointer"
        style={{ display: isEnabled ? 'block' : 'none' }}
      />

      {/* Accessible text popup - white background, black text, large font */}
      {selectedText && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={() => setSelectedText(null)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-11/12 shadow-lg">
            {/* Close button */}
            <button
              onClick={() => setSelectedText(null)}
              className="absolute top-6 right-6 text-gray-600 hover:text-gray-900 text-3xl font-bold"
            >
              ×
            </button>

            {/* Text content - large, high contrast, accessible font */}
            <div className="font-atkinson text-2xl font-bold text-black leading-relaxed whitespace-pre-wrap break-words">
              {selectedText}
            </div>

            {/* Instructions */}
            <p className="text-center text-gray-600 mt-4 text-sm">Tap anywhere to close</p>
          </div>
        </div>
      )}
    </>
  );
}

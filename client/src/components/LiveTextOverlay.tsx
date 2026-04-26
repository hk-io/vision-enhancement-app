/**
 * Live Text Overlay Component
 * Renders small navy blue backgrounds ONLY behind text (not full detected regions)
 */

import { useEffect } from 'react';

export interface TextDetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence?: number;
}

interface LiveTextOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  textBoxes: TextDetectionBox[];
  isEnabled: boolean;
  onClose?: () => void;
  frozenFrame?: HTMLCanvasElement | null;
  onExtractText?: (allText: string) => void;
  imageWidth?: number;
  imageHeight?: number;
  canvasPixelWidth?: number;
  canvasPixelHeight?: number;
}

export function LiveTextOverlay({
  canvasRef,
  textBoxes,
  isEnabled,
  onClose,
  frozenFrame,
  onExtractText,
  imageWidth = 1280,
  imageHeight = 720,
  canvasPixelWidth,
  canvasPixelHeight,
}: LiveTextOverlayProps) {

  useEffect(() => {
    if (!canvasRef.current || !isEnabled || textBoxes.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // Canvas pixel dimensions - use provided values or fall back to canvas.width/height
    const actualCanvasPixelWidth = canvasPixelWidth ?? canvas.width;
    const actualCanvasPixelHeight = canvasPixelHeight ?? canvas.height;
    
    // CRITICAL: Clear the overlay canvas completely before drawing
    ctx.clearRect(0, 0, actualCanvasPixelWidth, actualCanvasPixelHeight);
    
    // Scale from image space (1280x720) to canvas pixel space
    const scaleX = actualCanvasPixelWidth / imageWidth;
    const scaleY = actualCanvasPixelHeight / imageHeight;

    // Render each text box
    textBoxes.forEach((box) => {
      // Convert from image coordinates to canvas pixel coordinates
      const pixelX = box.x * scaleX;
      const pixelY = box.y * scaleY;
      const pixelWidth = box.width * scaleX;
      const pixelHeight = box.height * scaleY;
      
      // Calculate font size based on region height (60% of box height)
      const fontSize = Math.max(8, Math.min(pixelHeight * 0.6, 20));
      
      // Set font to measure text width
      ctx.font = `600 ${fontSize}px Arial`;
      const textMetrics = ctx.measureText(box.text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize * 1.2; // Approximate text height
      
      // Calculate position for centered text
      const textX = pixelX + pixelWidth / 2;
      const textY = pixelY + pixelHeight / 2;
      
      // Draw SMALL navy blue background ONLY behind the text
      const padding = 4;
      ctx.fillStyle = '#000080';
      ctx.fillRect(
        Math.round(textX - textWidth / 2 - padding),
        Math.round(textY - textHeight / 2 - padding),
        Math.round(textWidth + padding * 2),
        Math.round(textHeight + padding * 2)
      );

      // Draw white text on top of navy background
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(box.text, Math.round(textX), Math.round(textY));
    });
  }, [textBoxes, isEnabled, canvasRef, imageWidth, imageHeight, canvasPixelWidth, canvasPixelHeight]);

  return null;
}

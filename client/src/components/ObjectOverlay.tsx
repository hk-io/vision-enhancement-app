/**
 * Object Detection Overlay Component
 * 
 * Displays detected objects with:
 * - Blue bounding boxes
 * - Object labels (e.g., "Book", "Keyboard")
 * - "📖 Text" button if text is detected
 * - Click handlers for text display
 */

import { useEffect, useRef, useState } from 'react';
import type { DetectedObjectWithText } from '@/hooks/useHybridDetection';

interface ObjectOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  objects: DetectedObjectWithText[];
  isEnabled: boolean;
  onObjectTextClick: (text: string) => void;
}

export default function ObjectOverlay({
  canvasRef,
  objects,
  isEnabled,
  onObjectTextClick,
}: ObjectOverlayProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredTextButton, setHoveredTextButton] = useState<number | null>(null);

  useEffect(() => {
    if (!isEnabled || !canvasRef.current || !overlayCanvasRef.current || objects.length === 0) {
      return;
    }

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas size to main canvas
    canvas.width = canvasRef.current.width;
    canvas.height = canvasRef.current.height;

    // Calculate display scale
    const mainCanvas = canvasRef.current;
    const displayRect = mainCanvas.getBoundingClientRect();
    const scaleX = displayRect.width / mainCanvas.width;
    const scaleY = displayRect.height / mainCanvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each detected object
    objects.forEach((obj, idx) => {
      const [x, y, width, height] = obj.bbox;

      // Scale coordinates
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Draw blue bounding box
      ctx.strokeStyle = hoveredIndex === idx ? '#00FFFF' : '#0099FF';
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw semi-transparent blue fill
      ctx.fillStyle = hoveredIndex === idx ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 153, 255, 0.1)';
      ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw object label background
      const label = obj.class.toUpperCase();
      const confidence = `${(obj.score * 100).toFixed(0)}%`;
      const labelText = `${label} (${confidence})`;

      ctx.font = 'bold 14px Arial';
      const labelWidth = ctx.measureText(labelText).width;
      const labelHeight = 24;

      ctx.fillStyle = 'rgba(0, 153, 255, 0.9)';
      ctx.fillRect(scaledX - 2, Math.max(0, scaledY - labelHeight - 8), labelWidth + 12, labelHeight);

      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, scaledX + 4, Math.max(16, scaledY - 8));

      // Draw text button if text is detected
      if (obj.hasText) {
        const buttonText = '📖 Text';
        const buttonWidth = ctx.measureText(buttonText).width;
        const buttonHeight = 24;
        const buttonX = scaledX + scaledWidth - buttonWidth - 12;
        const buttonY = Math.max(0, scaledY - buttonHeight - 8);

        // Highlight button on hover
        const isButtonHovered = hoveredTextButton === idx;
        ctx.fillStyle = isButtonHovered ? '#00DD00' : '#00AA00';
        ctx.fillRect(buttonX - 4, buttonY, buttonWidth + 12, buttonHeight);

        // Add border if hovered
        if (isButtonHovered) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(buttonX - 4, buttonY, buttonWidth + 12, buttonHeight);
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.font = isButtonHovered ? 'bold 14px Arial' : '14px Arial';
        ctx.fillText(buttonText, buttonX + 2, buttonY + 16);
      }

      // Draw loading indicator if text is loading
      if (obj.textLoading) {
        ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
        ctx.fillRect(scaledX + 4, scaledY + scaledHeight - 28, scaledWidth - 8, 24);

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Loading text...', scaledX + 8, scaledY + scaledHeight - 10);
      }
    });
  }, [isEnabled, objects, canvasRef, hoveredIndex, hoveredTextButton]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayCanvasRef.current || !canvasRef.current || !isEnabled) return;

    const canvas = overlayCanvasRef.current;
    const mainCanvas = canvasRef.current;
    const displayRect = mainCanvas.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();

    // Get click position
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert to canvas coordinates
    const canvasX = (screenX / rect.width) * canvas.width;
    const canvasY = (screenY / rect.height) * canvas.height;

    // Calculate display scale
    const scaleX = displayRect.width / mainCanvas.width;
    const scaleY = displayRect.height / mainCanvas.height;

    // Check which object was clicked
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const [x, y, width, height] = obj.bbox;

      if (
        canvasX >= x &&
        canvasX <= x + width &&
        canvasY >= y &&
        canvasY <= y + height
      ) {
        // Check if text button was clicked
        if (obj.hasText) {
          const scaledX = x * scaleX;
          const scaledY = y * scaleY;
          const scaledWidth = width * scaleX;
          const scaledHeight = height * scaleY;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            const buttonText = '📖 Text';
            const buttonWidth = ctx.measureText(buttonText).width;
            const buttonHeight = 24;
            const buttonX = scaledX + scaledWidth - buttonWidth - 12;
            const buttonY = Math.max(0, scaledY - buttonHeight - 8);

            // Check if click is on button
            const displayScreenX = (canvasX / canvas.width) * displayRect.width;
            const displayScreenY = (canvasY / canvas.height) * displayRect.height;

            if (
              displayScreenX >= buttonX &&
              displayScreenX <= buttonX + buttonWidth + 12 &&
              displayScreenY >= buttonY &&
              displayScreenY <= buttonY + buttonHeight
            ) {
              // Text button clicked
              if (obj.textContent) {
                console.log(`📖 Text button clicked for object ${i + 1} (${obj.class}): "${obj.textContent.substring(0, 50)}..."`);
                onObjectTextClick(obj.textContent);
              } else if (obj.textLoading) {
                console.log(`Object ${i + 1} (${obj.class}): Text still loading...`);
              }
              return;
            }
          }
        }

        // Object clicked (not text button)
        if (obj.hasText && obj.textContent) {
          console.log(`Clicked object ${i + 1} (${obj.class}): "${obj.textContent.substring(0, 50)}..."`);
          onObjectTextClick(obj.textContent);
        } else if (obj.textLoading) {
          console.log(`Object ${i + 1} (${obj.class}): Text still loading...`);
        } else {
          console.log(`Object ${i + 1} (${obj.class}): No text detected`);
        }
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayCanvasRef.current || !canvasRef.current || !isEnabled) {
      setHoveredIndex(null);
      setHoveredTextButton(null);
      return;
    }

    const canvas = overlayCanvasRef.current;
    const mainCanvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const canvasX = (screenX / rect.width) * canvas.width;
    const canvasY = (screenY / rect.height) * canvas.height;

    // Calculate display scale
    const displayRect = mainCanvas.getBoundingClientRect();
    const scaleX = displayRect.width / mainCanvas.width;
    const scaleY = displayRect.height / mainCanvas.height;

    // Check which object is being hovered
    let foundHover = false;
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const [x, y, width, height] = obj.bbox;

      if (
        canvasX >= x &&
        canvasX <= x + width &&
        canvasY >= y &&
        canvasY <= y + height
      ) {
        setHoveredIndex(i);
        foundHover = true;

        // Check if hovering over text button
        if (obj.hasText) {
          const scaledX = x * scaleX;
          const scaledY = y * scaleY;
          const scaledWidth = width * scaleX;
          const scaledHeight = height * scaleY;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            const buttonText = '📖 Text';
            const buttonWidth = ctx.measureText(buttonText).width;
            const buttonHeight = 24;
            const buttonX = scaledX + scaledWidth - buttonWidth - 12;
            const buttonY = Math.max(0, scaledY - buttonHeight - 8);

            // Check if mouse is over button
            const displayScreenX = (canvasX / canvas.width) * displayRect.width;
            const displayScreenY = (canvasY / canvas.height) * displayRect.height;

            if (
              displayScreenX >= buttonX &&
              displayScreenX <= buttonX + buttonWidth + 12 &&
              displayScreenY >= buttonY &&
              displayScreenY <= buttonY + buttonHeight
            ) {
              setHoveredTextButton(i);
              return;
            }
          }
        }
        break;
      }
    }

    if (!foundHover) {
      setHoveredIndex(null);
    }
    setHoveredTextButton(null);
  };

  return (
    <canvas
      ref={overlayCanvasRef}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={() => {
        setHoveredIndex(null);
        setHoveredTextButton(null);
      }}
      className="absolute inset-0 cursor-pointer"
      style={{ display: isEnabled ? 'block' : 'none' }}
    />
  );
}

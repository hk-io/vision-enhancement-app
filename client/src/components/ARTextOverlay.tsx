/**
 * AR Text Overlay Component
 * 
 * Renders tight navy blue backgrounds directly on detected text
 * Each word gets its own box with white text inside
 * Font size scales with box height for readability
 */

import { useEffect, useState, ReactElement } from 'react';

export interface TextDetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence?: number;
}

interface ARTextOverlayProps {
  displayElement: HTMLImageElement | HTMLVideoElement;
  textBoxes: TextDetectionBox[];
  isEnabled: boolean;
  onTextClick?: (text: string) => void;  // Called when user taps a text overlay
  zoom?: number;  // Zoom multiplier for text boxes (1.0 = 100%, 3.0 = 300%)
  textStyle?: {
    backgroundColor: string;
    textColor: string;
    fontSizeMultiplier: number;
    fontFamily: string;
    bold: boolean;
  };
}

export function ARTextOverlay({
  displayElement,
  textBoxes,
  isEnabled,
  onTextClick,
  zoom = 1.0,
  textStyle,
}: ARTextOverlayProps) {
  const [overlayDivs, setOverlayDivs] = useState<(ReactElement | null)[]>([]);

  useEffect(() => {
    if (!isEnabled || !displayElement || textBoxes.length === 0) {
      setOverlayDivs([]);
      return;
    }

    // Get actual display dimensions
    const displayWidth = displayElement.offsetWidth;
    const displayHeight = displayElement.offsetHeight;

    // Get actual element dimensions (for img, use naturalWidth/naturalHeight; for video, use videoWidth/videoHeight)
    const videoWidth = displayElement instanceof HTMLImageElement 
      ? displayElement.naturalWidth 
      : (displayElement as HTMLVideoElement).videoWidth;
    const videoHeight = displayElement instanceof HTMLImageElement 
      ? displayElement.naturalHeight 
      : (displayElement as HTMLVideoElement).videoHeight;

    // Prevent division by zero
    if (videoWidth === 0 || videoHeight === 0 || displayWidth === 0 || displayHeight === 0) {
      console.warn('⚠️ Dimensions not ready:', { videoWidth, videoHeight, displayWidth, displayHeight });
      setOverlayDivs([]);
      return;
    }

    // Calculate scaling: image coordinates to display coordinates
    // Account for object-fit: cover which may crop/scale the image
    const imageAspect = videoWidth / videoHeight;
    const containerAspect = displayWidth / displayHeight;
    
    let scale: number;
    let offsetX = 0;
    let offsetY = 0;
    
    if (imageAspect > containerAspect) {
      // Image is wider - scale by height, center horizontally
      scale = displayHeight / videoHeight;
      const scaledWidth = videoWidth * scale;
      offsetX = (displayWidth - scaledWidth) / 2;
    } else {
      // Image is taller - scale by width, center vertically
      scale = displayWidth / videoWidth;
      const scaledHeight = videoHeight * scale;
      offsetY = (displayHeight - scaledHeight) / 2;
    }

    console.log('🎯 Display scaling:', { scale, offsetX, offsetY, displayWidth, displayHeight });
    console.log('📦 Processing', textBoxes.length, 'text boxes');
    console.log('📝 Sample boxes:', textBoxes.slice(0, 3).map(box => ({
      text: box.text.substring(0, 20),
      coords: { x: box.x, y: box.y, width: box.width, height: box.height },
    })));

    // Create overlay divs for each text box - tight backgrounds around individual words
    // Sort by Y position to ensure top text appears on top (higher z-index for lower Y values)
    const sortedBoxes = textBoxes.map((box, index) => ({ box, originalIndex: index }))
      .sort((a, b) => a.box.y - b.box.y);
    
    const newOverlayDivs = sortedBoxes.map(({ box, originalIndex }, sortedIndex) => {
      // Convert from image coordinates to display coordinates
      const displayX = box.x * scale + offsetX;
      const displayY = box.y * scale + offsetY;
      const displayBoxWidth = box.width * scale;
      const displayBoxHeight = box.height * scale;

      // Apply zoom multiplier to size only (keep position fixed)
      // This scales the text box from its center point
      const zoomScale = zoom;
      const scaledWidth = displayBoxWidth * zoomScale;
      const scaledHeight = displayBoxHeight * zoomScale;
      
      // Center the scaled box on the original position
      let zoomedX = displayX + (displayBoxWidth - scaledWidth) / 2;
      let zoomedY = displayY + (displayBoxHeight - scaledHeight) / 2;
      let zoomedWidth = scaledWidth;
      let zoomedHeight = scaledHeight;
      
      // Only clamp top to prevent going too far off-screen
      if (zoomedY < 0) {
        zoomedY = 0;
      }

      // Calculate font size based on box height
      // Use 70% of box height, minimum 10px, maximum 24px
      const baseFontSize = zoomedHeight * 0.7;
      const fontSize = Math.max(10, Math.min(24, baseFontSize));
      
      // Apply custom styling if provided
      const finalFontSize = textStyle ? fontSize * textStyle.fontSizeMultiplier : fontSize;
      const finalBackgroundColor = textStyle?.backgroundColor || '#000080';
      const finalTextColor = textStyle?.textColor || '#FFFFFF';
      const finalFontFamily = textStyle?.fontFamily || 'Arial, sans-serif';
      const finalFontWeight = textStyle?.bold ? '700' : '600';

      console.log(`Box ${sortedIndex}: ${box.text.substring(0, 20)}`, {
        imageCoords: { x: box.x, y: box.y, w: box.width, h: box.height },
        displayCoords: { x: displayX, y: displayY, w: displayBoxWidth, h: displayBoxHeight },
        fontSize: fontSize,
        zoomedCoords: { x: zoomedX, y: zoomedY, w: zoomedWidth, h: zoomedHeight },
      });

      return (
        <div
          key={`overlay-${originalIndex}`}
          className="absolute cursor-pointer"
          style={{
            left: `${zoomedX}px`,
            top: `${zoomedY}px`,
            width: `${zoomedWidth}px`,
            height: `${zoomedHeight}px`,
            backgroundColor: finalBackgroundColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0px',
            overflow: 'visible',
            zIndex: 1000 + (sortedBoxes.length - sortedIndex),  // Higher z-index for text higher on screen
            pointerEvents: 'none',  // Don't block clicks/interactions
          }}
          onClick={() => onTextClick?.(box.text)}
          title={box.text}
        >
          {/* Navy blue background with white text - no padding, tight fit */}
          <span
            style={{
              color: finalTextColor,
              fontSize: `${finalFontSize}px`,
              fontWeight: finalFontWeight,
              fontFamily: finalFontFamily,
              whiteSpace: 'nowrap',
              overflow: 'visible',
              width: 'auto',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0px 2px',
            }}
          >
            {box.text}
          </span>
        </div>
      );
    });

    setOverlayDivs(newOverlayDivs.filter((div): div is ReactElement => Boolean(div)));
  }, [textBoxes, isEnabled, displayElement, zoom, textStyle]);

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 40 }}>
      {overlayDivs}
    </div>
  );
}

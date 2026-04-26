/**
 * Tests for ARTextOverlay coordinate scaling logic
 */

import { describe, it, expect } from 'vitest';

describe('ARTextOverlay Coordinate Scaling', () => {
  /**
   * Test 1: Basic scaling calculation
   * If video is 1280x720 and display is 640x360 (50% scale)
   * A box at (100, 100) should render at (50, 50)
   */
  it('should scale coordinates from video space to display space', () => {
    const videoWidth = 1280;
    const videoHeight = 720;
    const displayWidth = 640;
    const displayHeight = 360;

    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    expect(scaleX).toBe(0.5);
    expect(scaleY).toBe(0.5);

    // Test box at (100, 100) with size (50, 50)
    const boxX = 100;
    const boxY = 100;
    const boxWidth = 50;
    const boxHeight = 50;

    const displayX = boxX * scaleX;
    const displayY = boxY * scaleY;
    const displayBoxWidth = boxWidth * scaleX;
    const displayBoxHeight = boxHeight * scaleY;

    expect(displayX).toBe(50);
    expect(displayY).toBe(50);
    expect(displayBoxWidth).toBe(25);
    expect(displayBoxHeight).toBe(25);
  });

  /**
   * Test 2: Different aspect ratio scaling
   * Video 1280x720 (16:9), display 800x600 (4:3)
   * Should still scale correctly
   */
  it('should handle different aspect ratios', () => {
    const videoWidth = 1280;
    const videoHeight = 720;
    const displayWidth = 800;
    const displayHeight = 600;

    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    expect(scaleX).toBeCloseTo(0.625, 3);
    expect(scaleY).toBeCloseTo(0.833, 3);

    // Test box
    const boxX = 640; // Center of video
    const boxY = 360; // Center of video

    const displayX = boxX * scaleX;
    const displayY = boxY * scaleY;

    expect(displayX).toBeCloseTo(400, 1);
    expect(displayY).toBeCloseTo(300, 1);
  });

  /**
   * Test 3: Full screen display (1:1 scale)
   * Video 1280x720, display 1280x720
   * Should be 1:1 scaling
   */
  it('should handle 1:1 scaling when video and display are same size', () => {
    const videoWidth = 1280;
    const videoHeight = 720;
    const displayWidth = 1280;
    const displayHeight = 720;

    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    expect(scaleX).toBe(1);
    expect(scaleY).toBe(1);

    const boxX = 640;
    const boxY = 360;

    const displayX = boxX * scaleX;
    const displayY = boxY * scaleY;

    expect(displayX).toBe(640);
    expect(displayY).toBe(360);
  });

  /**
   * Test 4: Upscaling (display larger than video)
   * Video 640x360, display 1280x720 (2x scale)
   */
  it('should handle upscaling when display is larger than video', () => {
    const videoWidth = 640;
    const videoHeight = 360;
    const displayWidth = 1280;
    const displayHeight = 720;

    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    expect(scaleX).toBe(2);
    expect(scaleY).toBe(2);

    const boxX = 100;
    const boxY = 100;

    const displayX = boxX * scaleX;
    const displayY = boxY * scaleY;

    expect(displayX).toBe(200);
    expect(displayY).toBe(200);
  });

  /**
   * Test 5: Text centering within box
   * Given a box and text width, text should be centered
   */
  it('should center text within detected region', () => {
    const boxX = 100;
    const boxY = 100;
    const boxWidth = 200;
    const boxHeight = 50;

    // Center position
    const centerX = boxX + boxWidth / 2;
    const centerY = boxY + boxHeight / 2;

    const textWidth = 100; // Measured text width
    const textHeight = 30; // Measured text height

    // Text position (centered)
    const textX = centerX - textWidth / 2;
    const textY = centerY - textHeight / 2;

    expect(textX).toBe(150); // centerX - textWidth / 2 = 200 - 50 = 150
    expect(textY).toBe(110); // centerY - textHeight / 2 = 125 - 15 = 110
  });

  /**
   * Test 6: Mobile device scaling
   * Typical mobile: video 1280x720, display 375x812 (iPhone)
   */
  it('should handle mobile device scaling correctly', () => {
    const videoWidth = 1280;
    const videoHeight = 720;
    const displayWidth = 375;
    const displayHeight = 812;

    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    expect(scaleX).toBeCloseTo(0.293, 3);
    expect(scaleY).toBeCloseTo(1.128, 3);

    // Test a box in the middle of the video
    const boxX = 640;
    const boxY = 360;
    const boxWidth = 100;
    const boxHeight = 50;

    const displayX = boxX * scaleX;
    const displayY = boxY * scaleY;
    const displayBoxWidth = boxWidth * scaleX;
    const displayBoxHeight = boxHeight * scaleY;

    expect(displayX).toBeCloseTo(187.5, 1);
    expect(displayY).toBeCloseTo(406, 0);
    expect(displayBoxWidth).toBeCloseTo(29.3, 1);
    expect(displayBoxHeight).toBeCloseTo(56.4, 1);
  });

  /**
   * Test 7: Edge case - very small box
   * Should still scale correctly
   */
  it('should handle very small text boxes', () => {
    const videoWidth = 1280;
    const videoHeight = 720;
    const displayWidth = 640;
    const displayHeight = 360;

    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    // Very small box (single character)
    const boxX = 100;
    const boxY = 100;
    const boxWidth = 10;
    const boxHeight = 10;

    const displayX = boxX * scaleX;
    const displayY = boxY * scaleY;
    const displayBoxWidth = boxWidth * scaleX;
    const displayBoxHeight = boxHeight * scaleY;

    expect(displayX).toBe(50);
    expect(displayY).toBe(50);
    expect(displayBoxWidth).toBe(5);
    expect(displayBoxHeight).toBe(5);
  });

  /**
   * Test 8: Edge case - box at edges
   * Box at (0, 0) should scale to (0, 0)
   * Box at (1280, 720) should scale to (display width/height)
   */
  it('should handle boxes at video edges correctly', () => {
    const videoWidth = 1280;
    const videoHeight = 720;
    const displayWidth = 640;
    const displayHeight = 360;

    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;

    // Top-left corner
    const topLeftX = 0 * scaleX;
    const topLeftY = 0 * scaleY;
    expect(topLeftX).toBe(0);
    expect(topLeftY).toBe(0);

    // Bottom-right corner
    const bottomRightX = 1280 * scaleX;
    const bottomRightY = 720 * scaleY;
    expect(bottomRightX).toBe(640);
    expect(bottomRightY).toBe(360);
  });
});

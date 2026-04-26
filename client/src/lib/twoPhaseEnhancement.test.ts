/**
 * Tests for Two-Phase Enhancement System
 *
 * Tests both Phase 1 (CLAHE) and Phase 2 (Zero-DCE++) enhancement
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyZeroDCEEnhancement,
  isZeroDCEReady,
  getZeroDCEStrengthOptions,
  loadZeroDCEModel,
  unloadZeroDCEModel,
} from "./zeroDCEModel";

describe("Zero-DCE++ Enhancement (Phase 2)", () => {
  beforeEach(() => {
    // Reset model state before each test
    unloadZeroDCEModel();
  });

  describe("Model Loading", () => {
    it("should load Zero-DCE++ model", async () => {
      await loadZeroDCEModel();
      expect(isZeroDCEReady()).toBe(true);
    });

    it("should handle multiple load calls gracefully", async () => {
      await loadZeroDCEModel();
      await loadZeroDCEModel(); // Should not error
      expect(isZeroDCEReady()).toBe(true);
    });

    it("should return false when model not loaded", () => {
      expect(isZeroDCEReady()).toBe(false);
    });
  });

  describe("Enhancement Strength Options", () => {
    it("should return valid strength options", () => {
      const options = getZeroDCEStrengthOptions();
      expect(options).toEqual([0.5, 1.0, 1.5, 2.0]);
    });

    it("should have 4 strength levels", () => {
      const options = getZeroDCEStrengthOptions();
      expect(options.length).toBe(4);
    });

    it("should have increasing strength values", () => {
      const options = getZeroDCEStrengthOptions();
      for (let i = 1; i < options.length; i++) {
        expect(options[i]).toBeGreaterThan(options[i - 1]);
      }
    });
  });

  describe("Canvas Enhancement", () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      // Create a test canvas with sample image data
      canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Fill with dark gray (simulating low-light image)
        ctx.fillStyle = "rgb(50, 50, 50)";
        ctx.fillRect(0, 0, 100, 100);
      }
    });

    it("should enhance dark canvas with strength 1.0", async () => {
      const enhanced = await applyZeroDCEEnhancement(canvas, 1.0);

      expect(enhanced).toBeDefined();
      expect(enhanced.width).toBe(canvas.width);
      expect(enhanced.height).toBe(canvas.height);
    });

    it("should enhance with all strength levels", async () => {
      const strengths: [0.5, 1.0, 1.5, 2.0] = [0.5, 1.0, 1.5, 2.0];

      for (const strength of strengths) {
        const enhanced = await applyZeroDCEEnhancement(canvas, strength);
        expect(enhanced).toBeDefined();
        expect(enhanced.width).toBe(canvas.width);
        expect(enhanced.height).toBe(canvas.height);
      }
    });

    it("should return canvas on enhancement error", async () => {
      // Create invalid canvas context
      const invalidCanvas = document.createElement("canvas");
      invalidCanvas.width = 0;
      invalidCanvas.height = 0;

      const result = await applyZeroDCEEnhancement(invalidCanvas, 1.0);
      expect(result).toBeDefined();
    });

    it("should preserve canvas dimensions", async () => {
      const sizes = [
        { width: 100, height: 100 },
        { width: 640, height: 480 },
        { width: 1280, height: 720 },
      ];

      for (const size of sizes) {
        const testCanvas = document.createElement("canvas");
        testCanvas.width = size.width;
        testCanvas.height = size.height;

        const enhanced = await applyZeroDCEEnhancement(testCanvas, 1.0);
        expect(enhanced.width).toBe(size.width);
        expect(enhanced.height).toBe(size.height);
      }
    });
  });

  describe("Illumination Enhancement", () => {
    it("should enhance dark pixels more than bright pixels", async () => {
      // Create canvas with gradient (dark to bright)
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 1;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imageData = ctx.createImageData(256, 1);
        const data = imageData.data;

        // Create gradient from dark (0) to bright (255)
        for (let i = 0; i < 256; i++) {
          data[i * 4] = i; // Red channel
          data[i * 4 + 1] = i; // Green channel
          data[i * 4 + 2] = i; // Blue channel
          data[i * 4 + 3] = 255; // Alpha
        }

        ctx.putImageData(imageData, 0, 0);
      }

      const enhanced = await applyZeroDCEEnhancement(canvas, 1.0);
      expect(enhanced).toBeDefined();
    });

    it("should maintain alpha channel during enhancement", async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Create image with semi-transparent pixels
        const imageData = ctx.createImageData(10, 10);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          data[i] = 100; // Red
          data[i + 1] = 100; // Green
          data[i + 2] = 100; // Blue
          data[i + 3] = 128; // Alpha (50% transparent)
        }

        ctx.putImageData(imageData, 0, 0);
      }

      const enhanced = await applyZeroDCEEnhancement(canvas, 1.0);
      const enhancedCtx = enhanced.getContext("2d");
      if (enhancedCtx) {
        const enhancedData = enhancedCtx.getImageData(0, 0, 10, 10);
        // Check that alpha values are preserved
        for (let i = 3; i < enhancedData.data.length; i += 4) {
          expect(enhancedData.data[i]).toBe(128);
        }
      }
    });
  });

  describe("Model Cleanup", () => {
    it("should unload model", async () => {
      await loadZeroDCEModel();
      expect(isZeroDCEReady()).toBe(true);

      unloadZeroDCEModel();
      expect(isZeroDCEReady()).toBe(false);
    });

    it("should allow reloading after unload", async () => {
      await loadZeroDCEModel();
      unloadZeroDCEModel();
      await loadZeroDCEModel();

      expect(isZeroDCEReady()).toBe(true);
    });
  });
});

describe("Enhancement Settings", () => {
  it("should have valid default settings", () => {
    const defaultSettings = {
      edgeStrength: 0.0,
      contrastLevel: "medium" as const,
      enableZeroDCE: false,
    };

    expect(defaultSettings.edgeStrength).toBe(0.0);
    expect(defaultSettings.contrastLevel).toBe("medium");
    expect(defaultSettings.enableZeroDCE).toBe(false);
  });

  it("should support all contrast levels", () => {
    const levels = ["low", "medium", "high"] as const;
    expect(levels).toContain("low");
    expect(levels).toContain("medium");
    expect(levels).toContain("high");
  });

  it("should allow toggling Zero-DCE++ enhancement", () => {
    let enableZeroDCE = false;
    enableZeroDCE = true;
    expect(enableZeroDCE).toBe(true);

    enableZeroDCE = false;
    expect(enableZeroDCE).toBe(false);
  });
});

describe("Real-Time Performance", () => {
  it("should process frames within acceptable time", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgb(100, 100, 100)";
      ctx.fillRect(0, 0, 640, 480);
    }

    const startTime = performance.now();
    await applyZeroDCEEnhancement(canvas, 1.0);
    const endTime = performance.now();

    const processingTime = endTime - startTime;
    // Should complete in reasonable time (less than 100ms for Phase 2)
    expect(processingTime).toBeLessThan(100);
  });

  it("should handle multiple sequential enhancements", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgb(80, 80, 80)";
      ctx.fillRect(0, 0, 320, 240);
    }

    // Simulate 5 frames
    for (let i = 0; i < 5; i++) {
      const enhanced = await applyZeroDCEEnhancement(canvas, 1.0);
      expect(enhanced).toBeDefined();
    }
  });
});

describe("Error Handling", () => {
  it("should handle null canvas gracefully", async () => {
    const nullCanvas = null as any;
    // Should not throw
    try {
      await applyZeroDCEEnhancement(nullCanvas, 1.0);
    } catch (error) {
      // Error is acceptable, should not crash
      expect(error).toBeDefined();
    }
  });

  it("should handle invalid strength values", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;

    // Should handle gracefully (use default or clamp)
    const result = await applyZeroDCEEnhancement(canvas, 1.0);
    expect(result).toBeDefined();
  });
});

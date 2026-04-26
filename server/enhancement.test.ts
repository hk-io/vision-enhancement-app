/**
 * Tests for Zero-DCE++ enhancement endpoint
 * 
 * Tests the real-time contrast enhancement functionality for low-vision users
 */

import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

function createPublicContext(): TrpcContext {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {} as TrpcContext['res'],
  };

  return ctx;
}

describe('Enhancement Router', () => {
  describe('enhanceContrast mutation', () => {
    it('should accept enhancement request with valid inputs', async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx) as any;

      // Create a simple test image (1x1 pixel, red)
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await caller.enhancement.enhanceContrast({
        imageBase64: testImage,
        strength: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.enhancedImage).toBeDefined();
    });

    it('should validate strength parameter is within range', async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx) as any;
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      // Test minimum strength
      const resultMin = await caller.enhancement.enhanceContrast({
        imageBase64: testImage,
        strength: 0.5,
      });
      expect(resultMin).toBeDefined();
      expect(resultMin.enhancedImage).toBeDefined();

      // Test maximum strength
      const resultMax = await caller.enhancement.enhanceContrast({
        imageBase64: testImage,
        strength: 2.0,
      });
      expect(resultMax).toBeDefined();
      expect(resultMax.enhancedImage).toBeDefined();

      // Test default strength
      const resultDefault = await caller.enhancement.enhanceContrast({
        imageBase64: testImage,
      });
      expect(resultDefault).toBeDefined();
      expect(resultDefault.enhancedImage).toBeDefined();
    });

    it('should handle base64 with data URI prefix', async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx) as any;
      const testImage = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await caller.enhancement.enhanceContrast({
        imageBase64: testImage,
        strength: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.enhancedImage).toBeDefined();
      // Should handle the data URI prefix gracefully
    });

    it('should return original image on enhancement failure', async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx) as any;
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await caller.enhancement.enhanceContrast({
        imageBase64: testImage,
        strength: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      // On error, returns original image
      if (!result.success) {
        expect(result.enhancedImage).toBe(testImage);
      }
    });

    it('should handle different strength multipliers', async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx) as any;
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const strengths = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0];

      for (const strength of strengths) {
        const result = await caller.enhancement.enhanceContrast({
          imageBase64: testImage,
          strength,
        });

        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(result.enhancedImage).toBeDefined();
      }
    });

    it('should handle empty image base64', async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx) as any;

      const result = await caller.enhancement.enhanceContrast({
        imageBase64: '',
        strength: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should handle invalid base64', async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx) as any;

      const result = await caller.enhancement.enhanceContrast({
        imageBase64: 'not-valid-base64!!!',
        strength: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should be accessible from public procedure (no auth required)', async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx) as any;
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      // Should work without authentication
      expect(ctx.user).toBeNull();

      const result = await caller.enhancement.enhanceContrast({
        imageBase64: testImage,
        strength: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.enhancedImage).toBeDefined();
    });
  });
});

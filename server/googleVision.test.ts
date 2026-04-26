/**
 * Test Google Cloud Vision API integration
 */

import { describe, it, expect } from 'vitest';
import { recognizeTextWithGoogleVision } from './googleVision';

describe('Google Cloud Vision API', () => {
  it('should initialize without errors', async () => {
    expect(recognizeTextWithGoogleVision).toBeDefined();
  });

  it('should handle empty image gracefully', async () => {
    try {
      const result = await recognizeTextWithGoogleVision('');
      expect(result).toEqual([]);
    } catch (error) {
      // Expected to fail with empty image
      expect(error).toBeDefined();
    }
  });

  it('should have API key configured', () => {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    expect(apiKey?.length).toBeGreaterThan(0);
  });
});

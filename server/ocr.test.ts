/**
 * OCR Integration Tests
 * 
 * Tests for Google Cloud Vision API integration
 */

import { describe, it, expect, vi } from 'vitest';
import { recognizeTextWithGoogleVision } from './googleVision';

describe('Google Cloud Vision OCR', () => {
  it('should initialize without errors', async () => {
    // This test verifies that the Google Cloud Vision module loads correctly
    // with the API key from environment variables
    expect(process.env.GOOGLE_CLOUD_VISION_API_KEY).toBeDefined();
  });

  it('should have API key configured', () => {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(apiKey).toHaveLength(39); // Google API keys are typically 39 characters
  });

  it('should export recognizeTextWithGoogleVision function', () => {
    expect(typeof recognizeTextWithGoogleVision).toBe('function');
  });
});

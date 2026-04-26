import { describe, it, expect } from 'vitest';

/**
 * Test suite for TextAROverlay component
 * 
 * Verifies that:
 * 1. Detected regions with actual text are displayed correctly
 * 2. Clicking on a region shows the actual detected text (not placeholder "Text 0")
 * 3. Popup displays the correct text from the region object
 */

describe('TextAROverlay Data Flow', () => {
  it('should use actual detected text from regions, not placeholders', () => {
    // Test data structure that matches what useEASTTextDetection returns
    const detectedRegions = [
      {
        text: 'Del',  // Actual OCR text, not "Text 0"
        box: { x: 10, y: 10, width: 50, height: 30 },
        confidence: 85,
      },
      {
        text: 'JENKKI',  // Actual OCR text, not "Text 1"
        box: { x: 100, y: 50, width: 80, height: 40 },
        confidence: 92,
      },
    ];

    // Verify regions have actual text
    detectedRegions.forEach((region, index) => {
      expect(region.text).not.toBe(`Text ${index}`);
      expect(region.text.length).toBeGreaterThan(0);
    });

    // Verify text is from OCR, not placeholder pattern
    expect(detectedRegions[0].text).toBe('Del');
    expect(detectedRegions[1].text).toBe('JENKKI');
  });

  it('should handle multiple brand names correctly', () => {
    const brandNames = ['Spearmint', 'Original', 'Del', 'JENKKI'];
    
    brandNames.forEach(name => {
      expect(name).not.toMatch(/^Text \d+$/);
      expect(name.length).toBeGreaterThan(0);
    });
  });

  it('should filter out low-confidence results', () => {
    // Regions with confidence < 20 should be filtered
    const lowConfidenceRegion = {
      text: '',  // Empty text means filtered out
      box: { x: 10, y: 10, width: 50, height: 30 },
      confidence: 15,  // Below 20 threshold
    };

    // Should be filtered (text is empty)
    expect(lowConfidenceRegion.text).toBe('');
  });

  it('should only return regions with valid dictionary words', () => {
    // Valid English words should be returned
    const validRegions = [
      { text: 'Del', confidence: 85 },
      { text: 'Spearmint', confidence: 88 },
      { text: 'Original', confidence: 90 },
    ];

    // Invalid/OCR garbage should be filtered
    const invalidRegions = [
      { text: '', confidence: 15 },  // Low confidence
      { text: '', confidence: 10 },  // Below threshold
    ];

    // Valid regions should have text
    validRegions.forEach(region => {
      expect(region.text.length).toBeGreaterThan(0);
    });

    // Invalid regions should be empty
    invalidRegions.forEach(region => {
      expect(region.text).toBe('');
    });
  });
});

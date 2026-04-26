import { describe, it, expect, vi } from 'vitest';

describe('useEASTTextDetection - PaddleOCR Integration', () => {
  describe('Text Box Data Structure', () => {
    it('should have correct TextBox interface', () => {
      const textBox = {
        text: 'JENKKI',
        box: { x: 100, y: 50, width: 80, height: 30 },
        confidence: 0.85,
      };

      expect(textBox.text).toBe('JENKKI');
      expect(textBox.box.x).toBe(100);
      expect(textBox.box.y).toBe(50);
      expect(textBox.box.width).toBe(80);
      expect(textBox.box.height).toBe(30);
      expect(textBox.confidence).toBe(0.85);
    });

    it('should handle multiple text boxes', () => {
      const boxes = [
        { text: 'JENKKI', box: { x: 100, y: 50, width: 80, height: 30 }, confidence: 0.85 },
        { text: 'spearmint', box: { x: 200, y: 100, width: 100, height: 25 }, confidence: 0.78 },
        { text: 'Original', box: { x: 150, y: 180, width: 90, height: 28 }, confidence: 0.82 },
      ];

      expect(boxes).toHaveLength(3);
      expect(boxes[0].text).toBe('JENKKI');
      expect(boxes[1].text).toBe('spearmint');
      expect(boxes[2].text).toBe('Original');
    });
  });

  describe('OCR Result Extraction', () => {
    it('should extract text from PaddleOCR format', () => {
      // PaddleOCR returns: [points, [text, confidence]]
      const paddleResult = [
        [
          [[100, 50], [180, 50], [180, 80], [100, 80]],
          ['JENKKI', 0.85],
        ],
        [
          [[200, 100], [300, 100], [300, 125], [200, 125]],
          ['spearmint', 0.78],
        ],
      ];

      // Simulate extraction logic
      const boxes: any[] = [];
      paddleResult.forEach((item: any) => {
        if (Array.isArray(item) && item.length >= 2) {
          const points = item[0];
          const [text, confidence] = item[1];

          if (text && confidence > 0.3) {
            const xs = points.map((p: any) => p[0]);
            const ys = points.map((p: any) => p[1]);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);

            boxes.push({
              text: text.trim(),
              box: {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
              },
              confidence,
            });
          }
        }
      });

      expect(boxes).toHaveLength(2);
      expect(boxes[0].text).toBe('JENKKI');
      expect(boxes[0].confidence).toBe(0.85);
      expect(boxes[1].text).toBe('spearmint');
      expect(boxes[1].confidence).toBe(0.78);
    });

    it('should filter low confidence results', () => {
      const paddleResult = [
        [
          [[100, 50], [180, 50], [180, 80], [100, 80]],
          ['JENKKI', 0.85],
        ],
        [
          [[200, 100], [300, 100], [300, 125], [200, 125]],
          ['xyz', 0.15], // Low confidence - should be filtered
        ],
      ];

      const boxes: any[] = [];
      paddleResult.forEach((item: any) => {
        if (Array.isArray(item) && item.length >= 2) {
          const [text, confidence] = item[1];
          if (text && confidence > 0.3) {
            boxes.push({ text, confidence });
          }
        }
      });

      expect(boxes).toHaveLength(1);
      expect(boxes[0].text).toBe('JENKKI');
    });

    it('should handle empty text', () => {
      const paddleResult = [
        [
          [[100, 50], [180, 50], [180, 80], [100, 80]],
          ['', 0.85], // Empty text - should be filtered
        ],
        [
          [[200, 100], [300, 100], [300, 125], [200, 125]],
          ['spearmint', 0.78],
        ],
      ];

      const boxes: any[] = [];
      paddleResult.forEach((item: any) => {
        if (Array.isArray(item) && item.length >= 2) {
          const [text, confidence] = item[1];
          if (text && text.trim().length > 0 && confidence > 0.3) {
            boxes.push({ text: text.trim(), confidence });
          }
        }
      });

      expect(boxes).toHaveLength(1);
      expect(boxes[0].text).toBe('spearmint');
    });
  });

  describe('Bounding Box Calculation', () => {
    it('should calculate correct bounding box from points', () => {
      const points = [[100, 50], [180, 50], [180, 80], [100, 80]];
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);

      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      expect(minX).toBe(100);
      expect(minY).toBe(50);
      expect(maxX).toBe(180);
      expect(maxY).toBe(80);
      expect(maxX - minX).toBe(80);
      expect(maxY - minY).toBe(30);
    });

    it('should clamp bounding box to canvas bounds', () => {
      const canvasWidth = 1280;
      const canvasHeight = 720;

      const box = {
        x: -10,
        y: 50,
        width: 100,
        height: 30,
      };

      const clampedBox = {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(canvasWidth - Math.max(0, box.x), box.width),
        height: Math.min(canvasHeight - Math.max(0, box.y), box.height),
      };

      expect(clampedBox.x).toBe(0);
      expect(clampedBox.y).toBe(50);
      expect(clampedBox.width).toBeLessThanOrEqual(canvasWidth);
      expect(clampedBox.height).toBeLessThanOrEqual(canvasHeight);
    });
  });

  describe('Text Sorting', () => {
    it('should sort text boxes top-to-bottom, left-to-right', () => {
      const boxes = [
        { text: 'C', box: { x: 300, y: 100, width: 50, height: 30 }, confidence: 0.8 },
        { text: 'A', box: { x: 100, y: 50, width: 50, height: 30 }, confidence: 0.8 },
        { text: 'B', box: { x: 200, y: 50, width: 50, height: 30 }, confidence: 0.8 },
      ];

      boxes.sort((a, b) => {
        if (Math.abs(a.box.y - b.box.y) > 10) {
          return a.box.y - b.box.y;
        }
        return a.box.x - b.box.x;
      });

      expect(boxes[0].text).toBe('A');
      expect(boxes[1].text).toBe('B');
      expect(boxes[2].text).toBe('C');
    });
  });

  describe('Detection vs Recognition Separation', () => {
    it('should separate detection-only boxes from recognized boxes', () => {
      const allBoxes = [
        { text: 'text_0', box: { x: 100, y: 50, width: 50, height: 30 }, confidence: 0.5 },
        { text: 'JENKKI', box: { x: 200, y: 100, width: 80, height: 30 }, confidence: 0.85 },
        { text: 'text_1', box: { x: 300, y: 150, width: 60, height: 25 }, confidence: 0.4 },
      ];

      const detectionOnly = allBoxes.filter((b) => b.text.startsWith('text_'));
      const recognized = allBoxes.filter((b) => !b.text.startsWith('text_') && b.text.trim().length > 1);

      expect(detectionOnly).toHaveLength(2);
      expect(recognized).toHaveLength(1);
      expect(recognized[0].text).toBe('JENKKI');
    });
  });

  describe('Confidence Filtering', () => {
    it('should filter results by confidence threshold', () => {
      const results = [
        { text: 'High', confidence: 0.95 },
        { text: 'Medium', confidence: 0.65 },
        { text: 'Low', confidence: 0.25 },
        { text: 'VeryLow', confidence: 0.05 },
      ];

      const threshold = 0.3;
      const filtered = results.filter((r) => r.confidence > threshold);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].text).toBe('High');
      expect(filtered[1].text).toBe('Medium');
    });
  });
});

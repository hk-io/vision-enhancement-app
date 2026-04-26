import { describe, it, expect } from 'vitest';
import { clusterTextRegions, sortClustersByPosition, formatClusterText, TextRegion } from './textClustering';

describe('Text Clustering', () => {
  it('should cluster nearby text regions', () => {
    const regions: TextRegion[] = [
      { text: 'Hello', box: { x: 0, y: 0, width: 50, height: 20 } },
      { text: 'World', box: { x: 60, y: 0, width: 50, height: 20 } }, // Close to Hello
      { text: 'Far', box: { x: 500, y: 500, width: 50, height: 20 } }, // Far away
    ];

    const clusters = clusterTextRegions(regions, 50);

    expect(clusters.length).toBe(2); // Hello+World together, Far separate
    expect(clusters[0].text).toContain('Hello');
    expect(clusters[0].text).toContain('World');
    expect(clusters[1].text).toContain('Far');
  });

  it('should handle empty regions', () => {
    const clusters = clusterTextRegions([], 50);
    expect(clusters.length).toBe(0);
  });

  it('should handle single region', () => {
    const regions: TextRegion[] = [
      { text: 'Single', box: { x: 0, y: 0, width: 50, height: 20 } },
    ];

    const clusters = clusterTextRegions(regions, 50);

    expect(clusters.length).toBe(1);
    expect(clusters[0].text).toEqual(['Single']);
  });

  it('should calculate correct bounding box for cluster', () => {
    const regions: TextRegion[] = [
      { text: 'A', box: { x: 0, y: 0, width: 20, height: 20 } },
      { text: 'B', box: { x: 30, y: 0, width: 20, height: 20 } },
    ];

    const clusters = clusterTextRegions(regions, 50);

    expect(clusters[0].box.x).toBe(0);
    expect(clusters[0].box.y).toBe(0);
    expect(clusters[0].box.width).toBe(50); // 0 to 50 (30+20)
    expect(clusters[0].box.height).toBe(20);
  });

  it('should sort clusters by position (top-to-bottom, left-to-right)', () => {
    const clusters = [
      { id: 0, text: ['Bottom-Right'], box: { x: 100, y: 100, width: 50, height: 20 }, regions: [] },
      { id: 1, text: ['Top-Left'], box: { x: 0, y: 0, width: 50, height: 20 }, regions: [] },
      { id: 2, text: ['Top-Right'], box: { x: 100, y: 0, width: 50, height: 20 }, regions: [] },
    ];

    const sorted = sortClustersByPosition(clusters);

    expect(sorted[0].text[0]).toBe('Top-Left');
    expect(sorted[1].text[0]).toBe('Top-Right');
    expect(sorted[2].text[0]).toBe('Bottom-Right');
  });

  it('should format cluster text with line breaks', () => {
    const cluster = {
      id: 0,
      text: ['Line1', 'Line2', 'Line3'],
      box: { x: 0, y: 0, width: 100, height: 60 },
      regions: [
        { text: 'Line1', box: { x: 0, y: 0, width: 50, height: 15 } },
        { text: 'Line2', box: { x: 0, y: 20, width: 50, height: 15 } },
        { text: 'Line3', box: { x: 0, y: 40, width: 50, height: 15 } },
      ],
    };

    const formatted = formatClusterText(cluster);

    expect(formatted).toBe('Line1\nLine2\nLine3');
  });

  it('should handle overlapping regions', () => {
    const regions: TextRegion[] = [
      { text: 'A', box: { x: 0, y: 0, width: 50, height: 50 } },
      { text: 'B', box: { x: 30, y: 30, width: 50, height: 50 } }, // Overlaps with A
    ];

    const clusters = clusterTextRegions(regions, 50);

    expect(clusters.length).toBe(1); // Should be merged
    expect(clusters[0].text).toContain('A');
    expect(clusters[0].text).toContain('B');
  });

  it('should respect maxDistance parameter', () => {
    const regions: TextRegion[] = [
      { text: 'A', box: { x: 0, y: 0, width: 20, height: 20 } },
      { text: 'B', box: { x: 100, y: 0, width: 20, height: 20 } }, // 80 pixels away
    ];

    const clusters1 = clusterTextRegions(regions, 50); // Too far
    expect(clusters1.length).toBe(2);

    const clusters2 = clusterTextRegions(regions, 100); // Close enough
    expect(clusters2.length).toBe(1);
  });
});

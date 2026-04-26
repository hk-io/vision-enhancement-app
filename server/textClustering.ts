/**
 * Text Clustering Utility
 * Groups nearby text regions into logical objects/frames
 * Uses DBSCAN-like clustering to find connected text regions
 */

export interface TextRegion {
  text: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

export interface TextCluster {
  id: number;
  text: string[];
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  regions: TextRegion[];
}

/**
 * Calculate distance between two boxes
 * Returns the minimum distance between any two edges
 */
function getBoxDistance(box1: TextRegion['box'], box2: TextRegion['box']): number {
  const x1End = box1.x + box1.width;
  const y1End = box1.y + box1.height;
  const x2End = box2.x + box2.width;
  const y2End = box2.y + box2.height;

  // Check if boxes overlap or are adjacent
  const xDistance = Math.max(0, Math.max(box1.x, box2.x) - Math.min(x1End, x2End));
  const yDistance = Math.max(0, Math.max(box1.y, box2.y) - Math.min(y1End, y2End));

  return Math.sqrt(xDistance * xDistance + yDistance * yDistance);
}

/**
 * Calculate bounding box that contains all regions in a cluster
 */
function calculateClusterBounds(regions: TextRegion[]): TextRegion['box'] {
  if (regions.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  regions.forEach((region) => {
    minX = Math.min(minX, region.box.x);
    minY = Math.min(minY, region.box.y);
    maxX = Math.max(maxX, region.box.x + region.box.width);
    maxY = Math.max(maxY, region.box.y + region.box.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Cluster text regions into logical objects
 * Uses proximity-based clustering to group nearby text
 *
 * @param regions - Array of text regions from Google Vision
 * @param maxDistance - Maximum distance (pixels) between regions to be in same cluster
 * @returns Array of clustered text objects
 */
export function clusterTextRegions(
  regions: TextRegion[],
  maxDistance: number = 40 // pixels - cluster nearby text on same line, separate lines get own boxes
): TextCluster[] {
  if (regions.length === 0) {
    return [];
  }

  // Initialize: each region is its own cluster
  const clusters: TextCluster[] = regions.map((region, idx) => ({
    id: idx,
    text: [region.text],
    box: region.box,
    regions: [region],
  }));

  let merged = true;
  while (merged) {
    merged = false;

    // Try to merge clusters that are close to each other
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const distance = getBoxDistance(clusters[i].box, clusters[j].box);

        if (distance <= maxDistance) {
          // Merge cluster j into cluster i
          clusters[i].regions.push(...clusters[j].regions);
          clusters[i].text.push(...clusters[j].text);
          clusters[i].box = calculateClusterBounds(clusters[i].regions);

          // Remove cluster j
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  // Renumber cluster IDs
  return clusters.map((cluster, idx) => ({
    ...cluster,
    id: idx,
  }));
}

/**
 * Sort clusters by position (left-to-right, top-to-bottom)
 * Makes the order more intuitive for users
 */
export function sortClustersByPosition(clusters: TextCluster[]): TextCluster[] {
  return [...clusters].sort((a, b) => {
    // Sort by Y first (top to bottom)
    if (Math.abs(a.box.y - b.box.y) > 30) {
      return a.box.y - b.box.y;
    }
    // Then by X (left to right) if roughly same Y
    return a.box.x - b.box.x;
  });
}

/**
 * Format cluster text for display
 * Organizes text by Y-position (top to bottom) to preserve line structure
 * Text on same horizontal line stays together, different lines are separated
 */
export function formatClusterText(cluster: TextCluster): string {
  // Sort regions by Y position (top to bottom), then X position (left to right)
  const sortedRegions = [...cluster.regions].sort((a, b) => {
    // If Y positions differ by more than 10 pixels, sort by Y (different lines)
    if (Math.abs(a.box.y - b.box.y) > 10) {
      return a.box.y - b.box.y;
    }
    // Otherwise sort by X (same line, left to right)
    return a.box.x - b.box.x;
  });

  // Group text by Y position to preserve line breaks
  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentY = sortedRegions[0]?.box.y ?? 0;

  for (const region of sortedRegions) {
    // If Y position changed significantly, start a new line
    if (Math.abs(region.box.y - currentY) > 10) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
        currentLine = [];
      }
      currentY = region.box.y;
    }
    currentLine.push(region.text);
  }

  // Add the last line
  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }

  return lines.join('\n');
}

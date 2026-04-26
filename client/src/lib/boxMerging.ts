/**
 * Box Merging Utility
 * 
 * Combines nearby text detection boxes on the same horizontal line
 * This groups individual character detections into full words without merging across lines
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence?: number;
}

/**
 * Check if two boxes are on the same horizontal line and close to each other
 * @param box1 First box
 * @param box2 Second box
 * @param horizontalThreshold Distance threshold in pixels (default 10)
 * @param verticalThreshold Y-coordinate tolerance for same line (default 15)
 * @returns true if boxes should be merged
 */
function shouldMerge(
  box1: Box,
  box2: Box,
  horizontalThreshold: number = 10,
  verticalThreshold: number = 15
): boolean {
  // Check if boxes are on the same horizontal line
  // They should have similar Y coordinates (within verticalThreshold)
  const yMid1 = box1.y + box1.height / 2;
  const yMid2 = box2.y + box2.height / 2;
  const yDifference = Math.abs(yMid1 - yMid2);

  if (yDifference > verticalThreshold) {
    // Not on same line, don't merge
    return false;
  }

  // Check horizontal gap between boxes
  const box1Right = box1.x + box1.width;
  const box2Left = box2.x;
  const box2Right = box2.x + box2.width;
  const box1Left = box1.x;

  // Calculate gap (negative means overlapping)
  const gap1to2 = box2Left - box1Right;
  const gap2to1 = box1Left - box2Right;
  const horizontalGap = Math.min(Math.max(gap1to2, 0), Math.max(gap2to1, 0));

  // Merge if boxes are horizontally close
  return horizontalGap <= horizontalThreshold;
}

/**
 * Merge two boxes into one
 * @param box1 First box
 * @param box2 Second box
 * @returns Merged box
 */
function mergeBoxes(box1: Box, box2: Box): Box {
  const x = Math.min(box1.x, box2.x);
  const y = Math.min(box1.y, box2.y);
  const right = Math.max(box1.x + box1.width, box2.x + box2.width);
  const bottom = Math.max(box1.y + box1.height, box2.y + box2.height);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    text: (box1.text + ' ' + box2.text).trim(),
    confidence: Math.min(box1.confidence || 0.8, box2.confidence || 0.8),
  };
}

/**
 * Merge nearby boxes on the same horizontal line
 * @param boxes Array of detection boxes
 * @param horizontalThreshold Distance threshold in pixels (default 10)
 * @param verticalThreshold Y-coordinate tolerance for same line (default 15)
 * @returns Array of merged boxes
 */
export function mergeNearbyBoxes(
  boxes: Box[],
  horizontalThreshold: number = 10,
  verticalThreshold: number = 15
): Box[] {
  if (boxes.length <= 1) return boxes;

  // Sort boxes by position (top-left to bottom-right)
  const sorted = [...boxes].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const merged: Box[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (shouldMerge(current, sorted[i], horizontalThreshold, verticalThreshold)) {
      // Merge with current
      current = mergeBoxes(current, sorted[i]);
    } else {
      // Save current and start new
      merged.push(current);
      current = sorted[i];
    }
  }

  // Add the last box
  merged.push(current);

  // If we merged some boxes, recursively merge again in case new overlaps were created
  if (merged.length < sorted.length) {
    return mergeNearbyBoxes(merged, horizontalThreshold, verticalThreshold);
  }

  return merged;
}

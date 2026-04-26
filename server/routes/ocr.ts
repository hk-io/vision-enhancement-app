/**
 * Simple REST API for OCR - bypasses tRPC complexity
 */

import { Router } from 'express';
import { recognizeTextWithGoogleVision } from '../googleVision';
import { clusterTextRegions, sortClustersByPosition, formatClusterText } from '../textClustering';

export const ocrRouter = Router();

// Test endpoint
ocrRouter.post('/test', (req, res) => {
  console.log('✅ TEST ENDPOINT CALLED');
  res.json({ success: true, message: 'Test endpoint working' });
});

ocrRouter.post('/recognize', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({
        error: 'imageBase64 is required',
      });
    }
    
    console.log('🔍 REST OCR endpoint called with image size:', imageBase64.length);
    console.log('🔍 Image base64 first 100 chars:', imageBase64.substring(0, 100));
    
    console.log('🔍 Calling Google Vision API...');
    const textRegions = await recognizeTextWithGoogleVision(imageBase64);
    console.log('✅ OCR endpoint returning', textRegions.length, 'regions');
    
    // Cluster nearby text regions
    const clusters = clusterTextRegions(textRegions, 75);
    const sortedClusters = sortClustersByPosition(clusters);
    
    // Format cluster text
    const formattedClusters = sortedClusters.map(cluster => ({
      ...cluster,
      formattedText: formatClusterText(cluster),
    }));
    
    console.log(`🎯 Clustered ${textRegions.length} regions into ${sortedClusters.length} objects`);
    
    console.log('🔍 Sending response with', formattedClusters.length, 'clusters');
    return res.json({
      success: true,
      regions: textRegions,
      clusters: formattedClusters,
      count: formattedClusters.length,
    });
  } catch (error) {
    console.error('❌ REST OCR endpoint error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('🔴 Sending error response:', errorMsg);
    return res.status(500).json({
      success: false,
      error: errorMsg,
      regions: [],
      clusters: [],
      count: 0,
    });
  }
});

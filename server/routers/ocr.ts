/**
 * OCR Router - tRPC procedures for text recognition
 */

import { z } from 'zod';
import { publicProcedure } from '../_core/trpc';
import { recognizeTextWithGoogleVision } from '../googleVision';
import { clusterTextRegions, sortClustersByPosition, formatClusterText } from '../textClustering';

export const ocrRouter = {
  /**
   * Recognize text in an image using Google Cloud Vision
   * 
   * Input: Base64 encoded image data
   * Output: Array of recognized text regions with bounding boxes
   */
  recognizeText: publicProcedure
    .input(
      z.object({
        imageBase64: z.string().describe('Base64 encoded image data'),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log('🔍 OCR endpoint called with image size:', input.imageBase64.length);
        console.log('📸 Image base64 first 50 chars:', input.imageBase64.substring(0, 50));
        const textRegions = await recognizeTextWithGoogleVision(input.imageBase64);
        console.log('✅ OCR endpoint returning', textRegions.length, 'regions');
        if (textRegions.length > 0) {
          console.log('📝 First 3 regions:', JSON.stringify(textRegions.slice(0, 3)));
        } else {
          console.log('⚠️ WARNING: No regions returned from Google Vision!');
        }

        // Return individual word bounding boxes (not clustered)
        // This allows tight navy backgrounds around each word, not entire clusters
        console.log(`📦 Returning ${textRegions.length} individual word regions for tight AR overlays`);
        if (textRegions.length > 0) {
          console.log('📊 First 3 words:', textRegions.slice(0, 3).map(r => ({
            text: r.text,
            box: r.box,
          })));
        }

        return {
          success: true,
          regions: textRegions,  // Return individual words, not clustered
          clusters: textRegions,
          count: textRegions.length,
        };
      } catch (error) {
        console.error('❌ OCR endpoint error:', error);
        return {
          success: false,
          regions: [],
          clusters: [],
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),
};

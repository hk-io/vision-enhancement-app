/**
 * Enhancement Router - tRPC procedures for image enhancement
 * Using Zero-DCE++ (Li et al. 2021) for contrast enhancement
 * Reference: Li, C., Guo, C., Loy, C. C. (2021). "Learning to Enhance Low-Light Image via Zero-Reference Deep Curve Estimation."
 * IEEE Transactions on Pattern Analysis and Machine Intelligence (TPAMI), 43(4), 1467-1479.
 */

import { z } from 'zod';
import { publicProcedure } from '../_core/trpc';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Call Zero-DCE++ Python backend via subprocess
 * Uses official pre-trained model (Epoch99.pth) from authors
 */
async function enhanceImageWithZeroDCE(
  imageBase64: string,
  strength: number = 1.0
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const pythonScript = path.join(__dirname, '../../server/zeroDCE_worker.py');
      
      // Force system Python 3.11 with minimal environment
      const minimalEnv: NodeJS.ProcessEnv = {
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        HOME: '/root',
        PYTHONDONTWRITEBYTECODE: '1'
      };
      
      const python = spawn('/usr/bin/python3.11', [pythonScript], { 
        env: minimalEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      let timedOut = false;

      // Set timeout - if Python takes more than 60 seconds, kill it and return error
      const timeout = setTimeout(() => {
        timedOut = true;
        console.error('⏱️ Python process timeout (60s)');
        python.kill('SIGKILL');
        reject(new Error('Enhancement timeout after 60 seconds - Python process killed'));
      }, 60000);

      python.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log('📄 Python stdout chunk:', chunk.substring(0, 100));
      });

      python.stderr.on('data', (data) => {
        const errorMsg = data.toString();
        errorOutput += errorMsg;
        console.warn('🐍 Python stderr:', errorMsg.substring(0, 200));
      });

      python.on('close', (code) => {
        clearTimeout(timeout);
        
        if (timedOut) {
          console.error('⏱️ Process already timed out, ignoring close event');
          return;
        }
        
        if (code !== 0) {
          console.error('❌ Python exited with code', code);
          console.error('❌ Full stderr:', errorOutput);
          console.error('❌ Full stdout:', output);
          reject(new Error(`Enhancement failed with code ${code}: ${errorOutput || output}`));
          return;
        }
        
        console.log('✅ Python process completed successfully (code 0)');

        try {
          console.log('📋 Parsing Python output...');
          const result = JSON.parse(output);
          if (result.success) {
            console.log('✅ Zero-DCE++ enhancement complete');
            console.log('📊 Enhanced image size:', Math.round(result.enhanced_image.length / 1024), 'KB');
            resolve(result.enhanced_image);
          } else {
            console.error('❌ Python returned error:', result.error);
            reject(new Error(result.error || 'Enhancement failed'));
          }
        } catch (e) {
          console.error('❌ Failed to parse Python output');
          console.error('❌ Output was:', output.substring(0, 200));
          console.error('❌ Parse error:', e);
          reject(new Error('Invalid enhancement response'));
        }
      });

      // Send input to Python
      python.stdin.write(
        JSON.stringify({
          image_base64: imageBase64,
          strength: strength,
        })
      );
      python.stdin.end();
    } catch (error) {
      console.error('❌ Error spawning Python:', error);
      reject(error);
    }
  });
}

export const enhancementRouter = {
  // Test endpoint to verify tRPC connection
  test: publicProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input }) => {
      console.log('🧪 Test endpoint called with:', input.message);
      return {
        success: true,
        message: `Test received: ${input.message}`,
        timestamp: new Date().toISOString(),
      };
    }),

  enhanceContrast: publicProcedure
    .input(
      z.object({
        imageBase64: z.string().min(1, 'Image data required'),
        strength: z.number().min(0.5).max(2).default(1.0),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log('🎎 Enhancement endpoint called');
        console.log('📊 Image size:', Math.round(input.imageBase64.length / 1024), 'KB');
        console.log('📊 Strength:', input.strength);
        console.log('📊 Image base64 starts with:', input.imageBase64.substring(0, 50));
        
        // Call real Zero-DCE++ model
        console.log('🔠 Calling enhanceImageWithZeroDCE...');
        const enhancedBase64 = await enhanceImageWithZeroDCE(input.imageBase64, input.strength);
        console.log('📊 Enhanced image size:', Math.round(enhancedBase64.length / 1024), 'KB');
        
        return {
          success: true,
          enhancedImage: enhancedBase64,
        };
      } catch (error) {
        console.error('❌ Enhancement error:', error);
        console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
        
        // Return original on error
        console.log('⚠️ Returning original image as fallback');
        return {
          success: false,
          enhancedImage: input.imageBase64,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),
};

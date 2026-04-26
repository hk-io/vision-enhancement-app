/**
 * Zero-DCE++ Server-Side Inference
 * Uses PyTorch to run the actual Epoch99.pth model
 * Accepts base64 image frames and returns enhancement map
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const MODEL_PATH = '/tmp/Zero-DCE_extension/Zero-DCE++/snapshots_Zero_DCE++/Epoch99.pth';
const PYTHON_SCRIPT = path.join(process.cwd(), 'server', 'zero_dce_inference.py');

/**
 * Run Zero-DCE++ inference on a frame
 * @param base64Image - Base64 encoded image
 * @returns Enhancement map as base64
 */
export async function inferZeroDCE(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create temporary input file
    const inputFile = `/tmp/zero_dce_input_${Date.now()}.jpg`;
    const outputFile = `/tmp/zero_dce_output_${Date.now()}.jpg`;

    try {
      // Write base64 image to file
      const imageBuffer = Buffer.from(base64Image, 'base64');
      fs.writeFileSync(inputFile, imageBuffer);

      // Spawn Python process for inference
      const python = spawn('python3', [PYTHON_SCRIPT, inputFile, outputFile, MODEL_PATH]);

      let stderr = '';

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        try {
          if (code !== 0) {
            reject(new Error(`Python inference failed: ${stderr}`));
            return;
          }

          // Read output file and convert to base64
          const outputBuffer = fs.readFileSync(outputFile);
          const outputBase64 = outputBuffer.toString('base64');

          // Cleanup
          fs.unlinkSync(inputFile);
          fs.unlinkSync(outputFile);

          resolve(outputBase64);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

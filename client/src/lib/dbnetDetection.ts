/**
 * DBNet Text Detection
 * 
 * Real-Time Scene Text Detection with Differentiable Binarization
 * Paper: DBNet - https://arxiv.org/abs/2202.10304
 * 
 * This uses ONNX Runtime to run DBNet for real-time text detection
 */

import * as ort from 'onnxruntime-web';

export interface TextDetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export class DBNetDetector {
  private session: ort.InferenceSession | null = null;
  private isLoading = false;
  private isReady = false;
  private modelUrl: string;

  constructor(modelUrl: string = '/models/dbnet/model.onnx') {
    this.modelUrl = modelUrl;
  }

  async load(): Promise<void> {
    if (this.isReady) return;
    if (this.isLoading) return;

    this.isLoading = true;
    try {
      // Set ONNX Runtime to use WebGPU backend
      ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';
      
      this.session = await ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      
      this.isReady = true;
      console.log('DBNet model loaded successfully');
    } catch (error) {
      console.error('Failed to load DBNet model:', error);
      this.isLoading = false;
      throw error;
    }
    this.isLoading = false;
  }

  isModelReady(): boolean {
    return this.isReady && this.session !== null;
  }

  /**
   * Detect text regions in image
   */
  async detect(imageData: ImageData, confidenceThreshold: number = 0.5): Promise<TextDetectionBox[]> {
    if (!this.isModelReady() || !this.session) {
      throw new Error('DBNet model not loaded');
    }

    try {
      // Prepare input
      const input = this.preprocessImage(imageData);
      
      // Run inference
      const feeds = { images: input };
      const results = await this.session.run(feeds);
      
      // Post-process results
      const boxes = this.postprocessResults(results, imageData.width, imageData.height, confidenceThreshold);
      
      // Cleanup
      input.dispose();
      
      return boxes;
    } catch (error) {
      console.error('DBNet detection error:', error);
      return [];
    }
  }

  /**
   * Preprocess image for DBNet
   */
  private preprocessImage(imageData: ImageData): ort.Tensor {
    const { data, width, height } = imageData;
    
    // Resize to model input size (typically 640x640)
    const targetSize = 640;
    const resized = this.resizeImage(data, width, height, targetSize, targetSize);
    
    // Normalize to [0, 1]
    const normalized = new Float32Array(resized.length);
    for (let i = 0; i < resized.length; i++) {
      normalized[i] = resized[i] / 255.0;
    }
    
    // Create tensor
    const tensor = new ort.Tensor('float32', normalized, [1, 3, targetSize, targetSize]);
    return tensor;
  }

  /**
   * Resize image data
   */
  private resizeImage(
    imageData: Uint8ClampedArray,
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number
  ): Uint8Array {
    const resized = new Uint8Array(dstWidth * dstHeight * 3);
    
    const xRatio = srcWidth / dstWidth;
    const yRatio = srcHeight / dstHeight;
    
    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const srcX = Math.floor(x * xRatio);
        const srcY = Math.floor(y * yRatio);
        const srcIdx = (srcY * srcWidth + srcX) * 4;
        const dstIdx = (y * dstWidth + x) * 3;
        
        resized[dstIdx] = imageData[srcIdx];     // R
        resized[dstIdx + 1] = imageData[srcIdx + 1]; // G
        resized[dstIdx + 2] = imageData[srcIdx + 2]; // B
      }
    }
    
    return resized;
  }

  /**
   * Post-process DBNet output to get text boxes
   */
  private postprocessResults(
    results: Record<string, ort.Tensor>,
    imgWidth: number,
    imgHeight: number,
    confidenceThreshold: number
  ): TextDetectionBox[] {
    const boxes: TextDetectionBox[] = [];
    
    try {
      // Get the output tensor (typically named 'output' or 'predictions')
      const outputKey = Object.keys(results)[0];
      const output = results[outputKey];
      
      if (!output) return boxes;
      
      const data = output.data as Float32Array;
      
      // Parse bounding boxes from output
      // Format depends on model, typically: [x1, y1, x2, y2, confidence, ...]
      for (let i = 0; i < data.length; i += 5) {
        if (i + 4 >= data.length) break;
        
        const confidence = data[i + 4];
        if (confidence < confidenceThreshold) continue;
        
        const x1 = Math.max(0, data[i] * imgWidth / 640);
        const y1 = Math.max(0, data[i + 1] * imgHeight / 640);
        const x2 = Math.min(imgWidth, data[i + 2] * imgWidth / 640);
        const y2 = Math.min(imgHeight, data[i + 3] * imgHeight / 640);
        
        boxes.push({
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
          confidence: confidence,
        });
      }
    } catch (error) {
      console.error('Error post-processing DBNet results:', error);
    }
    
    return boxes;
  }

  dispose(): void {
    if (this.session) {
      this.session.release();
      this.session = null;
      this.isReady = false;
    }
  }
}

export async function createDBNetDetector(modelUrl?: string): Promise<DBNetDetector> {
  const detector = new DBNetDetector(modelUrl);
  await detector.load();
  return detector;
}

/**
 * TrOCR Text Recognition
 * 
 * Transformer-based Optical Character Recognition
 * Paper: TrOCR - Microsoft Research
 * https://www.microsoft.com/en-us/research/publication/trocr-transformer-based-optical-character-recognition-with-pre-trained-models/
 * 
 * Uses Transformers.js for browser-based OCR
 */

import { pipeline } from '@xenova/transformers';

export interface RecognizedText {
  text: string;
  confidence: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class TrOCRRecognizer {
  private recognizer: any = null;
  private isLoading = false;
  private isReady = false;

  async load(): Promise<void> {
    if (this.isReady) return;
    if (this.isLoading) return;

    this.isLoading = true;
    try {
      // Load TrOCR model from Hugging Face
      this.recognizer = await pipeline('document-question-answering', 'Xenova/trocr-base-printed');
      this.isReady = true;
      console.log('TrOCR model loaded successfully');
    } catch (error) {
      console.error('Failed to load TrOCR model:', error);
      this.isLoading = false;
      throw error;
    }
    this.isLoading = false;
  }

  isModelReady(): boolean {
    return this.isReady && this.recognizer !== null;
  }

  /**
   * Recognize text in image region
   */
  async recognize(imageData: ImageData, box?: { x: number; y: number; width: number; height: number }): Promise<RecognizedText> {
    if (!this.isModelReady() || !this.recognizer) {
      throw new Error('TrOCR model not loaded');
    }

    try {
      // Crop image to text region if box provided
      const croppedImage = box ? this.cropImage(imageData, box) : imageData;
      
      // Convert ImageData to canvas for processing
      const canvas = new OffscreenCanvas(croppedImage.width, croppedImage.height);
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(croppedImage, 0, 0);
      
      // Run recognition
      const result = await this.recognizer(canvas);
      
      return {
        text: result[0]?.answer || '',
        confidence: result[0]?.score || 0,
        box: box || { x: 0, y: 0, width: imageData.width, height: imageData.height },
      };
    } catch (error) {
      console.error('TrOCR recognition error:', error);
      return {
        text: '',
        confidence: 0,
        box: box || { x: 0, y: 0, width: imageData.width, height: imageData.height },
      };
    }
  }

  /**
   * Crop image to specific region
   */
  private cropImage(
    imageData: ImageData,
    box: { x: number; y: number; width: number; height: number }
  ): ImageData {
    const { x, y, width, height } = box;
    const srcData = imageData.data;
    const srcWidth = imageData.width;
    
    const croppedData = new Uint8ClampedArray(Math.ceil(width) * Math.ceil(height) * 4);
    
    for (let cy = 0; cy < height; cy++) {
      for (let cx = 0; cx < width; cx++) {
        const srcIdx = ((Math.floor(y + cy) * srcWidth + Math.floor(x + cx)) * 4);
        const dstIdx = (cy * Math.ceil(width) + cx) * 4;
        
        croppedData[dstIdx] = srcData[srcIdx];
        croppedData[dstIdx + 1] = srcData[srcIdx + 1];
        croppedData[dstIdx + 2] = srcData[srcIdx + 2];
        croppedData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }
    
    return new ImageData(croppedData, Math.ceil(width), Math.ceil(height));
  }

  dispose(): void {
    if (this.recognizer) {
      this.recognizer = null;
      this.isReady = false;
    }
  }
}

export async function createTrOCRRecognizer(): Promise<TrOCRRecognizer> {
  const recognizer = new TrOCRRecognizer();
  await recognizer.load();
  return recognizer;
}

/**
 * OCR Web Worker
 * 
 * Runs Tesseract OCR in a background thread to avoid blocking the UI.
 * Receives image data and returns extracted text.
 */

import Tesseract from 'tesseract.js';

let worker: Tesseract.Worker | null = null;
let isInitialized = false;

// Initialize Tesseract worker
async function initializeWorker() {
  if (isInitialized && worker) return;
  
  try {
    worker = await Tesseract.createWorker('eng');
    isInitialized = true;
    console.log('✅ OCR Worker initialized');
    self.postMessage({ type: 'initialized', success: true });
  } catch (error) {
    console.error('❌ Failed to initialize OCR worker:', error);
    self.postMessage({ type: 'initialized', success: false, error: String(error) });
  }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, data } = event.data;

  if (type === 'init') {
    await initializeWorker();
    return;
  }

  if (type === 'recognize') {
    if (!worker) {
      self.postMessage({ type: 'error', message: 'Worker not initialized' });
      return;
    }

    try {
      const { imageData, id } = data;
      
      // Recognize text from image data
      const result = await worker.recognize(imageData);
      const text = result.data.text.trim();
      const confidence = result.data.confidence;

      console.log(`✅ OCR result for region ${id}: "${text}" (confidence: ${confidence})`);
      
      self.postMessage({
        type: 'result',
        id,
        text,
        confidence,
        success: true
      });
    } catch (error) {
      console.error('❌ OCR recognition error:', error);
      self.postMessage({
        type: 'result',
        id: data.id,
        text: '',
        confidence: 0,
        success: false,
        error: String(error)
      });
    }
  }

  if (type === 'terminate') {
    if (worker) {
      await worker.terminate();
      worker = null;
      isInitialized = false;
      console.log('✅ OCR Worker terminated');
    }
  }
};

// Handle worker errors
self.onerror = (event: any) => {
  const message = typeof event === 'string' ? event : (event?.message || 'Unknown error');
  console.error('Worker error:', message);
  self.postMessage({ type: 'error', message });
};

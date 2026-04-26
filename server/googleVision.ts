/**
 * Google Cloud Vision OCR Integration
 * 
 * Server-side module for calling Google Cloud Vision REST API
 * to recognize text from camera frames
 */

export interface TextRegion {
  text: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

/**
 * Recognize text in an image using Google Cloud Vision REST API
 * 
 * @param imageBase64 - Base64 encoded image data
 * @returns Array of recognized text regions with bounding boxes
 */
export async function recognizeTextWithGoogleVision(
  imageBase64: string
): Promise<TextRegion[]> {
  try {
    console.log('🔄 Calling Google Cloud Vision REST API...');
    console.log('📊 Image data size:', imageBase64.length, 'bytes');
    
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_VISION_API_KEY not set');
    }

    // Build request for Google Cloud Vision API
    const request = {
      requests: [
        {
          image: {
            content: imageBase64,
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 100,
            },
          ],
        },
      ],
    };

    console.log('📡 Sending request to Google Cloud Vision REST API...');
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏱️ Google Vision API timeout after 10 seconds');
      controller.abort();
    }, 10000);
    
    let response;
    try {
      response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(
        `Google Cloud Vision API error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    console.log('✅ API Response received');
    
    // Check for errors in response
    if (data.responses?.[0]?.error) {
      console.error('❌ API returned error:', data.responses[0].error);
      const errorMsg = data.responses[0].error.message || 'Unknown error';
      throw new Error(`Google Vision API error: ${errorMsg}`);
    }

    const detections = data.responses?.[0]?.textAnnotations || [];
    console.log('📝 Number of detections:', detections.length);
    console.log('📝 Full API response:', JSON.stringify(data.responses?.[0], null, 2));
    
    // Debug: Log raw response
    if (detections.length === 0) {
      console.log('⚠️ DEBUG: textAnnotations is empty');
      console.log('⚠️ DEBUG: Full response keys:', Object.keys(data.responses?.[0] || {}));
      console.log('⚠️ DEBUG: Full response:', JSON.stringify(data, null, 2));
    }

    if (!detections.length) {
      console.log('ℹ️ No text detected in image');
      return [];
    }

    // Convert Google Vision response to our format
    // Skip first element (full text) and process individual words/lines
    const textRegions: TextRegion[] = detections
      .slice(1) // Skip first element (full text)
      .map((detection: any) => {
        const vertices = detection.boundingPoly?.vertices || [];
        if (vertices.length < 2) return null;

        // Calculate bounding box
        const xs = vertices.map((v: any) => v.x || 0);
        const ys = vertices.map((v: any) => v.y || 0);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        const text = detection.description || '';
        if (!text.trim()) return null;

        // Calculate original box dimensions
        const originalWidth = maxX - minX;
        const originalHeight = maxY - minY;
        
        // Estimate font size from box height (typical ratio is ~0.7-0.8)
        const estimatedFontSize = Math.round(originalHeight * 0.75);
        
        // Estimate text width using average character width
        // For most fonts, average char width is ~0.5-0.6 of font size
        const estimatedCharWidth = estimatedFontSize * 0.55;
        const estimatedTextWidth = text.length * estimatedCharWidth;
        
        // Calculate how much extra space we need
        const extraWidthNeeded = Math.max(0, estimatedTextWidth - originalWidth);
        
        // Add 30% buffer for safety
        const totalPadding = extraWidthNeeded * 1.3;
        const leftPadding = totalPadding / 2;
        const rightPadding = totalPadding / 2;
        
        // Calculate final box with dynamic padding
        const finalX = Math.max(0, minX - leftPadding);
        const finalWidth = originalWidth + leftPadding + rightPadding;
        
        return {
          text,
          box: {
            x: finalX,
            y: minY,
            width: finalWidth,
            height: originalHeight,
          },
          confidence: detection.confidence || 0.8,
        };
      })
      .filter((region: any): region is TextRegion => region !== null);

    console.log(`✅ Recognized ${textRegions.length} text regions`);
    console.log('📝 Sample regions:', textRegions.slice(0, 3).map(r => r.text));
    return textRegions;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('❌ Google Cloud Vision API timeout');
        throw new Error('Google Vision API timeout - please try again');
      }
      console.error('❌ Google Cloud Vision error:', error.message);
    } else {
      console.error('❌ Google Cloud Vision error:', error);
    }
    throw error;
  }
}

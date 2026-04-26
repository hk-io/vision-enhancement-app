import vision from '@google-cloud/vision';
import fs from 'fs';

const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
console.log('API Key available:', !!apiKey);

if (!apiKey) {
  console.error('GOOGLE_CLOUD_VISION_API_KEY not set!');
  process.exit(1);
}

const client = new vision.ImageAnnotatorClient({
  apiKey: apiKey,
});

// Test with a simple image URL
async function testGoogleVision() {
  try {
    console.log('Testing Google Cloud Vision API...');
    
    // Use a public image with text
    const request = {
      image: {
        source: {
          imageUri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/1024px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
        },
      },
    };

    const [result] = await client.textDetection(request);
    const detections = result.textAnnotations || [];
    
    console.log(`✅ Google Cloud Vision API works!`);
    console.log(`Found ${detections.length} text annotations`);
    
    if (detections.length > 0) {
      console.log('First annotation:', detections[0].description?.substring(0, 100));
    }
  } catch (error) {
    console.error('❌ Google Cloud Vision API error:', error.message);
    process.exit(1);
  }
}

testGoogleVision();

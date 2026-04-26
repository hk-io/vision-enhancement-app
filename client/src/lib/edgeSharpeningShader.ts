/**
 * Edge Sharpening Shader
 * 
 * Based on research: "Text in the Dark: Extremely Low-Light Text Image Enhancement"
 * Uses edge-aware attention mechanisms to enhance text readability
 */

export const edgeSharpeningFragmentShader = `
  precision mediump float;
  
  uniform sampler2D uTexture;
  uniform float uEdgeStrength;
  uniform vec2 uTexelSize;
  
  varying vec2 vTexCoord;
  
  // Sobel edge detection
  float sobelEdge(sampler2D tex, vec2 uv, vec2 texelSize) {
    // Sample 3x3 neighborhood
    float tl = texture2D(tex, uv + vec2(-1.0, -1.0) * texelSize).r;
    float tm = texture2D(tex, uv + vec2(0.0, -1.0) * texelSize).r;
    float tr = texture2D(tex, uv + vec2(1.0, -1.0) * texelSize).r;
    
    float ml = texture2D(tex, uv + vec2(-1.0, 0.0) * texelSize).r;
    float mr = texture2D(tex, uv + vec2(1.0, 0.0) * texelSize).r;
    
    float bl = texture2D(tex, uv + vec2(-1.0, 1.0) * texelSize).r;
    float bm = texture2D(tex, uv + vec2(0.0, 1.0) * texelSize).r;
    float br = texture2D(tex, uv + vec2(1.0, 1.0) * texelSize).r;
    
    // Sobel X kernel
    float sobelX = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    
    // Sobel Y kernel
    float sobelY = -tl - 2.0*tm - tr + bl + 2.0*bm + br;
    
    // Edge magnitude
    return sqrt(sobelX*sobelX + sobelY*sobelY);
  }
  
  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    vec3 rgb = color.rgb;
    
    // Calculate luminance
    float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
    
    // Detect edges
    float edge = sobelEdge(uTexture, vTexCoord, uTexelSize);
    
    // Enhance edges
    float enhancement = 1.0 + edge * uEdgeStrength * 2.0;
    
    // Apply edge enhancement while preserving color
    vec3 enhanced = rgb * enhancement;
    
    // Prevent oversaturation
    enhanced = clamp(enhanced, 0.0, 1.0);
    
    gl_FragColor = vec4(enhanced, color.a);
  }
`;

export const edgeSharpeningVertexShader = `
  attribute vec2 aPosition;
  attribute vec2 aTexCoord;
  varying vec2 vTexCoord;
  
  void main() {
    vTexCoord = aTexCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

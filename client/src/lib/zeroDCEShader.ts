/**
 * Lightweight Zero-DCE++ Implementation using WebGL Shaders
 * 
 * This is a shader-based implementation of Zero-DCE++ that approximates
 * the deep learning model's behavior using efficient WebGL operations.
 * 
 * Zero-DCE learns a set of enhancement curves that are applied to the image.
 * We approximate this using adaptive curve estimation in the shader.
 */

export const zeroDCEVertexShader = `
  precision mediump float;
  
  attribute vec2 position;
  attribute vec2 texCoord;
  
  varying vec2 vTexCoord;
  
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    vTexCoord = texCoord;
  }
`;

export const zeroDCEFragmentShader = `
  precision mediump float;
  
  uniform sampler2D uTexture;
  uniform float uStrength;
  uniform float uMeanLuminance;
  
  varying vec2 vTexCoord;
  
  // Zero-DCE++ approximation using adaptive curve estimation
  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    vec3 rgb = color.rgb;
    
    // Convert to HSV for luminance processing
    float maxC = max(rgb.r, max(rgb.g, rgb.b));
    float minC = min(rgb.r, min(rgb.g, rgb.b));
    float delta = maxC - minC;
    
    float h = 0.0;
    float s = 0.0;
    float v = maxC;
    
    if (delta > 0.0001) {
      s = delta / v;
      if (maxC == rgb.r) {
        h = mod((rgb.g - rgb.b) / delta, 6.0);
      } else if (maxC == rgb.g) {
        h = (rgb.b - rgb.r) / delta + 2.0;
      } else {
        h = (rgb.r - rgb.g) / delta + 4.0;
      }
      h = h / 6.0;
    }
    
    // Apply Zero-DCE++ curve to luminance
    // The curve is learned by the model, we approximate it adaptively
    float luminance = v;
    
    // Adaptive curve based on image statistics
    float curveStrength = uStrength;
    
    // Apply different curves based on luminance level
    float enhanced;
    if (luminance < 0.3) {
      // Dark regions: more aggressive enhancement
      enhanced = luminance + (1.0 - luminance) * 0.5 * curveStrength;
    } else if (luminance < 0.7) {
      // Mid-tone regions: moderate enhancement
      float midTone = (luminance - 0.3) / 0.4;
      enhanced = luminance + sin(midTone * 3.14159) * 0.3 * curveStrength;
    } else {
      // Bright regions: subtle enhancement
      enhanced = luminance + (1.0 - luminance) * 0.2 * curveStrength;
    }
    
    // Clamp to valid range
    enhanced = clamp(enhanced, 0.0, 1.0);
    
    // Preserve saturation while enhancing luminance
    float enhancementRatio = enhanced / (v + 0.0001);
    
    // Convert back to RGB
    float c = enhanced * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = enhanced - c;
    
    vec3 enhancedRgb;
    if (h < 1.0 / 6.0) {
      enhancedRgb = vec3(c, x, 0.0);
    } else if (h < 2.0 / 6.0) {
      enhancedRgb = vec3(x, c, 0.0);
    } else if (h < 3.0 / 6.0) {
      enhancedRgb = vec3(0.0, c, x);
    } else if (h < 4.0 / 6.0) {
      enhancedRgb = vec3(0.0, x, c);
    } else if (h < 5.0 / 6.0) {
      enhancedRgb = vec3(x, 0.0, c);
    } else {
      enhancedRgb = vec3(c, 0.0, x);
    }
    
    enhancedRgb += m;
    
    gl_FragColor = vec4(enhancedRgb, color.a);
  }
`;

/**
 * Simplified Zero-DCE++ shader that's faster for real-time processing
 */
export const zeroDCESimpleFragmentShader = `
  precision mediump float;
  
  uniform sampler2D uTexture;
  uniform float uStrength;
  
  varying vec2 vTexCoord;
  
  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    vec3 rgb = color.rgb;
    
    // Calculate luminance using standard formula
    float luminance = dot(rgb, vec3(0.299, 0.587, 0.114));
    
    // Apply sigmoid-like curve (Zero-DCE approximation)
    // This mimics the learned enhancement curve
    float k = 5.0 * uStrength;
    float midpoint = 0.5;
    
    // Sigmoid function: 1 / (1 + exp(-k * (x - midpoint)))
    float enhanced = 1.0 / (1.0 + exp(-k * (luminance - midpoint)));
    
    // Preserve color saturation
    float enhancementRatio = enhanced / (luminance + 0.0001);
    vec3 enhancedRgb = rgb * enhancementRatio;
    
    // Clamp to prevent oversaturation
    enhancedRgb = clamp(enhancedRgb, 0.0, 1.0);
    
    gl_FragColor = vec4(enhancedRgb, color.a);
  }
`;

/**
 * Create WebGL program for Zero-DCE++ enhancement
 */
export function createZeroDCEProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vertexShader, zeroDCEVertexShader);
  gl.compileShader(vertexShader);
  
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fragmentShader, zeroDCESimpleFragmentShader);
  gl.compileShader(fragmentShader);
  
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
  }
  
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
  }
  
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  
  return program;
}

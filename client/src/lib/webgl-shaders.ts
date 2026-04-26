/**
 * WebGL Shader Utilities for Real-Time Image Enhancement
 * 
 * This module contains GLSL (OpenGL Shading Language) shaders that run on the GPU
 * for high-performance image processing. Each shader manipulates pixels in parallel.
 * 
 * Languages used:
 * - TypeScript: For shader management and WebGL setup
 * - GLSL: For pixel manipulation algorithms (runs on GPU)
 */

/**
 * Vertex Shader (GLSL)
 * 
 * Purpose: Defines the geometry of the rectangle where the video will be drawn.
 * This shader runs once per vertex (corner) of the rectangle.
 * 
 * Inputs:
 * - aPosition: The x,y coordinates of each corner
 * - aTexCoord: The texture coordinates (0,0 to 1,1) for mapping video to rectangle
 * 
 * Outputs:
 * - vTexCoord: Passes texture coordinates to fragment shader
 * - gl_Position: The final position of the vertex
 */
export const vertexShaderSource = `
  attribute vec2 aPosition;
  attribute vec2 aTexCoord;
  varying vec2 vTexCoord;
  
  void main() {
    vTexCoord = aTexCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

/**
 * Fragment Shader (GLSL) - The "Brain" of Image Enhancement
 * 
 * Purpose: This shader runs ONCE PER PIXEL and calculates the enhanced color.
 * This is where all the image processing algorithms are implemented.
 * 
 * Uniforms (parameters we can control from TypeScript):
 * - uTexture: The video frame as a texture
 * - uContrast: Contrast enhancement strength (1.0 = normal, >1.0 = more contrast)
 * - uBrightness: Brightness adjustment (-1.0 to 1.0)
 * - uEdgeStrength: Edge detection intensity (0.0 = off, 1.0 = maximum)
 * - uGlareSuppression: Glare reduction strength (0.0 = off, 1.0 = maximum)
 * - uGhostingSuppression: Ghosting/double-image reduction (0.0 = off, 1.0 = maximum)
 * - uTexelSize: Size of one pixel (for edge detection neighbor sampling)
 * 
 * Algorithm Steps:
 * 1. Sample the original pixel color from the video texture
 * 2. Apply contrast enhancement using the formula: (color - 0.5) * contrast + 0.5
 * 3. Apply brightness adjustment
 * 4. Detect edges by comparing neighboring pixels (Sobel operator)
 * 5. Suppress glare by reducing bright areas
 * 6. Apply ghosting suppression to reduce motion blur and double images
 * 7. Combine all enhancements and output final color
 */
export const fragmentShaderSource = `
  precision mediump float;
  
  uniform sampler2D uTexture;
  uniform float uContrast;
  uniform float uBrightness;
  uniform float uEdgeStrength;
  uniform float uGlareSuppression;
  uniform float uGhostingSuppression;
  uniform vec2 uGhostDirection; // Direction vector for directional ghosting suppression
  uniform float uAdaptiveLighting;
  uniform float uTextEnhancement; // Text enhancement mode
  uniform vec2 uTexelSize;
  
  varying vec2 vTexCoord;
  
  // Convert RGB to grayscale for edge detection
  // Uses standard luminance formula (human eye is more sensitive to green)
  float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }
  
  // Sobel Edge Detection Algorithm
  // Compares the brightness of neighboring pixels to find edges
  // Returns edge strength (0.0 = no edge, 1.0 = strong edge)
  float detectEdges(vec2 coord) {
    // Sample 8 neighboring pixels in a 3x3 grid
    float tl = luminance(texture2D(uTexture, coord + vec2(-uTexelSize.x, uTexelSize.y)).rgb);
    float t  = luminance(texture2D(uTexture, coord + vec2(0.0, uTexelSize.y)).rgb);
    float tr = luminance(texture2D(uTexture, coord + vec2(uTexelSize.x, uTexelSize.y)).rgb);
    float l  = luminance(texture2D(uTexture, coord + vec2(-uTexelSize.x, 0.0)).rgb);
    float r  = luminance(texture2D(uTexture, coord + vec2(uTexelSize.x, 0.0)).rgb);
    float bl = luminance(texture2D(uTexture, coord + vec2(-uTexelSize.x, -uTexelSize.y)).rgb);
    float b  = luminance(texture2D(uTexture, coord + vec2(0.0, -uTexelSize.y)).rgb);
    float br = luminance(texture2D(uTexture, coord + vec2(uTexelSize.x, -uTexelSize.y)).rgb);
    
    // Sobel operator: Calculate horizontal and vertical gradients
    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    
    // Magnitude of gradient = edge strength
    return length(vec2(gx, gy));
  }
  
  void main() {
    // Step 1: Get original pixel color from video
    vec4 color = texture2D(uTexture, vTexCoord);
    
    // Step 1.5: Apply adaptive lighting FIRST (on original pixels)
    // This brightens dark areas more than bright areas
    vec3 enhanced = color.rgb;
    if (uAdaptiveLighting > 0.001) { // Use threshold to ensure true zero has no effect
      // Calculate luminance of ORIGINAL pixel
      float originalLum = luminance(color.rgb);
      // Dark pixels (low lum) get strong boost, bright pixels get minimal boost
      float darknessFactor = pow(1.0 - originalLum, 2.5);
      float boost = darknessFactor * uAdaptiveLighting * 1.5;
      // Apply adaptive boost
      enhanced = enhanced + vec3(boost);
    }
    
    // Step 2: Apply proper contrast enhancement
    // Formula: (color - 0.5) * contrast + 0.5
    // This increases difference between light and dark areas
    if (uContrast > 1.01) {
      float strength = (uContrast - 1.0) * 2.0; // 0 to 2.0
      enhanced.r = (enhanced.r - 0.5) * (1.0 + strength) + 0.5;
      enhanced.g = (enhanced.g - 0.5) * (1.0 + strength) + 0.5;
      enhanced.b = (enhanced.b - 0.5) * (1.0 + strength) + 0.5;
      enhanced = clamp(enhanced, 0.0, 1.0);
    }
    
    // Step 3: Apply brightness adjustment
    enhanced = enhanced + uBrightness;
    
    // Step 4: Unsharp Masking for edge sharpening
    // This technique enhances edges by subtracting a blurred version from the original
    if (uEdgeStrength > 0.0) {
      // Create blurred version by averaging neighboring pixels
      vec3 blur = vec3(0.0);
      blur += texture2D(uTexture, vTexCoord + vec2(-uTexelSize.x, -uTexelSize.y)).rgb * 0.0625;
      blur += texture2D(uTexture, vTexCoord + vec2(0.0, -uTexelSize.y)).rgb * 0.125;
      blur += texture2D(uTexture, vTexCoord + vec2(uTexelSize.x, -uTexelSize.y)).rgb * 0.0625;
      blur += texture2D(uTexture, vTexCoord + vec2(-uTexelSize.x, 0.0)).rgb * 0.125;
      blur += texture2D(uTexture, vTexCoord).rgb * 0.25;
      blur += texture2D(uTexture, vTexCoord + vec2(uTexelSize.x, 0.0)).rgb * 0.125;
      blur += texture2D(uTexture, vTexCoord + vec2(-uTexelSize.x, uTexelSize.y)).rgb * 0.0625;
      blur += texture2D(uTexture, vTexCoord + vec2(0.0, uTexelSize.y)).rgb * 0.125;
      blur += texture2D(uTexture, vTexCoord + vec2(uTexelSize.x, uTexelSize.y)).rgb * 0.0625;
      
      // Unsharp mask: original - blur = edge information
      vec3 sharpened = enhanced - blur;
      
      // Apply sharpening with strength control
      enhanced = enhanced + sharpened * uEdgeStrength * 2.0;
      enhanced = clamp(enhanced, 0.0, 1.0);
    }
    
    // Step 5: Glare suppression
    // Detect bright areas (potential glare) and reduce their intensity
    if (uGlareSuppression > 0.0) {
      float brightness = luminance(enhanced);
      // If pixel is very bright (>0.7), reduce it more aggressively
      if (brightness > 0.7) {
        float reduction = (brightness - 0.7) * uGlareSuppression;
        enhanced = enhanced * (1.0 - reduction * 0.8); // Increased from 0.5 to 0.8
      }
    }
    
    // Step 6: Directional Ghosting suppression for corneal ectasia
    // Applies directional unsharp masking to suppress ghost images in specific direction
    if (uGhostingSuppression > 0.0 && length(uGhostDirection) > 0.0) {
      // Sample pixels in the ghost direction to detect and suppress ghost
      vec2 ghostOffset = uGhostDirection * uTexelSize * 2.0;
      
      // Sample main image and ghost direction
      vec3 mainSample = texture2D(uTexture, vTexCoord).rgb;
      vec3 ghostSample = texture2D(uTexture, vTexCoord + ghostOffset).rgb;
      
      // Calculate difference (ghost detection)
      vec3 diff = mainSample - ghostSample;
      
      // Apply directional sharpening to suppress ghost
      // Enhance edges perpendicular to ghost direction
      vec2 perpDir = vec2(-uGhostDirection.y, uGhostDirection.x);
      vec3 perpSample1 = texture2D(uTexture, vTexCoord + perpDir * uTexelSize).rgb;
      vec3 perpSample2 = texture2D(uTexture, vTexCoord - perpDir * uTexelSize).rgb;
      
      // Enhance main image, suppress ghost (very strong for clear visibility)
      enhanced = enhanced + diff * uGhostingSuppression * 1.2; // Much stronger
      enhanced = enhanced + (mainSample - (perpSample1 + perpSample2) * 0.5) * uGhostingSuppression * 1.0; // Much stronger
    }
    
    // Step 7: Text Enhancement Mode (AR feature)
    // Detects ONLY text-like regions and highlights them with AR overlay
    if (uTextEnhancement > 0.5) {
      // Multi-scale edge detection for text patterns
      vec3 center = texture2D(uTexture, vTexCoord).rgb;
      float centerLum = luminance(center);
      
      // Sample neighbors at multiple scales
      vec3 right = texture2D(uTexture, vTexCoord + vec2(uTexelSize.x, 0.0)).rgb;
      vec3 left = texture2D(uTexture, vTexCoord - vec2(uTexelSize.x, 0.0)).rgb;
      vec3 up = texture2D(uTexture, vTexCoord + vec2(0.0, uTexelSize.y)).rgb;
      vec3 down = texture2D(uTexture, vTexCoord - vec2(0.0, uTexelSize.y)).rgb;
      
      // Calculate edge strength
      float edgeH = abs(luminance(right) - luminance(left));
      float edgeV = abs(luminance(up) - luminance(down));
      float edgeStrength = edgeH + edgeV;
      
      // Text detection criteria:
      // 1. Strong edges (text has clear boundaries)
      // 2. Medium contrast (not too dark, not too bright)
      // 3. Local variance (text has structure)
      float contrast = abs(centerLum - 0.5);
      bool hasStrongEdges = edgeStrength > 0.3;
      bool hasMediumContrast = contrast < 0.4; // Not pure black/white
      
      // Calculate local variance for structure detection
      float variance = abs(luminance(right) - centerLum) + 
                      abs(luminance(left) - centerLum) + 
                      abs(luminance(up) - centerLum) + 
                      abs(luminance(down) - centerLum);
      bool hasStructure = variance > 0.2 && variance < 1.5;
      
      // Only enhance if ALL criteria match (text-like)
      if (hasStrongEdges && hasMediumContrast && hasStructure) {
        // AR Overlay: Highlight detected text region
        // Apply strong contrast boost
        vec3 textEnhanced = (enhanced - 0.5) * 2.5 + 0.5;
        
        // Apply strong sharpening
        vec3 neighbors = (right + left + up + down) * 0.25;
        textEnhanced = textEnhanced + (center - neighbors) * 2.0;
        
        // Add cyan tint as AR overlay (shows detected text)
        textEnhanced = textEnhanced + vec3(0.0, 0.15, 0.2);
        
        // Blend with original based on edge strength (smooth transition)
        float blendFactor = smoothstep(0.3, 0.6, edgeStrength);
        enhanced = mix(enhanced, textEnhanced, blendFactor);
      }
    }
    
    // Step 8: Clamp values to valid range [0, 1] and output
    gl_FragColor = vec4(clamp(enhanced, 0.0, 1.0), 1.0);
  }
`;

/**
 * WebGL Shader Program Manager (TypeScript)
 * 
 * This class handles:
 * - Compiling GLSL shaders
 * - Creating WebGL program
 * - Managing shader uniforms (parameters)
 * - Rendering video frames with enhancements
 */
export class ShaderProgram {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private locations: {
    aPosition?: number;
    aTexCoord?: number;
    uTexture?: WebGLUniformLocation | null;
    uContrast?: WebGLUniformLocation | null;
    uBrightness?: WebGLUniformLocation | null;
    uEdgeStrength?: WebGLUniformLocation | null;
    uGlareSuppression?: WebGLUniformLocation | null;
    uGhostingSuppression?: WebGLUniformLocation | null;
    uGhostDirection?: WebGLUniformLocation | null;
    uAdaptiveLighting?: WebGLUniformLocation | null;
    uTextEnhancement?: WebGLUniformLocation | null;
    uTexelSize?: WebGLUniformLocation | null;
  } = {};
  private buffers: {
    position?: WebGLBuffer | null;
    texCoord?: WebGLBuffer | null;
  } = {};
  private texture: WebGLTexture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;
    this.initialize();
  }

  /**
   * Compile a shader from GLSL source code
   */
  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }
    
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error('Shader compilation failed: ' + info);
    }
    
    return shader;
  }

  /**
   * Initialize WebGL program and buffers
   */
  private initialize() {
    // Compile shaders
    const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
    
    // Create program
    this.program = this.gl.createProgram();
    if (!this.program) {
      throw new Error('Failed to create program');
    }
    
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);
    
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(this.program);
      throw new Error('Program linking failed: ' + info);
    }
    
    // Get attribute and uniform locations
    this.locations.aPosition = this.gl.getAttribLocation(this.program, 'aPosition');
    this.locations.aTexCoord = this.gl.getAttribLocation(this.program, 'aTexCoord');
    this.locations.uTexture = this.gl.getUniformLocation(this.program, 'uTexture');
    this.locations.uContrast = this.gl.getUniformLocation(this.program, 'uContrast');
    this.locations.uBrightness = this.gl.getUniformLocation(this.program, 'uBrightness');
    this.locations.uEdgeStrength = this.gl.getUniformLocation(this.program, 'uEdgeStrength');
    this.locations.uGlareSuppression = this.gl.getUniformLocation(this.program, 'uGlareSuppression');
    this.locations.uGhostingSuppression = this.gl.getUniformLocation(this.program, 'uGhostingSuppression');
    this.locations.uGhostDirection = this.gl.getUniformLocation(this.program, 'uGhostDirection');
    this.locations.uAdaptiveLighting = this.gl.getUniformLocation(this.program, 'uAdaptiveLighting');
    this.locations.uTextEnhancement = this.gl.getUniformLocation(this.program, 'uTextEnhancement');
    this.locations.uTexelSize = this.gl.getUniformLocation(this.program, 'uTexelSize');
    
    // Create buffers for rectangle geometry
    this.createBuffers();
    
    // Create texture for video
    this.texture = this.gl.createTexture();
  }

  /**
   * Create vertex buffers for a full-screen rectangle
   */
  private createBuffers() {
    // Position buffer (rectangle corners: -1 to 1 in clip space)
    this.buffers.position = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
    const positions = new Float32Array([
      -1, -1,  // bottom-left
       1, -1,  // bottom-right
      -1,  1,  // top-left
       1,  1,  // top-right
    ]);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    
    // Texture coordinate buffer (0 to 1)
    this.buffers.texCoord = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.texCoord);
    const texCoords = new Float32Array([
      0, 1,  // bottom-left
      1, 1,  // bottom-right
      0, 0,  // top-left
      1, 0,  // top-right
    ]);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
  }

  /**
   * Render a video frame with enhancements
   * 
   * @param video - The video element containing the camera feed
   * @param settings - Enhancement parameters
   */
  render(
    video: HTMLVideoElement,
    settings: {
      contrast: number; // Sigmoid-based (Tang & Peli 2015)
      edgeStrength: number; // Placeholder - awaiting research
      textEnhancement: boolean; // Placeholder - awaiting research
    }
  ) {
    if (!this.program) return;
    
    const { gl } = this;
    
    // Set viewport to match canvas size
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    // Clear canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Use our shader program
    gl.useProgram(this.program);
    
    // Activate texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    
    // Log video state (only first few frames)
    if (Math.random() < 0.01) { // Log 1% of frames to avoid spam
      console.log('Video state:', {
        width: video.videoWidth,
        height: video.videoHeight,
        readyState: video.readyState,
        currentTime: video.currentTime,
        paused: video.paused
      });
    }
    
    // Upload video frame to texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    
    // Set texture parameters BEFORE uploading (important for proper texture setup)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Upload video frame to texture
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch (e) {
      console.error('Failed to upload video to texture:', e);
      return; // Exit early if texture upload fails
    }
    
    // Check for WebGL errors
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error('WebGL error after texture upload:', error);
      // Don't return - continue rendering even with errors
    }
    
    // Set uniforms (shader parameters)
    // Set shader uniforms (parameters)
    if (this.locations.uTexture) gl.uniform1i(this.locations.uTexture, 0);
    if (this.locations.uContrast) gl.uniform1f(this.locations.uContrast, settings.contrast);
    if (this.locations.uEdgeStrength) gl.uniform1f(this.locations.uEdgeStrength, settings.edgeStrength);
    if (this.locations.uTextEnhancement) gl.uniform1f(this.locations.uTextEnhancement, settings.textEnhancement ? 1.0 : 0.0);
    if (this.locations.uTexelSize) gl.uniform2f(this.locations.uTexelSize, 1.0 / video.videoWidth, 1.0 / video.videoHeight);
    
    // Set removed features to 0 (disabled)
    if (this.locations.uBrightness) gl.uniform1f(this.locations.uBrightness, 0.0);
    if (this.locations.uGlareSuppression) gl.uniform1f(this.locations.uGlareSuppression, 0.0);
    if (this.locations.uGhostingSuppression) gl.uniform1f(this.locations.uGhostingSuppression, 0.0);
    if (this.locations.uGhostDirection) gl.uniform2f(this.locations.uGhostDirection, 0.0, 0.0);
    if (this.locations.uAdaptiveLighting) gl.uniform1f(this.locations.uAdaptiveLighting, 0.0);
    
    // Bind position buffer
    if (this.buffers.position && this.locations.aPosition !== undefined) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
      gl.enableVertexAttribArray(this.locations.aPosition);
      gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);
    }
    
    // Bind texture coordinate buffer
    if (this.buffers.texCoord && this.locations.aTexCoord !== undefined) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoord);
      gl.enableVertexAttribArray(this.locations.aTexCoord);
      gl.vertexAttribPointer(this.locations.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    }
    
    // Draw the rectangle (2 triangles = 4 vertices)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // Check for WebGL errors after draw
    const drawError = gl.getError();
    if (drawError !== gl.NO_ERROR) {
      console.error('WebGL error after draw:', drawError);
    }
  }

  /**
   * Clean up WebGL resources
   */
  dispose() {
    if (this.program) {
      this.gl.deleteProgram(this.program);
    }
    if (this.buffers.position) {
      this.gl.deleteBuffer(this.buffers.position);
    }
    if (this.buffers.texCoord) {
      this.gl.deleteBuffer(this.buffers.texCoord);
    }
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
    }
  }
}

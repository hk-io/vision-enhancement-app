/**
 * Enhanced WebGL Shaders for Corneal Ectasia Assistance
 * 
 * New Features:
 * 1. Directional Ghost Reduction (based on coma aberration research)
 * 2. Adaptive Lighting Enhancement (local brightness adjustment)
 * 3. Enhanced edge detection (stronger, research-based)
 * 4. Improved contrast (CLAHE-inspired)
 * 
 * Research basis:
 * - Keratoconus ghosting typically appears in inferior direction (upward perceived)
 * - Coma aberrations create directional blur
 * - Adaptive lighting helps with varying light conditions
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
 * Enhanced Fragment Shader with Corneal Ectasia Features
 * 
 * New uniforms:
 * - uGhostDirection: Direction of ghost (0=up, 1=down, 2=left, 3=right)
 * - uGhostStrength: Strength of directional ghost suppression (0.0-1.0)
 * - uAdaptiveLighting: Adaptive lighting strength (0.0-1.0)
 */
export const fragmentShaderSource = `
  precision mediump float;
  
  uniform sampler2D uTexture;
  uniform float uContrast;
  uniform float uBrightness;
  uniform float uEdgeStrength;
  uniform float uGlareSuppression;
  uniform float uGhostStrength;        // NEW: Directional ghost suppression
  uniform float uGhostDirection;       // NEW: 0=up, 1=down, 2=left, 3=right
  uniform float uAdaptiveLighting;     // NEW: Adaptive lighting strength
  uniform float uTextEnhancement;      // NEW: Extra enhancement for text-like regions
  uniform vec2 uTexelSize;
  
  varying vec2 vTexCoord;
  
  // Convert RGB to grayscale (luminance)
  float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }
  
  // Enhanced Sobel Edge Detection (stronger for ectasia)
  float detectEdges(vec2 coord) {
    // Sample 8 neighboring pixels
    float tl = luminance(texture2D(uTexture, coord + vec2(-uTexelSize.x, uTexelSize.y)).rgb);
    float t  = luminance(texture2D(uTexture, coord + vec2(0.0, uTexelSize.y)).rgb);
    float tr = luminance(texture2D(uTexture, coord + vec2(uTexelSize.x, uTexelSize.y)).rgb);
    float l  = luminance(texture2D(uTexture, coord + vec2(-uTexelSize.x, 0.0)).rgb);
    float r  = luminance(texture2D(uTexture, coord + vec2(uTexelSize.x, 0.0)).rgb);
    float bl = luminance(texture2D(uTexture, coord + vec2(-uTexelSize.x, -uTexelSize.y)).rgb);
    float b  = luminance(texture2D(uTexture, coord + vec2(0.0, -uTexelSize.y)).rgb);
    float br = luminance(texture2D(uTexture, coord + vec2(uTexelSize.x, -uTexelSize.y)).rgb);
    
    // Sobel operator
    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    
    return length(vec2(gx, gy));
  }
  
  // NEW: Directional Ghost Suppression
  // Based on research: Keratoconus creates directional ghosting (coma aberrations)
  // This function suppresses blur in the specified direction
  vec3 suppressDirectionalGhost(vec2 coord, vec3 originalColor) {
    if (uGhostStrength < 0.01) {
      return originalColor;
    }
    
    // Determine ghost direction vector
    vec2 ghostDir = vec2(0.0, 1.0); // Default: upward (most common in keratoconus)
    
    if (uGhostDirection < 0.5) {
      ghostDir = vec2(0.0, 1.0);  // Up
    } else if (uGhostDirection < 1.5) {
      ghostDir = vec2(0.0, -1.0); // Down
    } else if (uGhostDirection < 2.5) {
      ghostDir = vec2(-1.0, 0.0); // Left
    } else {
      ghostDir = vec2(1.0, 0.0);  // Right
    }
    
    // Sample pixels in ghost direction (where ghost appears)
    vec3 ghostSample1 = texture2D(uTexture, coord + ghostDir * uTexelSize * 1.0).rgb;
    vec3 ghostSample2 = texture2D(uTexture, coord + ghostDir * uTexelSize * 2.0).rgb;
    vec3 ghostSample3 = texture2D(uTexture, coord + ghostDir * uTexelSize * 3.0).rgb;
    
    // Sample pixels in opposite direction (main image)
    vec3 mainSample1 = texture2D(uTexture, coord - ghostDir * uTexelSize * 1.0).rgb;
    vec3 mainSample2 = texture2D(uTexture, coord - ghostDir * uTexelSize * 2.0).rgb;
    
    // Calculate average ghost and main intensities
    float ghostIntensity = (luminance(ghostSample1) + luminance(ghostSample2) + luminance(ghostSample3)) / 3.0;
    float mainIntensity = (luminance(mainSample1) + luminance(mainSample2)) / 2.0;
    
    // If ghost direction has similar intensity to main, it's likely a ghost
    // Suppress it by enhancing the opposite direction
    float ghostRatio = ghostIntensity / max(mainIntensity, 0.01);
    
    // Directional unsharp mask: enhance opposite direction, suppress ghost direction
    vec3 enhanced = originalColor;
    if (ghostRatio > 0.7 && ghostRatio < 1.3) {
      // Likely ghost detected - enhance main direction
      enhanced = originalColor + (originalColor - (ghostSample1 + ghostSample2) * 0.5) * uGhostStrength * 0.5;
    }
    
    return enhanced;
  }
  
  // NEW: Adaptive Lighting Enhancement
  // Brightens dark areas more than bright areas (helps with varying light conditions)
  vec3 applyAdaptiveLighting(vec3 color) {
    if (uAdaptiveLighting < 0.01) {
      return color;
    }
    
    // Calculate local average brightness (3x3 neighborhood)
    float localBrightness = 0.0;
    localBrightness += luminance(texture2D(uTexture, vTexCoord + vec2(-uTexelSize.x, uTexelSize.y)).rgb);
    localBrightness += luminance(texture2D(uTexture, vTexCoord + vec2(0.0, uTexelSize.y)).rgb);
    localBrightness += luminance(texture2D(uTexture, vTexCoord + vec2(uTexelSize.x, uTexelSize.y)).rgb);
    localBrightness += luminance(texture2D(uTexture, vTexCoord + vec2(-uTexelSize.x, 0.0)).rgb);
    localBrightness += luminance(texture2D(uTexture, vTexCoord).rgb);
    localBrightness += luminance(texture2D(uTexture, vTexCoord + vec2(uTexelSize.x, 0.0)).rgb);
    localBrightness += luminance(texture2D(uTexture, vTexCoord + vec2(-uTexelSize.x, -uTexelSize.y)).rgb);
    localBrightness += luminance(texture2D(uTexture, vTexCoord + vec2(0.0, -uTexelSize.y)).rgb);
    localBrightness += luminance(texture2D(uTexture, vTexCoord + vec2(uTexelSize.x, -uTexelSize.y)).rgb);
    localBrightness /= 9.0;
    
    // Adaptive gain: dark areas get more boost
    // Formula: gain = 1.0 + (1.0 - brightness) * strength
    // Dark areas (brightness=0.0) get full boost
    // Bright areas (brightness=1.0) get no boost
    float adaptiveGain = 1.0 + (1.0 - localBrightness) * uAdaptiveLighting * 0.8;
    
    return color * adaptiveGain;
  }
  
  void main() {
    // Step 1: Get original pixel color
    vec4 color = texture2D(uTexture, vTexCoord);
    vec3 enhanced = color.rgb;
    
    // Step 2: Apply adaptive lighting FIRST (before other enhancements)
    enhanced = applyAdaptiveLighting(enhanced);
    
    // Step 3: Apply contrast enhancement (CLAHE-inspired)
    enhanced = (enhanced - 0.5) * uContrast + 0.5;
    
    // Step 4: Apply brightness adjustment
    enhanced = enhanced + uBrightness;
    
    // Step 5: Enhanced edge detection and sharpening
    if (uEdgeStrength > 0.0) {
      float edge = detectEdges(vTexCoord);
      // Stronger edge enhancement for ectasia (2x multiplier)
      enhanced = enhanced + vec3(edge * uEdgeStrength * 2.0);
    }
    
    // Step 6: Directional ghost suppression (NEW!)
    enhanced = suppressDirectionalGhost(vTexCoord, enhanced);
    
    // Step 7: Glare suppression
    if (uGlareSuppression > 0.0) {
      float brightness = luminance(enhanced);
      if (brightness > 0.8) {
        float reduction = (brightness - 0.8) * uGlareSuppression;
        enhanced = enhanced * (1.0 - reduction * 0.5);
      }
    }
    
    // Step 8: Text enhancement (NEW!)
    // Detect text-like patterns (high horizontal edge density)
    if (uTextEnhancement > 0.0) {
      float edge = detectEdges(vTexCoord);
      // Text has characteristic horizontal edges
      // Apply extra enhancement if edge pattern suggests text
      if (edge > 0.3) {
        enhanced = enhanced + vec3(edge * uTextEnhancement * 0.5);
        // Extra contrast for text
        enhanced = (enhanced - 0.5) * (1.0 + uTextEnhancement * 0.3) + 0.5;
      }
    }
    
    // Step 9: Clamp to valid range [0, 1]
    enhanced = clamp(enhanced, 0.0, 1.0);
    
    // Output final color
    gl_FragColor = vec4(enhanced, color.a);
  }
`;

/**
 * Enhanced Shader Program Class
 */
export class ShaderProgram {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  
  // Uniform locations
  private uniforms: {
    uTexture: WebGLUniformLocation | null;
    uContrast: WebGLUniformLocation | null;
    uBrightness: WebGLUniformLocation | null;
    uEdgeStrength: WebGLUniformLocation | null;
    uGlareSuppression: WebGLUniformLocation | null;
    uGhostStrength: WebGLUniformLocation | null;
    uGhostDirection: WebGLUniformLocation | null;
    uAdaptiveLighting: WebGLUniformLocation | null;
    uTextEnhancement: WebGLUniformLocation | null;
    uTexelSize: WebGLUniformLocation | null;
  };

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: false,
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });

    if (!gl) {
      throw new Error('WebGL not supported');
    }

    this.gl = gl;
    this.program = this.createProgram();
    this.texture = this.createTexture();
    this.positionBuffer = this.createPositionBuffer();
    this.texCoordBuffer = this.createTexCoordBuffer();
    
    // Get uniform locations
    this.uniforms = {
      uTexture: gl.getUniformLocation(this.program, 'uTexture'),
      uContrast: gl.getUniformLocation(this.program, 'uContrast'),
      uBrightness: gl.getUniformLocation(this.program, 'uBrightness'),
      uEdgeStrength: gl.getUniformLocation(this.program, 'uEdgeStrength'),
      uGlareSuppression: gl.getUniformLocation(this.program, 'uGlareSuppression'),
      uGhostStrength: gl.getUniformLocation(this.program, 'uGhostStrength'),
      uGhostDirection: gl.getUniformLocation(this.program, 'uGhostDirection'),
      uAdaptiveLighting: gl.getUniformLocation(this.program, 'uAdaptiveLighting'),
      uTextEnhancement: gl.getUniformLocation(this.program, 'uTextEnhancement'),
      uTexelSize: gl.getUniformLocation(this.program, 'uTexelSize'),
    };
  }

  private createProgram(): WebGLProgram {
    const gl = this.gl;
    
    // Compile shaders
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    // Create program
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw new Error('Failed to link shader program: ' + info);
    }
    
    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    
    if (!shader) {
      throw new Error('Failed to create shader');
    }
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Failed to compile shader: ' + info);
    }
    
    return shader;
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    
    if (!texture) {
      throw new Error('Failed to create texture');
    }
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    return texture;
  }

  private createPositionBuffer(): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    
    if (!buffer) {
      throw new Error('Failed to create position buffer');
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    return buffer;
  }

  private createTexCoordBuffer(): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    
    if (!buffer) {
      throw new Error('Failed to create texcoord buffer');
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const texCoords = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    
    return buffer;
  }

  public render(
    video: HTMLVideoElement,
    settings: {
      contrast: number;
      brightness: number;
      edgeStrength: number;
      glareSuppression: number;
      ghostStrength: number;
      ghostDirection: number;
      adaptiveLighting: number;
      textEnhancement: number;
    }
  ): void {
    const gl = this.gl;
    
    // Update texture with video frame
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    
    // Use shader program
    gl.useProgram(this.program);
    
    // Set uniforms
    gl.uniform1i(this.uniforms.uTexture, 0);
    gl.uniform1f(this.uniforms.uContrast, settings.contrast);
    gl.uniform1f(this.uniforms.uBrightness, settings.brightness);
    gl.uniform1f(this.uniforms.uEdgeStrength, settings.edgeStrength);
    gl.uniform1f(this.uniforms.uGlareSuppression, settings.glareSuppression);
    gl.uniform1f(this.uniforms.uGhostStrength, settings.ghostStrength);
    gl.uniform1f(this.uniforms.uGhostDirection, settings.ghostDirection);
    gl.uniform1f(this.uniforms.uAdaptiveLighting, settings.adaptiveLighting);
    gl.uniform1f(this.uniforms.uTextEnhancement, settings.textEnhancement);
    gl.uniform2f(this.uniforms.uTexelSize, 1.0 / video.videoWidth, 1.0 / video.videoHeight);
    
    // Set up attributes
    const aPosition = gl.getAttribLocation(this.program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    
    const aTexCoord = gl.getAttribLocation(this.program, 'aTexCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
    
    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  public dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
  }
}

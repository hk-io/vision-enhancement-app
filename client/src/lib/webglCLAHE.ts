/**
 * WebGL-based CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * Pure JavaScript/WebGL implementation that doesn't require external libraries
 * Works reliably without CDN dependencies
 */

export class WebGLCLAHE {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private tileSize: number;
  private clipLimit: number;

  constructor(tileSize: number = 8, clipLimit: number = 2.0) {
    this.tileSize = tileSize;
    this.clipLimit = clipLimit;
    
    // Create canvas and WebGL context
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    // Create shader program for histogram equalization
    this.program = this.createProgram();
    this.positionBuffer = this.createPositionBuffer();
    this.texCoordBuffer = this.createTexCoordBuffer();
  }

  private createProgram(): WebGLProgram {
    const vertexShader = this.createShader(
      this.gl.VERTEX_SHADER,
      `
      attribute vec2 position;
      attribute vec2 texCoord;
      varying vec2 vTexCoord;
      
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        vTexCoord = texCoord;
      }
      `
    );

    const fragmentShader = this.createShader(
      this.gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      uniform sampler2D image;
      uniform vec2 imageSize;
      uniform float tileSize;
      uniform float clipLimit;
      varying vec2 vTexCoord;
      
      float getPixelBrightness(vec2 uv) {
        vec4 color = texture2D(image, uv);
        return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
      }
      
      void main() {
        vec2 pixelCoord = vTexCoord * imageSize;
        vec2 tileCoord = floor(pixelCoord / tileSize);
        vec2 localCoord = mod(pixelCoord, tileSize) / tileSize;
        
        // Count pixels in histogram for this tile
        float histogram[256];
        for (int i = 0; i < 256; i++) {
          histogram[i] = 0.0;
        }
        
        // Sample surrounding pixels in tile
        vec2 tileStart = tileCoord * tileSize / imageSize;
        for (float x = 0.0; x < tileSize; x += 1.0) {
          for (float y = 0.0; y < tileSize; y += 1.0) {
            vec2 sampleUV = tileStart + vec2(x, y) / imageSize;
            float brightness = getPixelBrightness(sampleUV);
            int binIndex = int(brightness * 255.0);
            histogram[binIndex] += 1.0;
          }
        }
        
        // Apply clip limit
        float maxCount = tileSize * tileSize / 256.0 * clipLimit;
        for (int i = 0; i < 256; i++) {
          histogram[i] = min(histogram[i], maxCount);
        }
        
        // Calculate CDF
        float cdf[256];
        float sum = 0.0;
        for (int i = 0; i < 256; i++) {
          sum += histogram[i];
          cdf[i] = sum;
        }
        
        // Normalize CDF
        float cdfMin = cdf[0];
        float cdfMax = cdf[255];
        for (int i = 0; i < 256; i++) {
          cdf[i] = (cdf[i] - cdfMin) / (cdfMax - cdfMin);
        }
        
        // Get original pixel and apply equalization
        vec4 originalColor = texture2D(image, vTexCoord);
        float originalBrightness = getPixelBrightness(originalColor.rgb);
        int binIndex = int(originalBrightness * 255.0);
        float newBrightness = cdf[binIndex];
        
        // Preserve color while adjusting brightness
        float scale = newBrightness / (originalBrightness + 0.001);
        vec3 enhancedColor = originalColor.rgb * scale;
        
        gl_FragColor = vec4(enhancedColor, originalColor.a);
      }
      `
    );

    const program = this.gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error('Program linking failed');
    }

    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('Shader compilation failed: ' + this.gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  private createPositionBuffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      this.gl.STATIC_DRAW
    );
    
    return buffer;
  }

  private createTexCoordBuffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      this.gl.STATIC_DRAW
    );
    
    return buffer;
  }

  apply(imageData: ImageData): ImageData {
    // Resize canvas to match image
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.gl.viewport(0, 0, imageData.width, imageData.height);

    // Create texture from image data
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      imageData.width,
      imageData.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      imageData.data
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    // Create framebuffer
    const framebuffer = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);

    const outputTexture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, outputTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      imageData.width,
      imageData.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      outputTexture,
      0
    );

    // Render
    this.gl.useProgram(this.program);

    // Set up position attribute
    const positionLoc = this.gl.getAttribLocation(this.program, 'position');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(positionLoc);
    this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);

    // Set up texCoord attribute
    const texCoordLoc = this.gl.getAttribLocation(this.program, 'texCoord');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.enableVertexAttribArray(texCoordLoc);
    this.gl.vertexAttribPointer(texCoordLoc, 2, this.gl.FLOAT, false, 0, 0);

    // Set uniforms
    this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'image'), 0);
    this.gl.uniform2f(
      this.gl.getUniformLocation(this.program, 'imageSize'),
      imageData.width,
      imageData.height
    );
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'tileSize'), this.tileSize);
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'clipLimit'), this.clipLimit);

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    // Read pixels
    const result = new Uint8ClampedArray(imageData.width * imageData.height * 4);
    this.gl.readPixels(
      0,
      0,
      imageData.width,
      imageData.height,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      result as any
    );

    // Clean up
    this.gl.deleteTexture(texture);
    this.gl.deleteTexture(outputTexture);
    this.gl.deleteFramebuffer(framebuffer);

    // Return result as ImageData
    return new ImageData(result, imageData.width, imageData.height);
  }
}

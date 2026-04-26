/**
 * WebGL Retinex Shader for Dark Room Enhancement
 * 
 * Implements Multi-Scale Retinex (MSR) algorithm for tone mapping
 * Enhances dark images while preserving local contrast
 */

export class RetinexShader {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private framebuffer: WebGLFramebuffer;
  private texture: WebGLTexture;
  private renderbuffer: WebGLRenderbuffer;
  private width: number;
  private height: number;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.width = width;
    this.height = height;

    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    // Compile shader program
    this.program = this.createProgram();

    // Setup buffers
    this.positionBuffer = this.createPositionBuffer();
    this.texCoordBuffer = this.createTexCoordBuffer();

    // Setup framebuffer for off-screen rendering
    this.framebuffer = gl.createFramebuffer()!;
    this.texture = gl.createTexture()!;
    this.renderbuffer = gl.createRenderbuffer()!;

    this.setupFramebuffer();
  }

  private createProgram(): WebGLProgram {
    const vertexShader = this.compileShader(
      this.getVertexShaderSource(),
      this.gl.VERTEX_SHADER
    );
    const fragmentShader = this.compileShader(
      this.getFragmentShaderSource(),
      this.gl.FRAGMENT_SHADER
    );

    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + this.gl.getProgramInfoLog(program));
    }

    return program;
  }

  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('Shader compile failed: ' + this.gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  private getVertexShaderSource(): string {
    return `
      attribute vec2 position;
      attribute vec2 texCoord;
      varying vec2 vTexCoord;

      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        vTexCoord = texCoord;
      }
    `;
  }

  private getFragmentShaderSource(): string {
    return `
      precision mediump float;
      
      uniform sampler2D uTexture;
      uniform vec2 uTexelSize;
      uniform float uIntensity;
      
      varying vec2 vTexCoord;

      // Gaussian blur kernel
      float gaussianBlur(sampler2D tex, vec2 uv, float radius) {
        float result = 0.0;
        float weight = 0.0;
        
        for(float x = -2.0; x <= 2.0; x += 1.0) {
          for(float y = -2.0; y <= 2.0; y += 1.0) {
            float dist = sqrt(x*x + y*y);
            float w = exp(-dist*dist / (2.0*radius*radius));
            result += texture2D(tex, uv + vec2(x, y) * uTexelSize).r * w;
            weight += w;
          }
        }
        
        return result / weight;
      }

      // Retinex tone mapping
      void main() {
        vec3 color = texture2D(uTexture, vTexCoord).rgb;
        
        // Convert to luminance
        float L = dot(color, vec3(0.299, 0.587, 0.114));
        
        // Multi-scale Retinex: compute at different scales
        float scale1 = gaussianBlur(uTexture, vTexCoord, 15.0);
        float scale2 = gaussianBlur(uTexture, vTexCoord, 80.0);
        float scale3 = gaussianBlur(uTexture, vTexCoord, 250.0);
        
        // Combine scales
        float retinex = 0.33 * log(L / (scale1 + 0.001)) +
                        0.33 * log(L / (scale2 + 0.001)) +
                        0.34 * log(L / (scale3 + 0.001));
        
        // Apply tone mapping
        float enhanced = L + retinex * uIntensity;
        
        // Preserve color ratios
        vec3 result = color * (enhanced / (L + 0.001));
        
        // Clamp and apply gamma correction
        result = pow(clamp(result, 0.0, 1.0), vec3(0.9));
        
        gl_FragColor = vec4(result, 1.0);
      }
    `;
  }

  private createPositionBuffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer()!;
    const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
    return buffer;
  }

  private createTexCoordBuffer(): WebGLBuffer {
    const buffer = this.gl.createBuffer()!;
    const coords = [0, 0, 1, 0, 0, 1, 1, 1];
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(coords), this.gl.STATIC_DRAW);
    return buffer;
  }

  private setupFramebuffer(): void {
    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderbuffer);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  public apply(canvas: HTMLCanvasElement, intensity: number = 1.5): void {
    const gl = this.gl;

    // Create texture from canvas
    const inputTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Use program
    gl.useProgram(this.program);

    // Set uniforms
    const texelSizeLocation = gl.getUniformLocation(this.program, 'uTexelSize');
    const intensityLocation = gl.getUniformLocation(this.program, 'uIntensity');
    gl.uniform2f(texelSizeLocation, 1.0 / this.width, 1.0 / this.height);
    gl.uniform1f(intensityLocation, intensity);

    // Set position attribute
    const positionLocation = gl.getAttribLocation(this.program, 'position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set texCoord attribute
    const texCoordLocation = gl.getAttribLocation(this.program, 'texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Render to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Read pixels back to canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const pixels = new Uint8Array(this.width * this.height * 4);
      gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const imageData = ctx.createImageData(this.width, this.height);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    }

    // Cleanup
    gl.deleteTexture(inputTexture);
  }

  public destroy(): void {
    this.gl.deleteBuffer(this.positionBuffer);
    this.gl.deleteBuffer(this.texCoordBuffer);
    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteTexture(this.texture);
    this.gl.deleteRenderbuffer(this.renderbuffer);
    this.gl.deleteProgram(this.program);
  }
}

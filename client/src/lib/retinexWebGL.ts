/**
 * WebGL Single-Scale Retinex for dark-room contrast enhancement.
 * Used after CLAHE in the dark-room pipeline (brightness < 30).
 * Preserves natural colours by operating on luminance and scaling RGB proportionally.
 */

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_image;
  uniform vec2 u_texSize;
  uniform float u_strength;
  varying vec2 v_texCoord;

  float luminance(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec4 tex = texture2D(u_image, v_texCoord);
    float L = luminance(tex.rgb);
    float logL = log(max(L, 1e-5) + 1.0);

    // 5x5 Gaussian blur of log(L) for Single-Scale Retinex (sigma ~ 2)
    float blurLogL = 0.0;
    float totalWeight = 0.0;
    float sigma = 2.0;
    for (int dy = -2; dy <= 2; dy++) {
      for (int dx = -2; dx <= 2; dx++) {
        vec2 off = vec2(float(dx), float(dy)) / u_texSize;
        float d = float(dx*dx + dy*dy);
        float w = exp(-d / (2.0 * sigma * sigma));
        float sampleL = luminance(texture2D(u_image, v_texCoord + off).rgb);
        blurLogL += log(max(sampleL, 1e-5) + 1.0) * w;
        totalWeight += w;
      }
    }
    blurLogL /= totalWeight;

    // Reflectance R = log(L+1) - log(L_blur+1)
    float R = logL - blurLogL;
    // Enhanced luminance: L * (1 + strength * R), clamped
    float enhancedL = L * (1.0 + u_strength * R);
    enhancedL = clamp(enhancedL, 0.0, 1.0);
    // Scale RGB by ratio to preserve hue
    float ratio = L > 1e-5 ? (enhancedL / L) : 1.0;
    vec3 outRGB = tex.rgb * ratio;

    gl_FragColor = vec4(outRGB, tex.a);
  }
`;

let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let buffer: WebGLBuffer | null = null;
let texture: WebGLTexture | null = null;
let offscreenCanvas: HTMLCanvasElement | null = null;

function getGL(width: number, height: number): WebGLRenderingContext | null {
  if (gl && offscreenCanvas && offscreenCanvas.width === width && offscreenCanvas.height === height)
    return gl;
  offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const ctx = offscreenCanvas.getContext("webgl", {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!ctx) return null;
  gl = ctx;
  const vs = ctx.createShader(ctx.VERTEX_SHADER)!;
  ctx.shaderSource(vs, VERTEX_SHADER);
  ctx.compileShader(vs);
  if (!ctx.getShaderParameter(vs, ctx.COMPILE_STATUS)) {
    console.error('Retinex vertex shader:', ctx.getShaderInfoLog(vs));
    return null;
  }
  const fs = ctx.createShader(ctx.FRAGMENT_SHADER)!;
  ctx.shaderSource(fs, FRAGMENT_SHADER);
  ctx.compileShader(fs);
  if (!ctx.getShaderParameter(fs, ctx.COMPILE_STATUS)) {
    console.error('Retinex fragment shader:', ctx.getShaderInfoLog(fs));
    return null;
  }
  program = ctx.createProgram()!;
  ctx.attachShader(program, vs);
  ctx.attachShader(program, fs);
  ctx.linkProgram(program);
  if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
    console.error('Retinex program:', ctx.getProgramInfoLog(program));
    return null;
  }
  buffer = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
  const verts = new Float32Array([
    -1, -1, 0, 1,  1, -1, 1, 1,  -1, 1, 0, 0,
    -1, 1, 0, 0,   1, -1, 1, 1,   1, 1, 1, 0
  ]);
  ctx.bufferData(ctx.ARRAY_BUFFER, verts, ctx.STATIC_DRAW);
  return ctx;
}

/**
 * Apply Single-Scale Retinex to the canvas content in place.
 * strength: 0.3 (low), 0.6 (medium), 0.9 (high) for dark room.
 * Uses an offscreen WebGL canvas so the display canvas keeps its 2D context.
 */
export function applyRetinex(canvas: HTMLCanvasElement, strength: number): void {
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return;

  const ctx = getGL(w, h);
  if (!ctx || !program || !buffer) return;

  const ctx2d = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx2d) return;
  const imageData = ctx2d.getImageData(0, 0, w, h);

  if (!texture) texture = ctx.createTexture();
  ctx.bindTexture(ctx.TEXTURE_2D, texture);
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, w, h, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, imageData.data);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);

  ctx.viewport(0, 0, w, h);
  ctx.useProgram(program);

  const posLoc = ctx.getAttribLocation(program, 'a_position');
  const tcLoc = ctx.getAttribLocation(program, 'a_texCoord');
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
  ctx.enableVertexAttribArray(posLoc);
  ctx.vertexAttribPointer(posLoc, 2, ctx.FLOAT, false, 16, 0);
  ctx.enableVertexAttribArray(tcLoc);
  ctx.vertexAttribPointer(tcLoc, 2, ctx.FLOAT, false, 16, 8);

  ctx.activeTexture(ctx.TEXTURE0);
  ctx.bindTexture(ctx.TEXTURE_2D, texture);
  ctx.uniform1i(ctx.getUniformLocation(program, 'u_image'), 0);
  ctx.uniform2f(ctx.getUniformLocation(program, 'u_texSize'), w, h);
  ctx.uniform1f(ctx.getUniformLocation(program, 'u_strength'), strength);

  ctx.drawArrays(ctx.TRIANGLES, 0, 6);

  // Read from offscreen WebGL and write back to display canvas (2D)
  const outData = new Uint8ClampedArray(w * h * 4);
  ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, outData);
  // WebGL Y is bottom-up; flip for canvas
  const flipped = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w * 4;
    const dstRow = y * w * 4;
    for (let i = 0; i < w * 4; i++) flipped[dstRow + i] = outData[srcRow + i];
  }
  ctx2d.putImageData(new ImageData(flipped, w, h), 0, 0);
}

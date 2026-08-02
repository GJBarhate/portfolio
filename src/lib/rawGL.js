/**
 * A ~3 KB raw-WebGL overlay for the project-card hover distortion.
 *
 * The effect is one fullscreen quad and one fragment shader. Three.js was
 * carrying a 131 KB scene graph, camera stack and material system to do it,
 * and — because the card component imported three statically — that cost was
 * paid by every visitor, on every device, whether or not a pointer existed to
 * trigger the hover. This module does the same job with the platform API.
 *
 * There is exactly one context: only one card can be hovered at a time, so the
 * single canvas is moved into whichever card is active.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
uniform sampler2D uTexture;
uniform float uProgress;
uniform vec2 uMouse;
uniform float uImageAspect;
uniform float uBoxAspect;
varying vec2 vUv;

/* object-fit: cover + object-position: top, in UV space. */
vec2 coverUv(vec2 uv) {
  vec2 s = vec2(1.0);
  if (uBoxAspect > uImageAspect) s.y = uImageAspect / uBoxAspect;
  else s.x = uBoxAspect / uImageAspect;
  vec2 o = vec2((1.0 - s.x) * 0.5, 1.0 - s.y);
  return uv * s + o;
}

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  centered.x *= uBoxAspect;
  vec2 mouse = uMouse * 2.0 - 1.0;
  mouse.x *= uBoxAspect;

  float influence = smoothstep(0.6, 0.0, distance(centered, mouse)) * uProgress;
  vec2 offset = (centered - mouse) * influence * 0.08;
  vec2 uv = coverUv(clamp(vUv + offset, 0.0, 1.0));

  /* Chromatic split scales with the distortion, so a resting card is exact. */
  float ca = influence * 0.012;
  float r = texture2D(uTexture, clamp(uv + vec2(ca, 0.0), 0.0, 1.0)).r;
  float g = texture2D(uTexture, uv).g;
  float b = texture2D(uTexture, clamp(uv - vec2(ca, 0.0), 0.0, 1.0)).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}`

let instance = null

function compile(gl, type, source) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, source)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) console.warn('rawGL shader:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

/**
 * The one shared distortion context, created on first hover.
 * @returns {{gl: WebGLRenderingContext|null, canvas: HTMLCanvasElement, uniforms?: object}}
 */
export function getDistortionGL() {
  if (instance) return instance

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')

  let gl = null
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      // Battery over flex — this is decoration on a hover state.
      powerPreference: 'low-power',
    })
  } catch { /* no WebGL — the plain <picture> underneath is the whole fallback */ }

  if (!gl) {
    instance = { gl: null, canvas }
    return instance
  }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) {
    instance = { gl: null, canvas }
    return instance
  }

  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    instance = { gl: null, canvas }
    return instance
  }

  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  instance = {
    gl,
    canvas,
    program,
    uniforms: {
      uTexture: gl.getUniformLocation(program, 'uTexture'),
      uProgress: gl.getUniformLocation(program, 'uProgress'),
      uMouse: gl.getUniformLocation(program, 'uMouse'),
      uImageAspect: gl.getUniformLocation(program, 'uImageAspect'),
      uBoxAspect: gl.getUniformLocation(program, 'uBoxAspect'),
    },
  }
  gl.uniform1i(instance.uniforms.uTexture, 0)
  return instance
}

/**
 * Upload an already-decoded image as a texture on the shared context.
 * @param {HTMLImageElement} image
 * @returns {WebGLTexture|null}
 */
export function createTexture(image) {
  const { gl } = getDistortionGL()
  if (!gl) return null
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  // Non-power-of-two screenshots: clamp + linear, no mipmaps.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return tex
}

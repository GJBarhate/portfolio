/**
 * §14 — the site's single background engine.
 *
 * One fullscreen quad, one fragment shader, no scene graph, no geometry, no
 * textures (Research #18). This replaces the ambient patchwork — a particle
 * field, a constellation canvas and a second drifting-dot canvas, each with
 * its own context, its own theme handling and its own idea of what "calm"
 * looks like — with one coherent GPU layer whose character shifts per section.
 *
 * Budget: ≤ 1.2 ms/frame at DPR 1.5 on a 2020 iGPU. In dev the actual GPU time
 * is sampled with EXT_disjoint_timer_query and logged next to the tier.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

/*
 * Gustavson-style simplex noise: self-contained GLSL, no texture lookups, and
 * every loop bound is a literal constant — uniform ints as loop bounds are a
 * classic low-end GPU compile failure.
 */
const FRAG = `
precision mediump float;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;
uniform float uScrollVel;
uniform float uSection;      /* 0 hero … 8 footer, fractional while blending */
uniform vec3  uSurface;
uniform vec3  uAccent;
uniform vec3  uGlow;
uniform float uIntensity;

varying vec2 vUv;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vUv;
  p.x *= aspect;

  /* Fast scrolling visibly drags the field — cheapest wow-per-ms available. */
  p.y += uScrollVel * 0.06;

  float t = uTime;

  /* Two octaves, domain-warped. A third octave was not worth the millisecond. */
  vec2 warp = vec2(
    snoise(p * 0.8 + vec2(t * 0.05, 0.0)),
    snoise(p * 0.8 + vec2(0.0, t * 0.045))
  );
  vec2 q = p + 0.35 * warp;

  float n = snoise(q * 1.15 + vec2(t * 0.03, t * 0.02)) * 0.65
          + snoise(q * 2.60 - vec2(t * 0.02, t * 0.035)) * 0.35;
  n = n * 0.5 + 0.5;

  /* Pointer bloom — the liquid trailing the cursor. */
  vec2 m = uMouse;
  m.x *= aspect;
  float bloom = smoothstep(0.55, 0.0, distance(p, m));

  /* Section character. Hero flows; projects tint toward the hovered accent;
     contact drifts; everything between is nearly still. */
  float heroness    = 1.0 - smoothstep(0.0, 1.4, uSection);
  float projectness = 1.0 - abs(clamp(uSection, 2.0, 6.0) - 4.0) * 0.5;
  float energy = uIntensity * (0.35 + heroness * 0.75 + projectness * 0.3);

  float field = pow(n, 1.8) * energy + bloom * 0.16 * uIntensity;

  vec3 col = mix(uSurface, uAccent, clamp(field, 0.0, 1.0));
  col = mix(col, uGlow, clamp(pow(n, 6.0) * energy * 0.8 + bloom * 0.10, 0.0, 1.0));

  /* Vignette keeps the centre readable and hides the quad's edges. */
  vec2 d = vUv - 0.5;
  float vig = 1.0 - dot(d, d) * 0.85;
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}`

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) console.warn('bgEngine shader:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

/**
 * Build the engine on a canvas. Returns null if WebGL or the shader is
 * unavailable — callers fall back to the static CSS gradient composition.
 */
export function createBackgroundEngine(canvas) {
  let gl = null
  try {
    gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      // Battery over flex: this is decoration that runs for the whole session.
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    })
  } catch { /* handled below */ }
  if (!gl) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null

  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null

  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const u = {}
  for (const name of ['uResolution', 'uTime', 'uMouse', 'uScrollVel', 'uSection', 'uSurface', 'uAccent', 'uGlow', 'uIntensity']) {
    u[name] = gl.getUniformLocation(program, name)
  }

  const timerExt = import.meta.env.DEV
    ? gl.getExtension('EXT_disjoint_timer_query')
    : null

  return {
    gl,
    program,
    uniforms: u,
    timerExt,
    dispose() {
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

/** #rrggbb → [r, g, b] in 0..1. */
export function hexToVec3(hex) {
  const n = parseInt((hex || '#000000').slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

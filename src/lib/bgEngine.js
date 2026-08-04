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
/*
 * Which motif is on screen, and which one it is turning into.
 *
 * These used to be derived from uSection directly — motif id WAS the section
 * index — which quietly meant the ninth-best-looking motif got the hero and
 * three of them were only reachable by scrolling past the end of the page.
 * Naming them as their own uniforms is what lets any section wear any motif,
 * and it costs two floats.
 */
uniform float uMotifA;
uniform float uMotifB;
uniform float uBlend;
uniform vec3  uSurface;
uniform vec3  uAccent;
uniform vec3  uGlow;
uniform float uIntensity;
/* xy = tap origin in the same space as uMouse, z = life, 1 → 0. */
uniform vec3  uRipple;

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

/* ══════════════════════════════════════════════════════════════════════════
   The motifs.

   Every section gets its own character of background, and they all live in
   this one shader on purpose. The obvious way to get twelve different animated
   backdrops is twelve libraries, each mounting its own WebGL context; browsers
   cap contexts at roughly 8–16 and silently kill the oldest, three of the
   site's other scenes are already holding one, and each such library costs
   1.5–4 ms of a 5 ms frame that has 0.8 ms left. Twelve of them is not a big
   version of this — it is a page that goes black.

   Every motif below is a function of position and time returning
   'vec2(field, glow)': how lit this pixel is, and how much of it is hot core.
   Colour is applied once, afterwards, from the live theme palette — which is
   the reason these read as one site in eight moods rather than as eight
   embedded widgets that happen to share a page.

   Two are evaluated per frame — the section you are in and the one you are
   heading toward — and crossfaded on the same damped 'uSection' that already
   drove the old character shift.
   ══════════════════════════════════════════════════════════════════════════ */

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float fbm2(vec2 p) {
  return snoise(p) * 0.65 + snoise(p * 2.4) * 0.35;
}

/* Ground-plane projection, shared by the two motifs that need a floor
   receding to a horizon. Returns uv on the plane; 'vis' is 0 above the
   horizon so the caller can fade rather than divide by zero. */
vec2 groundPlane(vec2 p, float horizon, float tile, out float vis) {
  float d = horizon - p.y;
  vis = step(0.006, d);
  /* Depth is 1/d — the perspective divide, done backwards. Scaling BOTH axes
     by the same tile keeps a cell square, which is what stops the dots
     smearing into ellipses: the first version scaled the depth axis only, so
     a cell was many times wider than it was tall wherever the floor was near
     the camera. */
  float z = 1.0 / max(d, 0.006);
  return vec2((p.x - 0.9) * z, z) * tile;
}

/* FOG — domain-warped fBm. The site's original field, kept as the hero's own
   motif because it is the one every other section is a departure from. */
vec2 mFog(vec2 p, float t) {
  vec2 warp = vec2(snoise(p * 0.8 + vec2(t * 0.05, 0.0)),
                   snoise(p * 0.8 + vec2(0.0, t * 0.045)));
  vec2 q = p + 0.35 * warp;
  float n = snoise(q * 1.15 + vec2(t * 0.03, t * 0.02)) * 0.65
          + snoise(q * 2.60 - vec2(t * 0.02, t * 0.035)) * 0.35;
  n = n * 0.5 + 0.5;
  return vec2(pow(n, 1.8), pow(n, 6.0));
}

/* CLOUDS — the same noise lit from above. The difference between fog and
   cloud is not the noise, it is that a cloud has a top: the vertical gradient
   of the density field becomes a lighting term, so billows catch light on
   their upper edge and fall into shadow underneath. */
vec2 mClouds(vec2 p, float t) {
  /* Cloud deck: dense along a band, thinning above it. Without the vertical
     falloff this is just noise everywhere, which is fog — the horizon is what
     makes it sky. */
  vec2 q = p * 1.9 + vec2(t * 0.035, -t * 0.012);
  float n = fbm2(q) * 0.5 + 0.5;
  /* Sampling the field slightly higher and differencing gives the vertical
     gradient of density: positive where a billow's top faces the light. That
     one term is the whole difference between cloud and fog. */
  float above = fbm2(q + vec2(0.0, 0.10)) * 0.5 + 0.5;
  float lit = clamp((n - above) * 6.0, 0.0, 1.0);
  float deck = smoothstep(0.05, 0.55, p.y) * smoothstep(1.05, 0.55, p.y);
  float body = smoothstep(0.40, 0.78, n) * deck;
  return vec2(body * 0.85 + lit * deck * 0.6, lit * body * 1.3);
}

/* WAVES — a heightfield on the ground plane, shaded by its own slope. Two
   crossed swells at different rates keep it from reading as a repeating
   corrugation, and the shading is the forward difference of the height, which
   is what turns a sine into a lit surface. */
vec2 mWaves(vec2 p, float t) {
  float vis;
  vec2 g = groundPlane(p, 0.72, 1.6, vis);
  /* Three swells at different bearings, so the surface never resolves into a
     corrugation you can count. */
  float h  = sin(g.x * 1.3 + t * 0.9)
           + sin(g.y * 0.8 - t * 0.6)
           + 0.6 * sin((g.x + g.y) * 0.5 + t * 0.4);
  /* The lighting is the slope, taken as a finite difference along x. The step
     has to be a real fraction of a wavelength: the first version stepped 0.06
     plane units against a wavelength of several, so h and h2 were equal to
     four decimal places everywhere and the whole surface came out at exactly
     mid-grey — a lit plane with no light on it. */
  float hx = sin((g.x + 0.30) * 1.3 + t * 0.9)
           + sin(g.y * 0.8 - t * 0.6)
           + 0.6 * sin((g.x + 0.30 + g.y) * 0.5 + t * 0.4);
  float slope = clamp((h - hx) * 0.9 + 0.5, 0.0, 1.0);
  float fade = vis * smoothstep(0.0, 0.28, 0.72 - p.y);
  return vec2(slope * fade, pow(slope, 6.0) * fade);
}

/* NET — points on a jittered lattice, joined to their neighbours. The lines
   are the point of it, and the cheap way to draw them is not to draw lines at
   all: for each of the nine surrounding cells, take the distance from this
   pixel to that cell's point, and keep the two smallest. Where the two are
   nearly equal the pixel is on the perpendicular bisector — the edge between
   them — and that is the web. */
vec2 mNet(vec2 p, float t) {
  vec2 sp = p * 4.5;
  vec2 cell = floor(sp);
  vec2 f = fract(sp);
  float d1 = 8.0, d2 = 8.0, node = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 h = hash2(cell + o);
      /* Each node drifts on its own phase, so the web breathes. */
      vec2 pos = o + 0.5 + 0.42 * sin(t * 0.55 + 6.2831 * h);
      float d = length(pos - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      node += smoothstep(0.09, 0.0, d);
    }
  }
  float edge = smoothstep(0.10, 0.0, d2 - d1);
  return vec2(edge * 0.55 + node * 0.9, node);
}

/* DOTS — a lattice on the ground plane. Perspective does the work: the dots
   are the same size in plane space, so they shrink and crowd toward the
   horizon for free. */
vec2 mDots(vec2 p, float t) {
  float vis;
  vec2 g = groundPlane(p, 0.66, 4.0, vis);
  vec2 c = fract(g + vec2(0.0, t * 0.5)) - 0.5;
  float d = smoothstep(0.17, 0.03, length(c));
  /* Fade at both ends: into the horizon, where the rows converge faster than
     the pixel grid can resolve them, and at the very bottom where a single
     cell would otherwise fill a quarter of the screen. */
  float fade = vis * smoothstep(0.0, 0.30, 0.66 - p.y) * smoothstep(0.66, 0.40, p.y * 0.0 + (0.66 - p.y));
  return vec2(d * fade, d * fade * 0.7);
}

/* RINGS — concentric bands whose radius is pushed around by noise, so they
   drift out of round the way a poured ring does. */
vec2 mRings(vec2 p, float t) {
  /* Orbits seen almost edge-on, each one broken into arcs.
     Squashing y before taking the radius is what tilts the plane — concentric
     circles become concentric ellipses, which is the whole reason the
     reference reads as rings lying in space rather than as a dartboard. */
  vec2 c = (p - vec2(0.9, 0.52)) * vec2(1.0, 2.6);
  float rr = length(c);
  float r = rr * 5.0;
  /* Same seam rule as the halo: sample around the circle, never on the angle
     itself, or every ring is cut along the same ray. */
  vec2 dir = c / max(rr, 0.0001);
  r += snoise(dir * 1.5 + vec2(t * 0.2, 0.0)) * 0.5;
  float band = abs(fract(r - t * 0.35) - 0.5);
  float line = smoothstep(0.22, 0.02, band);
  /* Arcs, not complete rings: a second noise gates each band around its own
     circumference, so every orbit is a few bright segments with gaps. */
  float arc = smoothstep(0.15, 0.65, snoise(dir * 2.4 + vec2(r * 0.35, t * 0.3)) * 0.5 + 0.5);
  /* Empty in the middle. Unlike the trunk, these rings are centred on screen
     by design — they are orbits and the focus belongs in frame — so the
     singularity at r=0 cannot be moved out of view and has to be faded out
     instead. Everything inside the innermost orbit is simply not drawn. */
  float falloff = smoothstep(4.2, 0.6, r) * smoothstep(0.25, 1.1, r);
  return vec2(line * arc * falloff, pow(line * arc, 3.0) * falloff);
}

/* HALO — one organic mass with a bright rim. The rim is the gradient of the
   blob's own edge, which is why it stays a rim when the shape deforms. */
vec2 mHalo(vec2 p, float t) {
  /* A torus seen at an angle: a bright ring with a hole, folded by noise so
     it reads as a soft body catching light rather than as a drawn circle.
     The reference is a lit shape whose brightest part is the RIM — so the rim
     is built first and the body hung off it, not the other way round. */
  vec2 c = (p - vec2(0.9, 0.5)) * vec2(1.0, 1.25);
  float r = length(c);
  /*
   * Two lobes of noise at different rates, sampled on the unit circle rather
   * than on the raw angle.
   *
   * Feeding 'atan' into noise directly looks correct and is not: the angle
   * jumps from +pi to -pi along one ray, so the noise lands on a completely
   * different value either side of it and the shape acquires a hard seam —
   * and any harmonic above about 3 turns the whole silhouette into a spiked
   * starburst, because the noise is being sampled far faster than the shape
   * can follow. The direction vector has no wrap and no such aliasing.
   */
  /*
   * The scale here is angular frequency in disguise. 'dir' is a unit vector,
   * so multiplying it by k traces a circle of radius k through the noise —
   * circumference 2*pi*k. At k=3.3 that is twenty-one noise units around the
   * shape, i.e. about ten lobes, which is not an organic blob, it is a star.
   * Sub-1 radii give two or three slow undulations, which is what a soft body
   * catching light actually looks like.
   */
  vec2 dir = c / max(r, 0.0001);
  float fold = snoise(dir * 0.7 + vec2(t * 0.18, 0.0)) * 0.06
             + snoise(dir * 1.2 - vec2(0.0, t * 0.13)) * 0.03;
  float ringR = 0.27 + fold;
  float d = abs(r - ringR);
  float rim = smoothstep(0.14, 0.0, d);
  float bloom = smoothstep(0.42, 0.0, d) * 0.45;
  float hole = smoothstep(ringR * 0.55, ringR * 0.92, r);
  return vec2((rim * 0.9 + bloom) * hole, pow(rim, 1.6) * hole);
}

/* CELLS — Voronoi. Distance to the nearest jittered point gives the cell
   interior; the walls are where that distance stops falling. */
vec2 mCells(vec2 p, float t) {
  vec2 sp = p * 5.0;
  vec2 cell = floor(sp);
  vec2 f = fract(sp);
  float d1 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 h = hash2(cell + o);
      vec2 pos = o + 0.5 + 0.4 * sin(t * 0.4 + 6.2831 * h);
      d1 = min(d1, length(pos - f));
    }
  }
  float interior = smoothstep(0.75, 0.05, d1);
  return vec2(interior * 0.85, pow(interior, 3.0));
}

/* TOPOLOGY — contour lines of the noise field.
 *
 * The textbook version widths each line with 'fwidth', which needs
 * GL_OES_standard_derivatives — an extension, not core, in WebGL 1. This
 * shader's whole reason for existing is that it compiles on the low-end GPUs
 * where the effect matters most, so the slope is taken by hand instead: one
 * extra sample of the same field a small step away. Two noise calls where a
 * derivative would have done, and it cannot fail to compile. */
vec2 mTopology(vec2 p, float t) {
  vec2 q = p * 1.7 + vec2(t * 0.05, t * 0.02);
  float n = fbm2(q);
  float slope = abs(fbm2(q + vec2(0.012, 0.012)) - n) * 7.0;
  float bands = n * 7.0;
  float d = abs(fract(bands) - 0.5);
  float line = 1.0 - smoothstep(0.0, slope + 0.03, d);
  return vec2(line * 0.75 + (n * 0.5 + 0.5) * 0.18, line * 0.6);
}

/* TRUNK — rings in polar space around an off-screen centre, with the radius
   warped by angle. Tree rings: dense, uneven, and concentric about a point
   you cannot see. */
vec2 mTrunk(vec2 p, float t) {
  /* The centre is deliberately off-canvas. Every polar field has a
     singularity at its origin — atan is undefined there and the angular noise
     term collapses into a starburst — and the only robust fix is to put the
     origin somewhere the viewer never is. It also reads better: rings whose
     centre you cannot see imply something larger than the screen. */
  vec2 c = p - vec2(-0.30, 1.22);
  float a = atan(c.y, c.x);
  float r = length(c) * 5.0 + snoise(vec2(a * 2.2, t * 0.12)) * 0.5;
  float d = abs(fract(r * 1.6 - t * 0.06) - 0.5);
  float line = smoothstep(0.20, 0.02, d);
  return vec2(line * 0.7, pow(line, 5.0) * 0.6);
}

/* GLOBE — a wireframe sphere, drawn analytically. The sphere is never built:
   for each pixel inside the disc, the z of the front surface is recovered
   from x and y, which is enough to place latitude and longitude lines and to
   fade them as they turn away from the camera. */
vec2 mGlobe(vec2 p, float t) {
  vec2 c = (p - vec2(0.9, 0.5)) * 3.4;
  float r2 = dot(c, c);
  if (r2 > 1.0) return vec2(0.0, 0.0);
  float z = sqrt(1.0 - r2);
  float lat = asin(clamp(c.y, -1.0, 1.0));
  float lon = atan(c.x, z) + t * 0.25;
  float la = abs(fract(lat * 3.2) - 0.5);
  float lo = abs(fract(lon * 2.4) - 0.5);
  float grid = smoothstep(0.06, 0.0, la) + smoothstep(0.06, 0.0, lo);
  /* Limb darkening: lines near the edge are nearly edge-on to the camera. */
  float depth = 0.35 + z * 0.65;
  return vec2(grid * depth * 0.7, smoothstep(0.9, 1.0, 1.0 - r2) * 0.4 + grid * depth * 0.25);
}

vec2 motif(int id, vec2 p, float t) {
  if (id <= 0) return mFog(p, t);
  if (id == 1) return mCells(p, t);
  if (id == 2) return mDots(p, t);
  if (id == 3) return mNet(p, t);
  if (id == 4) return mWaves(p, t);
  if (id == 5) return mTopology(p, t);
  if (id == 6) return mTrunk(p, t);
  if (id == 7) return mHalo(p, t);
  if (id == 8) return mGlobe(p, t);
  if (id == 9) return mClouds(p, t);
  return mRings(p, t);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vUv;
  p.x *= aspect;

  /* Fast scrolling visibly drags the field — cheapest wow-per-ms available. */
  p.y += uScrollVel * 0.06;

  float t = uTime;

  /* The motif you are looking at, and the one it is becoming. The blend is
     computed on the CPU from the damped section index, so it is a real
     dissolve rather than a snap at the boundary — you watch one backdrop
     turn into the next as you scroll. */
  vec2 mo = motif(int(uMotifA + 0.5), p, t);
  /* Only pay for the second motif while a crossfade is actually running.
     The branch is on a uniform, so it is coherent across the whole draw — every
     pixel takes the same path and the GPU genuinely skips the work rather than
     executing both sides and throwing one away. Parked in a section, which is
     where a reader spends nearly all their time, this shader costs exactly what
     the single-motif version did. */
  if (uBlend > 0.002) {
    mo = mix(mo, motif(int(uMotifB + 0.5), p, t), uBlend);
  }

  float n = mo.x;

  /* Pointer bloom — the liquid trailing the cursor. On touch this follows the
     finger, which is the same gesture by a different name. */
  vec2 m = uMouse;
  m.x *= aspect;
  float bloom = smoothstep(0.55, 0.0, distance(p, m));

  /* Tap ripple. A cursor produces a continuous bloom simply by existing; a
     finger only exists at the moment it lands, so a tap gets an event of its
     own — an expanding ring that fades as it grows. This is what makes the
     field feel touched rather than merely animated. */
  vec2 rp = uRipple.xy;
  rp.x *= aspect;
  float life = uRipple.z;
  float ripple = 0.0;
  if (life > 0.001) {
    float radius = (1.0 - life) * 0.95;
    float ring = abs(distance(p, rp) - radius);
    /* Sharp at birth, soft as it dissipates, so it reads as energy spreading
       rather than a hard circle sliding outward. */
    float width = 0.02 + (1.0 - life) * 0.10;
    ripple = smoothstep(width, 0.0, ring) * life * life;
  }

  /*
   * Energy — how loud this section's backdrop is allowed to be.
   *
   * The hero is the only place the field is the subject; everywhere else it
   * sits behind text that has to stay readable, which is the entire reason
   * this stays a wash of the theme palette rather than the saturated demo
   * colours these motifs are usually shown in. A background a recruiter
   * notices is a background that failed.
   */
  float heroness = 1.0 - smoothstep(0.0, 1.4, uSection);
  float energy = uIntensity * (0.42 + heroness * 0.55);

  float field = n * energy + bloom * 0.16 * uIntensity
              + ripple * 0.30 * uIntensity;

  vec3 col = mix(uSurface, uAccent, clamp(field, 0.0, 1.0));
  /* mo.y is each motif's own idea of "hot core" — the lit edge of a cloud,
     the node of the net, the rim of the halo — so the glow lands on the part
     of the pattern that is actually the light, not merely on the brightest
     noise. */
  col = mix(col, uGlow, clamp(mo.y * energy * 0.7 + bloom * 0.10 + ripple * 0.45, 0.0, 1.0));

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
  for (const name of ['uResolution', 'uTime', 'uMouse', 'uScrollVel', 'uSection', 'uMotifA', 'uMotifB', 'uBlend', 'uSurface', 'uAccent', 'uGlow', 'uIntensity', 'uRipple']) {
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

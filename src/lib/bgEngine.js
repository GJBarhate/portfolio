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
/* §14.5 — 0 calm, 1 motifs, 2 forest. One program, three scenes: the branch
   is on a uniform, so it is coherent across the entire draw and the GPU skips
   the two scenes it is not drawing instead of executing all three. */
uniform float uScene;

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

/* ══════════════════════════════════════════════════════════════════════════
   THE FOREST — §14.5, uScene == 2, and the default.

   A motif is a texture; this is a place. Sky, ridges receding into haze,
   three tree lines moving in real wind, water with a rippled reflection,
   drifting motes, birds, and animals on the near bank.

   Three rules keep it inside the frame budget it has to live in:

   1. Every layer is ANALYTIC. A tree line is not a loop over trees, it is
      'fract()' domain repetition with one hash per cell — the whole canopy
      costs the same as one tree. Nothing here iterates over scene content.

   2. Everything is a HEIGHTFIELD compare. Each layer answers "is this pixel
      below my skyline", which is one smoothstep against a curve, and layers
      composite back-to-front by painting over. No sorting, no depth buffer.

   3. The expensive parts are BANDED. The animals only exist in the bottom
      fifth of the screen and the reflection only below the waterline, both
      guarded by a 'p.y' compare. Those branches are spatially coherent — a
      whole warp takes the same side — so most of the screen genuinely never
      evaluates them rather than evaluating and discarding.

   Colour comes from the theme, as everywhere else in this file: the scene is
   built as depth + light and mapped through uSurface/uAccent/uGlow at the
   end, which is why Eclipse, Ember and Paper each get their own forest rather
   than the same forest with a filter over it.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── 4C.1 / 4C.2 — three-point ramps and real aerial perspective ──────────
 *
 * Every depth in the forest used to be 'mix(ink, lit, k)': a straight line
 * between two colours. That is what produces the plasticky midtone that reads
 * as "cartoon" — in a real scene the shadowed end of a ramp is COOLER than a
 * neutral interpolation and the lit end is WARMER, because shadows are lit by
 * the sky and highlights by the sun. Inserting those two stops is the single
 * cheapest thing that separates a photograph's colour from a gradient's.
 *
 * And the haze is wavelength-dependent (4C.2). Rayleigh scattering is stronger
 * at short wavelengths, so distant things do not merely lose contrast, they go
 * BLUE. Extinction per channel is two extra multiplies and it is most of what
 * makes distance read as distance rather than as fog.
 *
 * Declared at file scope because GLSL ES 1.00 has no nested functions — worth
 * stating, because writing them inside the forest routine (where they are
 * used) compiles fine in every C-like language except this one. */
vec3 aerialExtinction(float depth) {
  /* R < G < B: blue is scattered out of the line of sight fastest. */
  vec3 density = vec3(0.55, 0.78, 1.15);
  return 1.0 - exp(-depth * density * 2.2);
}
vec3 depthRamp(vec3 ink, vec3 lit, float k, float depth) {
  vec3 shadowTint = mix(ink, vec3(0.30, 0.42, 0.68), 0.16);
  vec3 lightTint  = mix(lit, vec3(1.00, 0.86, 0.62), 0.14);
  return mix(mix(shadowTint, lightTint, k), lit, aerialExtinction(depth));
}

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

/* Wind: one travelling gust plus a slow breathing envelope. Shared by every
   canopy so the whole forest leans together — trees swaying out of phase with
   each other reads as jelly, not as weather. */
float windAt(float x, float t, float scale) {
  float gust = 0.55 + 0.45 * sin(t * 0.23);
  return (sin(x * 1.7 - t * 0.85) * 0.6 + sin(x * 3.9 - t * 1.31) * 0.4) * gust * scale;
}

/*
 * One line of conifers, as a heightfield.
 *
 * 'density' cells across the width; each cell holds one tree whose height is
 * its hash. The silhouette inside a cell is a triangle — '1 - |2f - 1|' — and
 * the apex is displaced by the wind, more at the top than at the base, which
 * is what makes them bend rather than slide.
 */
float treeLine(vec2 p, float t, float density, float base, float height, float sway) {
  /*
   * 4C.3 -- break the regularity.
   *
   * The domain repetition here is 'fract(x * density)' with one hash per cell,
   * which is mathematically elegant and visually REGULAR: every tree occupies
   * exactly the same width, so the eye reads a comb. Randomising HEIGHT alone
   * does not help, because the tell is the spacing, not the profile.
   *
   * A second, much lower-frequency hash warps the domain before it is diced
   * into cells, so cell WIDTH varies too -- clumps and clearings, which is how
   * conifers actually grow. One sin and one multiply.
   */
  float clump = sin(p.x * 0.7 + hash1(floor(p.x * 0.35)) * 6.28) * 0.14;
  float x = (p.x + clump) * density;
  float cell = floor(x);
  float f = fract(x);
  float h = 0.45 + 0.55 * hash1(cell);
  /* Neighbour cells overlap slightly so the canopy is continuous rather than
     a row of separated spikes with sky between them. */
  float hL = 0.45 + 0.55 * hash1(cell - 1.0);
  float hR = 0.45 + 0.55 * hash1(cell + 1.0);
  /* Asymmetric spikes: a real conifer is not an isoceles triangle. The lean is
     hashed per cell so neighbours lean differently. */
  float lean = (hash1(cell + 31.7) - 0.5) * 0.34;
  float spike  = 1.0 - abs(f - 0.5 + lean) * 2.0;
  float spikeL = 1.0 - abs(f + 0.5) * 2.0;
  float spikeR = 1.0 - abs(f - 1.5) * 2.0;
  float canopy = max(max(spike * h, spikeL * hL), spikeR * hR);
  float top = base + canopy * height + windAt(p.x, t, sway) * canopy;
  /* A soft edge of ~1.5 screen pixels: a hard step aliases into a crawling
     staircase the moment the wind moves the canopy by a sub-pixel amount. */
  return smoothstep(top + 0.004, top - 0.004, p.y);
}

/* A ridge: a sum of three sines, no hash, so it reads as landform rather than
   as noise. Returns 1 below the skyline. */
float ridge(vec2 p, float base, float amp, float f1, float ph) {
  float y = base + amp * (0.62 * sin(p.x * f1 + ph)
                        + 0.28 * sin(p.x * f1 * 2.3 + ph * 1.7)
                        + 0.10 * sin(p.x * f1 * 4.1 + ph * 0.6));
  return smoothstep(y + 0.005, y - 0.005, p.y);
}

/* Distance to a line segment — the primitive every animal below is drawn
   from, and the only one worth having: a limb, a neck, a wing and a back are
   all capsules once you stop trying to model them. */
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

/*
 * A deer, mid-stride, from seven capsules.
 *
 * 'gait' drives a four-leg trot: fore and hind on each side in antiphase, the
 * two sides half a cycle apart. The body lifts on the same clock so it bounds
 * rather than glides. 's' is its height in scene units; everything else is
 * proportional to it, so one number resizes the animal.
 */
float deerMask(vec2 q, float gait, float s) {
  q /= s;
  float w = 0.085;
  float sw1 = sin(gait) * 0.55;
  float sw2 = sin(gait + 3.14159) * 0.55;
  /* body, neck, head */
  float d = segDist(q, vec2(-0.55, 0.62), vec2(0.42, 0.66));
  d = min(d, segDist(q, vec2(0.42, 0.66), vec2(0.72, 1.02)));
  d = min(d, segDist(q, vec2(0.72, 1.02), vec2(0.95, 1.05)));
  /* antlers — two short forks, the one detail that makes it read as a deer */
  d = min(d, segDist(q, vec2(0.74, 1.06), vec2(0.66, 1.36)) * 1.7);
  d = min(d, segDist(q, vec2(0.74, 1.06), vec2(0.92, 1.34)) * 1.7);
  /* legs: hind pair, then fore pair */
  d = min(d, segDist(q, vec2(-0.45, 0.60), vec2(-0.45 + sw1 * 0.42, 0.0)));
  d = min(d, segDist(q, vec2(-0.30, 0.60), vec2(-0.30 + sw2 * 0.42, 0.0)));
  d = min(d, segDist(q, vec2(0.26, 0.62), vec2(0.26 + sw2 * 0.42, 0.0)));
  d = min(d, segDist(q, vec2(0.40, 0.62), vec2(0.40 + sw1 * 0.42, 0.0)));
  return smoothstep(w, w * 0.45, d);
}

/*
 * An elephant: heavier, slower, and read almost entirely from its outline —
 * a thick back, a domed head, a hanging trunk and four columns. The trunk
 * swings on the same clock as the walk, which is most of what sells it.
 */
float elephantMask(vec2 q, float gait, float s) {
  q /= s;
  float sw1 = sin(gait) * 0.32;
  float sw2 = sin(gait + 3.14159) * 0.32;
  float trunk = sin(gait * 0.5) * 0.16;
  /* body — a fat capsule, so the stroke width IS the barrel */
  float d = segDist(q, vec2(-0.52, 0.72), vec2(0.34, 0.74)) * 0.55;
  /* head and trunk */
  d = min(d, segDist(q, vec2(0.34, 0.74), vec2(0.68, 0.80)) * 0.75);
  d = min(d, segDist(q, vec2(0.72, 0.72), vec2(0.86 + trunk, 0.34)));
  d = min(d, segDist(q, vec2(0.86 + trunk, 0.34), vec2(0.92 + trunk * 1.6, 0.10)));
  /* ear */
  d = min(d, segDist(q, vec2(0.44, 0.78), vec2(0.46, 0.52)) * 0.6);
  /* four columns */
  d = min(d, segDist(q, vec2(-0.40, 0.70), vec2(-0.40 + sw1 * 0.20, 0.0)) * 0.7);
  d = min(d, segDist(q, vec2(-0.22, 0.70), vec2(-0.22 + sw2 * 0.20, 0.0)) * 0.7);
  d = min(d, segDist(q, vec2(0.12, 0.72), vec2(0.12 + sw2 * 0.20, 0.0)) * 0.7);
  d = min(d, segDist(q, vec2(0.30, 0.72), vec2(0.30 + sw1 * 0.20, 0.0)) * 0.7);
  return smoothstep(0.085, 0.038, d);
}

/* A bird: two swept strokes meeting at a shoulder, flapping. */
float birdMask(vec2 q, float flap, float s) {
  q /= s;
  float a = 0.35 + sin(flap) * 0.45;
  vec2 tipL = vec2(-1.0, a);
  vec2 tipR = vec2(1.0, a);
  float d = min(segDist(q, vec2(0.0, 0.0), tipL), segDist(q, vec2(0.0, 0.0), tipR));
  return smoothstep(0.16, 0.05, d);
}

/*
 * The forest.
 *
 * 'variant' is the damped section index, so scrolling walks through nine
 * different forests rather than cutting between them: the ridge phase, the
 * canopy density, the waterline and the haze all move continuously with it.
 * Returns the composed colour; the caller applies vignette and grade.
 */
vec3 forest(vec2 p, float t, float variant, float lightTheme) {
  /* Per-section character, all continuous in 'variant' so the crossfade is
     free — no second evaluation, no blend, the scene simply IS different by
     the time you have scrolled there. */
  float v = variant;
  float phase = v * 1.9;
  float density = 5.0 + 2.6 * sin(v * 0.7);           /* how close the trees */
  /* The bank sits at ~a third of the viewport, not a seventh.
   *
   * At 0.14 the entire scene lived in the bottom seventh of a FIXED
   * background layer — which is the part of the viewport most reliably
   * covered by the section's own content. A forest nobody can see is not a
   * subtle forest, it is an expensive one. 0.32 puts the horizon, the ridges
   * and the canopy in the band that stays visible in the gutters and between
   * cards, and the legibility problem that creates is solved where it should
   * be: a scrim behind the text, not by hiding the picture. */
  float waterY = 0.32 + 0.06 * sin(v * 1.1);           /* where the bank is  */
  float haze = 0.30 + 0.16 * sin(v * 0.53 + 1.2);      /* how far it recedes */
  float canopyH = 0.150 + 0.040 * sin(v * 0.9 + 0.4);

  /* ── The two ends of the scene's tonal range ────────────────────────────
   *
   * This is the part the first attempt got wrong, and it is worth stating why
   * rather than just fixing it.
   *
   * Every layer was originally written as a small mix away from uSurface —
   * 'trees are uSurface * 0.65', 'haze is uSurface toward uGlow by 0.16'. On
   * Eclipse uSurface is very nearly black, so 65 % of it is also very nearly
   * black: five layers were drawn, all of them within a few units of each
   * other, and the whole forest rendered as a flat wash indistinguishable
   * from the calm scene. A silhouette needs something to be a silhouette
   * AGAINST.
   *
   * So the scene is built between two explicit poles and every layer picks a
   * lightness between them. The poles flip polarity with the theme, which is
   * what lets one set of layer weights render a night forest on Eclipse and a
   * pale dawn forest on Paper without a second code path:
   *
   *   ink    the silhouette end. Dark in BOTH polarities — a tree is dark
   *          against a cream sky exactly as it is against a black one.
   *   lit    the light-source end. On a dark theme that is the accent glow at
   *          the horizon; on a light theme it is the paper going toward white.
   */
  vec3 ink = mix(uSurface * 0.16, mix(uSurface, vec3(0.05, 0.08, 0.09), 0.86), lightTheme);
  /* Nearly all the way to the glow on a dark theme. A silhouette needs
     something bright to be a silhouette against, and on Eclipse every token in
     play is dark: at 0.62 the horizon landed on a mid-dark teal, the canopy
     was drawn 0.17 of the way from ink toward THAT, and the whole forest sat
     inside a few units of the page background. */
  vec3 lit = mix(mix(uSurface, uGlow, 0.92), mix(uSurface, vec3(1.0), 0.30), lightTheme);
  /* The top of the sky is a WHISPER away from the page surface — 0.10, not
     the 0.35 this started at. That first value filled the entire upper
     viewport with a saturated teal, which is both the wrong picture (a sky is
     darkest overhead, not brightest) and the wrong place to put it: the upper
     two thirds of every section is where the text is. */
  vec3 tint = mix(mix(uSurface, uAccent, 0.10), mix(uSurface, uAccent, 0.05), lightTheme);

  /* ── Sky ────────────────────────────────────────────────────────────────
     Deep overhead, bright only in a band at the horizon. The horizon IS the
     light source, and everything below it is a silhouette against it — which
     is the entire reason the layers read as depth rather than as stacked
     shapes.

     The cube on the ramp is what keeps the glow near the ground: linear, the
     lift was still 45 % of the way to full brightness at mid-screen; cubed it
     is 7 %, and the page above the treeline stays the theme's own surface. */
  float sky = smoothstep(0.92, waterY, p.y);
  vec3 col = mix(tint, lit, pow(sky, 3.0) * 0.72);
  float sunX = 0.5 + sin(v * 0.8) * 0.55;
  float sunGlow = exp(-9.0 * distance(p, vec2(sunX, waterY + 0.13)));
  col = mix(col, lit, sunGlow * 0.50);

  /* ── Far ridges, hazing toward the sky with distance ────────────────────
     Aerial perspective: the further layer sits closer to the sky's lightness,
     the nearer one closer to ink. Two ridges is enough to say "distance". */
  float r1 = ridge(p, waterY + 0.26, 0.090, 1.5, phase);
  float r2 = ridge(p, waterY + 0.16, 0.065, 2.4, phase + 2.1);
  col = mix(col, depthRamp(ink, lit, 0.30 - haze * 0.09, 0.62 + haze * 0.20), r1);
  col = mix(col, depthRamp(ink, lit, 0.18 - haze * 0.06, 0.44 + haze * 0.16), r2);

  /* ── Three tree lines, each nearer, darker and swaying harder ───────────
     Parallax comes from scaling x per layer: the far line moves a third as
     far as the near one for the same scroll, which is depth for one multiply. */
  float far  = treeLine(vec2(p.x * 0.55, p.y), t, density * 1.9, waterY + 0.075, canopyH * 0.55, 0.004);
  float mid  = treeLine(vec2(p.x * 0.80, p.y), t, density * 1.25, waterY + 0.040, canopyH * 0.80, 0.008);
  float near = treeLine(p, t, density, waterY - 0.010, canopyH, 0.014);

  /* 4C.1 / 4C.2 -- THREE-point ramps with real aerial perspective.
   *
   * Every depth in this scene used to be 'mix(ink, lit, k)': a straight line
   * between two colours. That is what produces the plasticky midtone that
   * reads as "cartoon" -- in a real scene the shadowed end of a ramp is
   * COOLER than a neutral interpolation and the lit end is WARMER, because
   * shadows are lit by the sky and highlights by the sun.
   *
   * 4C.2 -- and the haze is wavelength-dependent. Rayleigh scattering is
   * stronger at short wavelengths, so distant things do not merely lose
   * contrast, they go BLUE. Applying the haze more to blue than to red is two
   * extra multiplies and it is most of what makes distance read as distance
   * rather than as fog. */
  vec3 treeFar  = depthRamp(ink, lit, 0.17, 0.30 + haze * 0.22);
  vec3 treeMid  = depthRamp(ink, lit, 0.085, 0.14 + haze * 0.12);
  vec3 treeNear = depthRamp(ink, lit, 0.0, 0.0);
  col = mix(col, treeFar, far);
  col = mix(col, treeMid, mid);

  /* ── Water: the scene above the bank, mirrored and rippled ──────────────
     Only the canopy is re-evaluated for the reflection, not the whole scene.
     A perfect mirror would cost a second full pass for something the ripple
     is about to smear anyway. */
  if (p.y < waterY) {
    float depth = waterY - p.y;
    float ripple = sin((p.x * 22.0) + t * 1.4 + depth * 30.0) * 0.004 * (0.35 + depth * 3.0);
    vec2 mirrored = vec2(p.x + ripple, waterY + depth * 0.85);
    float rTree = treeLine(vec2(mirrored.x * 0.80, mirrored.y), t, density * 1.25,
                           waterY + 0.040, canopyH * 0.80, 0.008);
    float rRidge = ridge(mirrored, waterY + 0.13, 0.055, 2.4, phase + 2.1);
    /* The water reads a shade darker than the sky it mirrors — a reflection
       that is as bright as its source looks like a hole, not a surface. */
    vec3 water = mix(ink, lit, 0.30);
    water = mix(water, mix(ink, lit, 0.16), rRidge * 0.6);
    water = mix(water, treeMid, rTree * 0.55);
    /* Specular glints on the crests, brightest under the horizon glow. */
    float glint = smoothstep(0.9, 1.0, sin(p.x * 30.0 + t * 1.1 + sin(p.y * 40.0)));
    water = mix(water, lit, glint * 0.16 * (1.0 - depth * 2.2));
    col = mix(col, water, smoothstep(0.0, 0.012, depth));
  }

  /* ── Wildlife, on the near bank only ────────────────────────────────────
     Guarded by a y-compare: above the bank this whole block is one comparison
     and the animals cost nothing on ~80 % of the screen. */
  if (p.y < waterY + 0.16) {
    float groundY = waterY - 0.005;
    /* The deer crosses left to right; the elephant walks the other way,
       further back and slower, which is the parallax cue that separates
       them without needing a second depth layer. */
    float deerX = fract(t * 0.045 + variant * 0.13) * 1.9 - 0.45;
    float deerLift = abs(sin(t * 2.6)) * 0.006;
    float deer = deerMask(p - vec2(deerX, groundY + deerLift), t * 5.2, 0.085);

    float eleX = 1.55 - fract(t * 0.018 + variant * 0.07) * 1.9;
    float ele = elephantMask(p - vec2(eleX, groundY + 0.030), t * 1.7, 0.075);

    /* The elephant sits between the mid and near tree lines, so it is drawn
       a shade lighter than the deer — depth by tone, for one mix. */
    col = mix(col, mix(ink, lit, 0.10), ele);
    col = mix(col, ink, deer);
  }

  /* The near tree line is painted AFTER the animals, so they walk behind the
     closest trunks — the single cheapest thing that turns four layers into a
     space with a front and a back. */
  col = mix(col, treeNear, near);

  /* ── Birds ──────────────────────────────────────────────────────────────
     Banded, like the animals. The flock occupies a 0.2-unit strip; without
     the guard these three mask evaluations (six segment distances) ran for
     every pixel on the screen including the whole sky above them, which is
     most of the frame. */
  if (p.y > waterY + 0.28 && p.y < waterY + 0.50) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float bx = fract(t * (0.030 + fi * 0.004) + fi * 0.37) * 1.9 - 0.45;
      float by = waterY + 0.34 + fi * 0.055 + sin(t * 0.7 + fi * 2.1) * 0.022;
      float b = birdMask(p - vec2(bx, by), t * 5.5 + fi * 1.9, 0.020);
      col = mix(col, mix(ink, lit, 0.06), b * 0.7);
    }
  }

  /* ── Motes: pollen by day, fireflies at night. Four hashed drifters. ────
     Same reasoning — they drift in a band above the bank, so the four exp()
     falloffs are charged to that band rather than to the whole viewport. */
  if (p.y > waterY && p.y < waterY + 0.44) {
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 mp = vec2(
        fract(hash1(fi * 3.1) + t * (0.006 + fi * 0.002)) * 1.9 - 0.45,
        waterY + 0.06 + hash1(fi * 7.7) * 0.34 + sin(t * 0.5 + fi) * 0.03
      );
      float m = exp(-900.0 * dot(p - mp, p - mp));
      col = mix(col, lit, m * (0.35 + 0.3 * sin(t * 1.7 + fi * 2.2)));
    }
  }

  return col;
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
  /* Surface luminance decides every light/dark polarity in this shader — the
     vignette below, and the forest's silhouette inks. Derived rather than
     passed in, so it lerps with the palette during a theme sweep instead of
     snapping a frame early. */
  float lum = dot(uSurface, vec3(0.299, 0.587, 0.114));
  float lightTheme = smoothstep(0.32, 0.58, lum);

  /*
   * The motif is evaluated ONLY in motif mode.
   *
   * This was the lag. 'motif()' ran unconditionally at the top of main and the
   * forest ran afterwards inside its own branch, so the forest scene — the
   * default — was paying for a full motif evaluation (two of them mid-scroll,
   * during a crossfade) and then throwing the result away. Two complete
   * backdrops per pixel, per frame, to draw one.
   *
   * 'uScene' is uniform across the draw, so this branch is coherent: every
   * pixel takes the same side and the GPU genuinely skips the work.
   */
  vec2 mo = vec2(0.0);
  if (uScene > 0.5 && uScene < 1.5) {
  mo = motif(int(uMotifA + 0.5), p, t);
  /* Only pay for the second motif while a crossfade is actually running.
     The branch is on a uniform, so it is coherent across the whole draw — every
     pixel takes the same path and the GPU genuinely skips the work rather than
     executing both sides and throwing one away. Parked in a section, which is
     where a reader spends nearly all their time, this shader costs exactly what
     the single-motif version did. */
  if (uBlend > 0.002) {
    mo = mix(mo, motif(int(uMotifB + 0.5), p, t), uBlend);
  }
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
   *
   * D-38 — the non-hero floor was 0.42, and multiplied by tier 2's 0.75
   * intensity that left every section past the hero at ~0.32 of full. Eleven
   * motifs were being drawn and none of them could be made out; the reported
   * version of this is "I only see the different backgrounds after I change
   * something in the terminal", because raising the tier by hand was the only
   * way to get them above the noise floor. 0.62 is still a wash — the
   * contrast check in scripts/check-contrast.mjs covers the text that sits
   * over it — and it is a wash you can actually see the shape of.
   */
  float heroness = 1.0 - smoothstep(0.0, 1.4, uSection);
  float energy = uIntensity * (0.62 + heroness * 0.40);

  float field = n * energy + bloom * 0.16 * uIntensity
              + ripple * 0.30 * uIntensity;

  vec3 col = mix(uSurface, uAccent, clamp(field, 0.0, 1.0));
  /* mo.y is each motif's own idea of "hot core" — the lit edge of a cloud,
     the node of the net, the rim of the halo — so the glow lands on the part
     of the pattern that is actually the light, not merely on the brightest
     noise. */
  col = mix(col, uGlow, clamp(mo.y * energy * 0.7 + bloom * 0.10 + ripple * 0.45, 0.0, 1.0));

  /* ── Scene select ───────────────────────────────────────────────────────
     'calm' keeps the wash and drops the motif entirely: the field becomes the
     smooth theme gradient plus the pointer bloom, which is the version that
     is never in the way of a paragraph. 'forest' replaces the composite
     outright — it is a scene, not a pattern, so it owns its own colour. */
  if (uScene < 0.5) {
    float wash = 0.5 + 0.5 * fbm2(vec2(p.x * 0.7, p.y * 0.7 - t * 0.02));
    col = mix(uSurface, mix(uSurface, uAccent, 0.42), wash * energy * 0.55);
    col = mix(col, uGlow, bloom * 0.10 + ripple * 0.40);
  } else if (uScene > 1.5) {
    vec3 scene = forest(p, t, uSection, lightTheme);
    /* The pointer still touches it — the bloom lifts the canopy where the
       cursor is, and a tap still rings — but at a third of the motif version's
       strength, because a forest already has somewhere for the eye to go. */
    scene = mix(scene, uGlow, clamp(bloom * 0.06 + ripple * 0.22, 0.0, 1.0));
    /*
     * Against uSurface, NOT against the motif composite.
     *
     * Blending toward 'col' left (1 - uIntensity) of the motif underneath —
     * 10 % at tier 2 — and 10 % of a contour-line motif over a forest whose
     * upper half is nearly flat surface colour is not a subtle artifact, it is
     * clearly visible topology lines in the sky. The tier's intensity should
     * scale how far the SCENE departs from the page surface, which is what it
     * means everywhere else in this shader.
     */
    col = mix(uSurface, scene, clamp(uIntensity, 0.0, 1.0));
  }

  /* Vignette keeps the centre readable and hides the quad's edges.
   *
   * D-48 -- it has to know which way "recede" points.
   *
   * A plain multiply is a DARKENING vignette, and it was written against
   * Eclipse, where darker IS further away. Applied to Paper it multiplies a
   * cream surface toward grey, so the light theme got a muddy ring instead of
   * a horizon -- one of the two reasons the field read as "only works in
   * Eclipse". The other was the 0.55 opacity override, now gone from
   * index.css.
   *
   * The polarity is derived from the surface itself rather than passed in as a
   * uniform, so it cannot fall out of step with the palette mid-sweep: a light
   * surface recedes toward white, a dark one toward black, and the sweep
   * between two themes crosses smoothly because lum is lerped along with
   * everything else.
   *
   * NOTE: no backticks anywhere in this file's shader source. It is a JS
   * template literal, and a backtick in a GLSL comment ends the string. */
  vec2 d = vUv - 0.5;
  float vig = dot(d, d) * 0.85;
  col = mix(col * (1.0 - vig), col + vig * 0.55, lightTheme);

  /* 4C.4 -- grain, here rather than as a DOM layer over the whole page.
   *
   * This replaces '.film-grain': a fixed, full-viewport element at z-index
   * 9998 carrying an SVG feTurbulence data-URI and 'will-change: transform',
   * i.e. a permanently promoted composited layer sitting on top of every
   * heading, button and link on the site, re-composited every frame.
   *
   * Three lines here do the same job better, for two reasons. It costs no
   * layer and no re-composite -- it is part of a fragment the GPU is already
   * shading. And it is in the RIGHT PLACE: grain belongs to a rendered image,
   * and what actually needed dithering was this shader's own smooth gradients,
   * which is where 8-bit banding shows. The UI never needed it.
   *
   * Scaled by the surface luminance so the light theme gets less of it -- the
   * same amplitude that breaks up a dark gradient is visible speckle on cream. */
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime * 0.35) * 43758.5453);
  col += (grain - 0.5) * mix(0.020, 0.008, lightTheme);

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
  for (const name of ['uResolution', 'uTime', 'uMouse', 'uScrollVel', 'uSection', 'uMotifA', 'uMotifB', 'uBlend', 'uSurface', 'uAccent', 'uGlow', 'uIntensity', 'uRipple', 'uScene']) {
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

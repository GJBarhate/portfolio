/**
 * MoonForestClock — the corner diorama clock.
 *
 * A crescent moon holding a floating island: pines, a deer running the ridge,
 * an elephant walking the far bank, a flock of birds, a sun that crosses the
 * sky on the device's own clock — and, in front of all of it, a real analogue
 * dial whose three hands tell the actual time.
 *
 * It is mounted once from `App`, not from a section, so it is genuinely
 * persistent: it does not scroll away, it does not remount, and it survives
 * every route the palette can navigate to.
 *
 * ── Why this is raw three.js and not React Three Fiber ────────────────────
 *
 * The brief asked for R3F + drei + postprocessing. Three reasons it is not:
 *
 *   1. `lib/glStage.js` exists because browsers cap live WebGL contexts and
 *      this site once ran nine of them, silently losing the oldest. R3F brings
 *      its own renderer and its own reconciler; that is a second owner of the
 *      thing the repo deliberately gave one owner.
 *   2. `scripts/check-budgets.mjs` is a build gate. R3F + drei +
 *      postprocessing is roughly a quarter-megabyte gzipped.
 *   3. This component exists partly to REPLACE the corner watch, which was
 *      measured (CDP profile, `texSubImage2D` at 11.7 % of all samples) as the
 *      single largest main-thread cost on the page. Fixing a performance
 *      complaint by adding a second reconciler driving a per-frame render loop
 *      would be pulling in the wrong direction.
 *
 * Everything the brief asks for is here; only the plumbing differs.
 *
 * ── The cost model, which is the part that matters ────────────────────────
 *
 * The watch this replaces re-drew a 1024x1024 canvas every 90 ms and
 * re-uploaded it as a texture: ~4 MB per upload, ~11 Hz. Here:
 *
 *   sky texture     512x512, redrawn ONLY when the time-of-day bucket changes
 *                   (four times a day), never on a timer
 *   dial texture    512x512, drawn exactly once (numerals and ticks never move)
 *   glow sprite     128x128, drawn once
 *   geometry        every mesh is flat quads and triangles built by hand; no
 *                   Shape, no ExtrudeGeometry, no loader, no GLTF
 *   frame loop      the ordinary `ambient` band — NOT `critical`. This is
 *                   decoration and it is throttleable like all decoration.
 *
 * ── Layer order, back to front ────────────────────────────────────────────
 *
 *   z -3.0  crescent moon silhouette + starfield inside the crescent
 *   z -2.4  clock-face disc (dusk gradient sky, from the sky texture)
 *   z -2.0  far ridge, elephant, birds            ┐ the diorama group, which
 *   z -1.4  the floating island and its underside │ is the only thing that
 *   z -1.0  pines, deer, water                    ┘ carries the fixed lean
 *   z  0.4  ticks + numerals (STATIC — see below)
 *   z  0.5  hour / minute / second hands
 *
 * The dial group is a sibling of the diorama group and never receives the
 * lean, because the brief is explicit that the numerals stay upright and
 * readable while only the hands move. A tilted scene under a fixed dial is
 * also what sells the depth — see P3.1 below for why that lean is now a
 * mount-time constant rather than something the pointer ever moved.
 */
import { useEffect, useRef } from 'react'
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'
import { makeEnvironment, srgb } from '../../lib/filmGrade.js'
import { onFrame, getTier, prefersReducedMotion } from '../../lib/raf.js'
import { createAnchoredRenderer } from '../../lib/glStage.js'
import { onPalette } from '../../lib/palette.js'
import { trackCost } from '../../lib/perfHud.js'

/** The dial's radius in world units. Everything is built inside it. */
const R = 1.0

// ── Geometry helpers ───────────────────────────────────────────────────────
//
// All hand-rolled. Each returns a BufferGeometry with explicit positions and
// normals facing +z: the whole diorama is layered flat shapes viewed nearly
// face-on, which is exactly the papercraft read the brief asks for, and it
// means no triangulator and no extra three modules enter the bundle.

function geoFrom(positions, normals, uvs) {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  if (uvs) g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  return g
}

/**
 * Give a hand-built geometry a planar UV set, mapping the square that bounds
 * a `radius`-sized shape onto 0..1.
 *
 * Needed because nothing here comes from a three primitive, so nothing here
 * has UVs — and a `map` on a geometry with no `uv` attribute samples texel
 * (0,0) for every fragment, i.e. renders as one flat colour. That is a silent
 * failure rather than an error, which is why it is worth naming.
 */
function withPlanarUV(geometry, radius) {
  const pos = geometry.getAttribute('position')
  const uv = new Float32Array((pos.count) * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) / (radius * 2)) + 0.5
    // Canvas textures are top-down and GL is bottom-up.
    uv[i * 2 + 1] = (pos.getY(i) / (radius * 2)) + 0.5
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  return geometry
}

/** A flat quad. `ax`/`ay` place the origin: (0,0) centres it, (0,-0.5) puts the
 *  pivot at the bottom edge, which is what a leg rotating about a hip needs. */
function quadGeo(w, h, ax = 0, ay = 0) {
  const x0 = -w / 2 - ax * w
  const x1 = w / 2 - ax * w
  const y0 = -h / 2 - ay * h
  const y1 = h / 2 - ay * h
  const p = [x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0]
  const n = []
  for (let i = 0; i < 6; i++) n.push(0, 0, 1)
  const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]
  return geoFrom(p, n, uv)
}

/** A triangle from three 2-D points. */
function triGeo(a, b, c) {
  return geoFrom(
    [a[0], a[1], 0, b[0], b[1], 0, c[0], c[1], 0],
    [0, 0, 1, 0, 0, 1, 0, 0, 1]
  )
}

/** A filled disc, as a triangle fan. */
function discGeo(radius, segments = 64) {
  const p = []
  const n = []
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    p.push(0, 0, 0, Math.cos(a0) * radius, Math.sin(a0) * radius, 0, Math.cos(a1) * radius, Math.sin(a1) * radius, 0)
    n.push(0, 0, 1, 0, 0, 1, 0, 0, 1)
  }
  return geoFrom(p, n)
}

/**
 * The crescent.
 *
 * Two circles: an outer one of radius `radius`, and an inner one of the same
 * radius pushed right by `offset` that bites the moon's face out of it. For
 * each angular step the outer point is kept, and the inner edge is the point
 * on the offset circle at the same angle — clamped so the two edges never
 * cross, which is what would otherwise fold the strip inside out at the horns.
 */
function crescentGeo(radius, offset, segments = 96) {
  const p = []
  const n = []
  const inner = (a) => {
    // Where the ray at angle `a` leaves the offset circle: the positive root
    // of |a_hat * r - centre|^2 = radius^2, which is the standard ray/circle
    // intersection with the ray's origin inside the circle.
    const b = Math.cos(a) * offset
    const disc = b * b - (offset * offset - radius * radius)
    if (disc <= 0) return radius
    return Math.min(radius, Math.max(0, b + Math.sqrt(disc)))
  }
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const i0 = inner(a0)
    const i1 = inner(a1)
    if (i0 >= radius - 1e-4 && i1 >= radius - 1e-4) continue
    const o0x = Math.cos(a0) * radius
    const o0y = Math.sin(a0) * radius
    const o1x = Math.cos(a1) * radius
    const o1y = Math.sin(a1) * radius
    const n0x = Math.cos(a0) * i0
    const n0y = Math.sin(a0) * i0
    const n1x = Math.cos(a1) * i1
    const n1y = Math.sin(a1) * i1
    p.push(n0x, n0y, 0, o0x, o0y, 0, o1x, o1y, 0)
    p.push(n0x, n0y, 0, o1x, o1y, 0, n1x, n1y, 0)
    for (let k = 0; k < 6; k++) n.push(0, 0, 1)
  }
  return geoFrom(p, n)
}

/**
 * A landform silhouette, clipped to the dial's circle.
 *
 * `profile(x)` gives the skyline height at `x`. The band runs from `baseY` up
 * to that height — but every column is also clamped to the circle, because a
 * mountain range that runs past the edge of a round dial reads as a bug rather
 * than as a landscape. `sqrt(R^2 - x^2)` is the chord, so the clamp is exact
 * rather than a mask.
 */
/**
 * An arbitrary outline, as a triangle fan from its own centroid.
 *
 * The animals used to be assembled from `quadGeo` rectangles and `triGeo`
 * triangles — a box body, a box neck, a box head, two triangle antlers, four
 * box legs. At 260px that reads as a pictogram, not an animal, and it is the
 * "shape is not real" complaint: a real deer silhouette is a continuous
 * outline with an arched back, a deep chest and a tapering rump, and none of
 * those survive being built out of axis-aligned rectangles.
 *
 * A centroid fan is enough here and an ear-clipping triangulator is not
 * needed, because every outline below is authored star-shaped about its own
 * centre — which is also what keeps the silhouettes readable at this size.
 *
 * @param {[number, number][]} pts outline, counter-clockwise, in world units
 */
function polyGeo(pts) {
  let cx = 0
  let cy = 0
  for (const [x, y] of pts) { cx += x; cy += y }
  cx /= pts.length
  cy /= pts.length

  const positions = []
  const normals = []
  const uvs = []
  const push = (x, y) => {
    positions.push(x, y, 0)
    normals.push(0, 0, 1)
    uvs.push(x, y)
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    push(cx, cy)
    push(a[0], a[1])
    push(b[0], b[1])
  }
  return geoFrom(positions, normals, uvs)
}

/** A tapered limb segment: wide at the hip, narrow at the hoof. */
function limbGeo(topWidth, bottomWidth, length) {
  return polyGeo([
    [-topWidth / 2, 0],
    [topWidth / 2, 0],
    [bottomWidth / 2, -length],
    [-bottomWidth / 2, -length],
  ])
}

function ridgeGeo(profile, baseY, x0 = -R, x1 = R, steps = 80, clipRadius = R) {
  const p = []
  const n = []
  // `baseY` may be a constant (a landform sitting on a floor) or a second
  // profile (a thin band following the first, which is how the lit rim along
  // the island's skyline is built).
  const base = typeof baseY === 'function' ? baseY : () => baseY
  const colTop = (x) => {
    const lim = clipRadius * clipRadius - x * x
    if (lim <= 0) return null
    return Math.min(profile(x), Math.sqrt(lim))
  }
  const colBottom = (x) => {
    const lim = clipRadius * clipRadius - x * x
    if (lim <= 0) return null
    return Math.max(base(x), -Math.sqrt(lim))
  }
  for (let i = 0; i < steps; i++) {
    const xa = x0 + ((x1 - x0) * i) / steps
    const xb = x0 + ((x1 - x0) * (i + 1)) / steps
    const ta = colTop(xa)
    const tb = colTop(xb)
    const ba = colBottom(xa)
    const bb = colBottom(xb)
    if (ta === null || tb === null || ba === null || bb === null) continue
    if (ta <= ba || tb <= bb) continue
    p.push(xa, ba, 0, xb, bb, 0, xb, tb, 0)
    p.push(xa, ba, 0, xb, tb, 0, xa, ta, 0)
    for (let k = 0; k < 6; k++) n.push(0, 0, 1)
  }
  return geoFrom(p, n)
}

/** A dauphine-style hand: a wedge pointing at 12, pivoting about the origin. */
function handGeo(blade, tail, length) {
  return geoFrom(
    [0, length, 0, -blade, -tail, 0, blade, -tail, 0],
    [0, 0, 1, 0, 0, 1, 0, 0, 1]
  )
}

// ── Time ───────────────────────────────────────────────────────────────────

/**
 * Which of the four looks the scene is wearing.
 *
 * The brief asks for "dawn pink -> day gold -> dusk amber -> night indigo",
 * driven by the real clock. The bucket is what the sky texture is keyed on, so
 * it must be cheap to compare and must change rarely — four times a day, which
 * is why the texture redraw is free rather than a treadmill.
 */
function bucketFor(hours) {
  if (hours >= 5 && hours < 8) return 'dawn'
  if (hours >= 8 && hours < 17) return 'day'
  if (hours >= 17 && hours < 20) return 'dusk'
  return 'night'
}

/*
 * The four looks.
 *
 * Deliberately deeper than a literal sky would be, `day` most of all. This is
 * a 260px disc sitting over a dark page, and a photographically-correct blue
 * noon renders as a pale washed hole punched in the layout — measured on the
 * first pass, where the daylight bucket left the ivory hands invisible against
 * their own sky. Every bucket therefore keeps a dark canopy at the top and
 * spends its light near the horizon, which is also what gives the ridges their
 * rim and the hands something to sit against at every hour.
 */
const SKY = {
  dawn:  { top: '#141a3c', mid: '#463a68', low: '#a86a84', horizon: '#f0a878' },
  day:   { top: '#12385e', mid: '#2f6a91', low: '#6ba8bf', horizon: '#e8cf9a' },
  dusk:  { top: '#121435', mid: '#3f2850', low: '#964d55', horizon: '#f0a05a' },
  night: { top: '#050916', mid: '#0c162f', low: '#152444', horizon: '#33496b' },
}

/*
 * P3.2(a) — a real palette, not two inks.
 *
 * `inkFor()` fed the SAME colour to the far ridge and the island, which is
 * why the whole landmass read as one flat silhouette. Each layer gets its
 * own hue here, still keyed on the bucket: `far` is the mountain (was
 * `SKY.ink`), `ridge` tints the hazy far pine line, `island` is the
 * floating island (was also `SKY.ink`), `grass` tints the near pine line,
 * `water` recolours the sea, and `rim` drives both the shoreline and the
 * new backlight in 3.2(g). Zero per-frame cost: same materials, different
 * `.color` values, applied once at mount and again on every bucket change.
 */
const SCENE = {
  dawn:  { far: '#4a3f63', ridge: '#3a3252', island: '#2b2440', grass: '#3d4a35', water: '#4a5f7a', rim: '#ffb894' },
  day:   { far: '#4a6b82', ridge: '#35566b', island: '#264150', grass: '#3f5c38', water: '#3d6f8a', rim: '#ffe0a8' },
  dusk:  { far: '#3d2f4a', ridge: '#2d2238', island: '#1f1828', grass: '#2a3026', water: '#3a3d5c', rim: '#ff9d5c' },
  night: { far: '#1a2438', ridge: '#131b2b', island: '#0d131f', grass: '#121a16', water: '#16233d', rim: '#7fa8d8' },
}

/** Sun/moon position on its arc, and how far through the daylight it is. */
function arcPosition(hours) {
  const day = hours >= 6 && hours < 18
  const p = day ? (hours - 6) / 12 : ((hours < 6 ? hours + 6 : hours - 18) / 12)
  const x = -Math.cos(Math.PI * p) * R * 0.72
  const y = -0.06 + Math.sin(Math.PI * p) * R * 0.62
  return { x, y, day, p }
}

// ── Canvas textures ────────────────────────────────────────────────────────

/** The sky behind the island: a vertical gradient plus stars, at 512. */
function makeSkyTexture() {
  const S = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace

  const rand = (seed) => {
    const v = Math.sin(seed * 12.9898) * 43758.5453
    return v - Math.floor(v)
  }

  const draw = (bucket) => {
    const sky = SKY[bucket]
    ctx.clearRect(0, 0, S, S)
    const g = ctx.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, sky.top)
    g.addColorStop(0.42, sky.mid)
    g.addColorStop(0.74, sky.low)
    g.addColorStop(1, sky.horizon)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)

    // Stars, and only where they would actually be seen: dense at night,
    // a scatter at dawn and dusk, none at all in daylight.
    const count = bucket === 'night' ? 90 : bucket === 'day' ? 0 : 26
    for (let i = 0; i < count; i++) {
      const x = rand(i * 1.7) * S
      const y = rand(i * 3.1 + 9) * S * 0.6
      const a = 0.25 + rand(i * 5.3) * 0.6
      ctx.fillStyle = `rgba(233, 240, 255, ${a})`
      ctx.beginPath()
      ctx.arc(x, y, 0.6 + rand(i * 7.7) * 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    tex.needsUpdate = true
  }

  return { tex, draw, dispose: () => tex.dispose() }
}

/**
 * The dial: hour ticks and numerals, drawn once onto a transparent 512 canvas.
 *
 * Drawn rather than modelled on purpose. Sixty tick meshes and twelve text
 * meshes would need a font module and would cost seventy draw calls for
 * something that never moves; one transparent plane in front of the diorama
 * costs one, stays perfectly crisp, and — because it is a sibling of the
 * tilting group — cannot be knocked out of true by the parallax.
 */
function makeDialTexture(accentHex) {
  const S = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const c = S / 2

  const draw = (accent) => {
    ctx.clearRect(0, 0, S, S)

    // Minute track: 60 ticks, every fifth one long and bright.
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2
      const major = i % 5 === 0
      const outer = c * 0.94
      const inner = outer - (major ? c * 0.075 : c * 0.032)
      ctx.strokeStyle = major
        ? 'rgba(255, 248, 232, 0.92)'
        : 'rgba(255, 248, 232, 0.34)'
      ctx.lineWidth = major ? 3.2 : 1.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner)
      ctx.lineTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer)
      ctx.stroke()
    }

    // The cardinal numerals only — 12, 3, 6, 9. A 260px widget cannot carry
    // twelve legible numbers, and four is what a dress dial uses anyway.
    ctx.fillStyle = 'rgba(255, 250, 238, 0.94)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round(S * 0.085)}px "Clash Display", "Space Grotesk", ui-sans-serif, sans-serif`
    const rad = c * 0.79
    const marks = [['12', -Math.PI / 2], ['3', 0], ['6', Math.PI / 2], ['9', Math.PI]]
    for (const [label, a] of marks) {
      ctx.fillText(label, c + Math.cos(a) * rad, c + Math.sin(a) * rad + 1)
    }

    // A hairline bezel so the disc has an edge to end on, in the theme accent.
    ctx.strokeStyle = accent
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(c, c, c - 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1

    tex.needsUpdate = true
  }

  draw(accentHex)
  return { tex, draw, dispose: () => tex.dispose() }
}

/** A soft radial glow, used for the sun/moon corona. 128 is plenty for a blur. */
function makeGlowTexture() {
  const S = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.30)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

// ── Creatures ──────────────────────────────────────────────────────────────

/**
 * The deer, as a papercut silhouette with a real four-leg gait.
 *
 * Legs are quads whose pivot is at the hip (`ay = -0.5`), so `rotation.z` is a
 * swing rather than a slide. Front and back on each side run in antiphase and
 * the two sides are half a cycle apart, which is the trot every quadruped
 * silhouette is read as.
 */
/**
 * A red deer, in profile.
 *
 * Built as ONE continuous outline plus jointed legs, rather than as six
 * rectangles. The shapes that make a deer recognisable at 30 pixels, in order
 * of how much each one carries:
 *
 *   1. the LINE OF THE BACK — level over the shoulder, dipping behind it,
 *      rising again at the rump. A straight back reads as a dog.
 *   2. the DEEP CHEST dropping well below the belly line, and a belly that
 *      tucks up sharply toward the flank.
 *   3. the NECK leaving the chest at ~45 degrees and thickening downward.
 *   4. the WEDGE HEAD with a distinct muzzle, not a box.
 *   5. the ANTLERS branching FORWARD from a backward-swept beam.
 *
 * Legs are two segments with a real knee, which is what makes the gait read
 * as an animal running rather than as four sticks pivoting at the hip.
 */
function makeDeer(material, antlerMaterial) {
  const g = new Group()

  // Torso: back line, rump, tail root, belly tuck, deep chest, shoulder.
  const torso = new Mesh(polyGeo([
    [-0.062, 0.014],  // rump, top
    [-0.030, 0.028],  // croup
    [0.006, 0.022],   // dip behind the shoulder
    [0.038, 0.032],   // withers / shoulder high point
    [0.060, 0.020],   // base of the neck
    [0.058, -0.006],  // brisket, front
    [0.030, -0.026],  // deep chest, lowest point
    [0.004, -0.018],  // belly
    [-0.028, -0.020], // flank, tucked up
    [-0.058, -0.008], // hind quarter
  ]), material)
  g.add(torso)

  // Neck — a taper, thick at the chest and slim at the throat.
  const neck = new Mesh(polyGeo([
    [-0.016, 0], [0.016, 0], [0.011, 0.052], [-0.013, 0.052],
  ]), material)
  neck.position.set(0.052, 0.016, 0)
  neck.rotation.z = -0.44
  g.add(neck)

  // Head: a wedge with a muzzle, and one ear.
  const head = new Mesh(polyGeo([
    [-0.014, -0.010], [0.006, -0.014], [0.030, -0.009],
    [0.034, -0.002], [0.008, 0.008], [-0.014, 0.010],
  ]), material)
  head.position.set(0.086, 0.062, 0)
  head.rotation.z = -0.18
  const ear = new Mesh(polyGeo([[0, 0], [0.006, 0.016], [-0.008, 0.013]]), material)
  ear.position.set(0.080, 0.070, 0)
  g.add(head, ear)

  /*
   * Antlers: a beam sweeping BACK, with tines branching FORWARD off it. That
   * direction is the whole read — tines drawn backward look like horns, and
   * horns look like a goat. Slightly lighter material so they separate from
   * the head instead of merging into one blob.
   */
  const antler = (flip) => {
    const a = new Group()
    const beam = new Mesh(limbGeo(0.006, 0.003, 0.040), antlerMaterial)
    beam.rotation.z = flip * 0.30
    a.add(beam)
    for (const [at, len, ang] of [[0.014, 0.016, 1.15], [0.026, 0.014, 0.85], [0.036, 0.011, 0.55]]) {
      const tine = new Mesh(limbGeo(0.004, 0.002, len), antlerMaterial)
      tine.position.set(flip * at * 0.35, -at + 0.040, 0)
      tine.rotation.z = flip * ang
      a.add(tine)
    }
    a.position.set(0.084 + flip * 0.004, 0.074, 0)
    return a
  }
  g.add(antler(1), antler(-0.55))

  // Tail — short, held up.
  const tail = new Mesh(polyGeo([[0, 0], [-0.016, 0.012], [-0.013, -0.008]]), material)
  tail.position.set(-0.060, 0.016, 0)
  g.add(tail)

  /*
   * Four jointed legs. Upper segment pivots at the hip, lower at the knee,
   * and the knee trails the hip by a quarter cycle — which is what a real
   * gait does and what a single rigid stick cannot express.
   */
  const legs = []
  const hips = [
    { x: -0.046, y: -0.014, phase: 0 },            // near hind
    { x: -0.034, y: -0.016, phase: Math.PI },      // far hind
    { x: 0.030, y: -0.020, phase: Math.PI },       // near fore
    { x: 0.044, y: -0.016, phase: 0 },             // far fore
  ]
  for (const hip of hips) {
    const upper = new Group()
    upper.position.set(hip.x, hip.y, 0)
    const thigh = new Mesh(limbGeo(0.013, 0.008, 0.032), material)
    upper.add(thigh)
    const lower = new Group()
    lower.position.set(0, -0.032, 0)
    const shank = new Mesh(limbGeo(0.007, 0.004, 0.030), material)
    lower.add(shank)
    upper.add(lower)
    g.add(upper)
    legs.push({ upper, lower, phase: hip.phase })
  }

  return {
    group: g,
    /** @param {number} t seconds */
    step(t) {
      const w = (t / 1.05) * Math.PI * 2
      for (const leg of legs) {
        leg.upper.rotation.z = Math.sin(w + leg.phase) * 0.58
        // The knee only ever folds one way, so the lower segment is clamped
        // to negative rotation — a leg that bends forward reads as broken.
        leg.lower.rotation.z = -Math.max(0, Math.sin(w + leg.phase + Math.PI / 2)) * 0.75
      }
    },
    bob: (t) => Math.abs(Math.sin((t / 1.05) * Math.PI * 2)) * 0.009,
  }
}

/** The elephant: heavier, slower, further back, and walking the other way. */
/**
 * An Asian elephant, in profile.
 *
 * The four cues that make an elephant unmistakable at this size, and which a
 * rectangle body cannot give you:
 *
 *   1. the DOMED BACK — a single high arch, highest over the shoulder, not a
 *      flat line. This alone separates it from every other large animal.
 *   2. the HEAD carried high with a domed forehead, no visible neck.
 *   3. the TRUNK — a tapering curve, segmented so it can sway. A straight
 *      trunk reads as a tusk and ruins the whole silhouette.
 *   4. the EAR — a large rounded fan overlapping the shoulder.
 *
 * Legs are columns, not tapers: an elephant's leg is famously the same width
 * top to bottom, and drawing it tapered makes it read as a horse.
 */
function makeElephant(material, tuskMaterial) {
  const g = new Group()

  const body = new Mesh(polyGeo([
    [-0.084, 0.010],  // rump
    [-0.052, 0.040],  // the dome begins
    [-0.010, 0.056],  // highest point, over the shoulder
    [0.034, 0.050],   // shoulder falling to the head
    [0.062, 0.030],   // brow
    [0.066, 0.000],   // face
    [0.048, -0.026],  // chest
    [0.004, -0.034],  // belly
    [-0.046, -0.032], // hind belly
    [-0.080, -0.014], // hind quarter
  ]), material)
  g.add(body)

  // Ear — a rounded fan, slightly proud of the body so it reads as separate.
  const ear = new Mesh(polyGeo([
    [0, 0.020], [0.020, 0.012], [0.026, -0.012],
    [0.014, -0.030], [-0.006, -0.026], [-0.014, -0.004],
  ]), material)
  ear.position.set(0.030, 0.016, 0.004)
  g.add(ear)

  // Trunk — four tapering segments, hung from the brow and swayed in `step`.
  const trunk = []
  let parent = g
  const widths = [0.017, 0.014, 0.011, 0.008]
  for (let i = 0; i < 4; i++) {
    const seg = new Group()
    seg.position.set(i === 0 ? 0.062 : 0, i === 0 ? 0.004 : -0.020, 0)
    const mesh = new Mesh(limbGeo(widths[i], widths[i] * 0.8, 0.021), material)
    seg.add(mesh)
    parent.add(seg)
    parent = seg
    trunk.push(seg)
  }

  // One visible tusk, curving forward and up.
  const tusk = new Mesh(polyGeo([
    [0, 0], [0.026, -0.008], [0.030, -0.014], [0.002, -0.008],
  ]), tuskMaterial)
  tusk.position.set(0.050, -0.006, 0.005)
  g.add(tusk)

  const tail = new Mesh(limbGeo(0.006, 0.003, 0.034), material)
  tail.position.set(-0.082, 0.006, 0)
  tail.rotation.z = 0.18
  g.add(tail)

  // Columnar legs — same width top and bottom, which is the elephant tell.
  const legs = []
  for (const [x, phase] of [[-0.060, 0], [-0.044, Math.PI], [0.026, Math.PI], [0.042, 0]]) {
    const leg = new Group()
    leg.position.set(x, -0.026, 0)
    leg.add(new Mesh(limbGeo(0.019, 0.017, 0.050), material))
    g.add(leg)
    legs.push({ leg, phase })
  }

  return {
    group: g,
    step(t) {
      // Slow — an elephant's stride is roughly a third of a deer's.
      const w = (t / 3.1) * Math.PI * 2
      for (const l of legs) l.leg.rotation.z = Math.sin(w + l.phase) * 0.22
      // The trunk sways as a chain, each segment lagging the one above it.
      for (let i = 0; i < trunk.length; i++) {
        trunk[i].rotation.z = Math.sin(t * 0.9 - i * 0.55) * (0.10 + i * 0.05)
      }
    },
    bob: (t) => Math.abs(Math.sin((t / 3.1) * Math.PI * 2)) * 0.004,
  }
}

/** One bird: two swept quads meeting at a shoulder, so it reads as a V. */
/**
 * A bird in flight, seen from below and behind.
 *
 * Two swept wings and a slim body. The wing is a CURVE, not a triangle: the
 * leading edge bulges forward at the shoulder and sweeps back to a pointed
 * tip, which is the shape the eye reads as a bird rather than as a paper dart.
 * The flap rotates each wing about the shoulder, and the two halves are
 * mirrored so the silhouette stays symmetrical at every point in the cycle.
 */
function makeBird(material) {
  const g = new Group()

  const body = new Mesh(polyGeo([
    [-0.013, 0], [-0.004, 0.004], [0.010, 0.003], [0.014, 0],
    [0.010, -0.003], [-0.004, -0.004],
  ]), material)
  g.add(body)

  const wingOutline = [
    [0, 0.002],
    [0.006, 0.006],
    [0.001, 0.019],
    [-0.012, 0.028],
    [-0.026, 0.026],
    [-0.014, 0.012],
    [-0.005, 0.004],
  ]
  const left = new Mesh(polyGeo(wingOutline), material)
  const right = new Mesh(polyGeo(wingOutline.map(([x, y]) => [x, -y])), material)
  g.add(left, right)

  return {
    group: g,
    /** @param {number} t seconds @param {number} offset per-bird phase */
    flap(t, offset) {
      const w = Math.sin(t * 5.4 + offset)
      left.rotation.x = w * 0.9
      right.rotation.x = -w * 0.9
    },
  }
}


// ── The component ──────────────────────────────────────────────────────────

/**
 * The WebGL diorama. `Clock.jsx` decides whether to ask for this at all — by
 * the time this module is even fetched, the answer is already yes.
 */
export default function MoonForestClock() {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    /*
     * MEASURED REVERSAL — the Phase-4 additions that cost the most per frame
     * for the least at this size are gone.
     *
     * Profiling the production build showed 15.4 s of blocked main thread with
     * WebGL on and 4.1 s with it off, and the worst single freeze falling from
     * 2.6 s to 0.35 s. Three of those costs were mine, added for realism:
     *
     *   antialias: true   MSAA on every frame of a live canvas
     *   shadowMap         a second depth pass over the whole scene
     *   crystal           `transmission: 1` makes three.js allocate a
     *                     transmission render target and compile a much
     *                     heavier shader — the single most expensive material
     *                     feature available
     *
     * At a 260px dial the shadow is a few pixels of soft gradient and the MSAA
     * is fighting a `devicePixelRatio` that already supersamples. The crystal
     * was genuinely the best-looking addition and it is also the most
     * expensive; it goes with the others, because a clock that stutters is not
     * realistic, whatever its materials are doing.
     *
     * The parts of Phase 4 that cost nothing per frame — linear colour, AgX,
     * the environment map, real metal on the hands and bezel — all stay.
     */
    const { renderer, dispose, warmUp } = createAnchoredRenderer(host)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getTier() >= 3 ? 1.5 : 1.0))

    const scene = new Scene()
    /*
     * Orthographic, deliberately.
     *
     * A perspective camera makes a layered diorama a sizing problem: the sky
     * disc at z -2.4 and the dial at z +0.4 are three units apart, so under
     * any usable field of view they project at noticeably different scales and
     * every layer needs its own compensating factor. Under an orthographic
     * projection a radius of 1 is a radius of 1 at every depth, so the shapes
     * are authored in dial units and simply line up.
     *
     * Parallax survives the change, which is the part worth checking: leaning
     * the diorama group still slides each layer sideways by z*sin(theta), so
     * the near pines and the far ridge still separate under the fixed lean —
     * the depth cue comes from the rotation, not from the projection.
     */
    const camera = new OrthographicCamera(-1.06, 1.06, 1.06, -1.06, 0.1, 100)
    camera.position.set(0, 0, 10)

    /*
     * 4A.4 / 4B — real light, not near-flat light.
     *
     * The old comment here read: "Near-flat lighting: these are papercut
     * layers, not solids, so the light exists to give the island and the hands
     * an edge, not to model form." That was an accurate description of a
     * deliberate choice, and it is the choice the brief asks to reverse.
     *
     * `makeEnvironment` has existed in `filmGrade.js` the whole time — a 32×16
     * procedural room with a key window, an accent lamp and a horizon — and was
     * imported by exactly two components. The clock was not one of them, which
     * is why nothing on it had anything to reflect.
     */
    let accent = srgb('#3ac6c9')
    let environment = makeEnvironment(accent)
    scene.environment = environment

    // Ambient drops from 1.55 to 0.55: with an environment map doing the fill,
    // the old value was washing every surface flat before the key could shape
    // anything. High ambient is how you make a scene look like a sticker.
    scene.add(new AmbientLight(0xffffff, 0.55))
    const key = new DirectionalLight(0xffe9c4, 2.1)
    key.position.set(-2, 3, 4)
    scene.add(key)

    // ── Textures ──────────────────────────────────────────────────────────
    const sky = makeSkyTexture()
    const dial = makeDialTexture('#3ac6c9')
    const glowTex = makeGlowTexture()

    let bucket = bucketFor(new Date().getHours())
    sky.draw(bucket)

    /*
     * P3.2(g) — one rim light, from behind-left, tinted to the bucket.
     *
     * `key` above is a front light; this is its opposite, catching the
     * animals' backs and the pines' edges from behind the diorama. One more
     * light, no shadow map, no second render target — just a second
     * DirectionalLight, whose colour is updated alongside every other
     * bucket-keyed material below.
     */
    const rim = new DirectionalLight(srgb(SCENE[bucket].rim), 0.6)
    rim.position.set(-1.5, 1, -4)
    scene.add(rim)

    const disposables = []
    const track = (x) => { disposables.push(x); return x }

    /*
     * The dial and everything inside it live in one group scaled to 0.80.
     *
     * The reference composition is a crescent CRADLING the face, so the
     * crescent has to be the outermost thing on screen and the face has to be
     * smaller than the frustum. Authoring every shape against a radius of 1
     * and then shrinking the world once is what keeps the island, the pines
     * and the ridge clipping arithmetic in the same units as the dial —
     * rescaling forty literals by hand is how a diorama drifts out of register.
     */
    const world = new Group()
    world.scale.setScalar(0.80)
    scene.add(world)

    // ── Layer 0 — the crescent, outside the dial, and its backlight ───────
    const moonGroup = new Group()
    moonGroup.position.z = -3
    // P3.1 — the same fixed lean as the diorama, at 0.4x (matching the old
    // hover tilt's own ratio between the two groups). `.rotation.z` is left
    // alone: the slow crescent drift below is the only thing that still
    // writes to it, every frame, on purpose.
    moonGroup.rotation.x = 0.022
    moonGroup.rotation.y = -0.017
    // Warm, and brighter than a silhouette: this is the light source the whole
    // composition is lit by, so it reads as backlight rather than as a shape.
    // 4B.2 — the crescent IS the key light of the composition, so it has to
    // have an edge. `MeshBasicMaterial` ignores lights by definition, which
    // made the brightest object on screen the one with no shading at all.
    const crescentMat = track(new MeshStandardMaterial({
      color: srgb('#ffe3b4'),
      emissive: srgb('#ffdca0'),
      emissiveIntensity: 0.55,
      roughness: 0.62,
      metalness: 0,
      transparent: true,
      opacity: 0.94,
    }))
    const crescent = new Mesh(track(crescentGeo(1.045, 0.30, 128)), crescentMat)
    moonGroup.add(crescent)
    // The rim glow the brief asks for. A soft radial sprite behind the
    // crescent is cheaper than a bloom pass and, at 260px, indistinguishable
    // from one — an UnrealBloomPass here would be a second render target and a
    // pair of blur passes for a halo that is nine pixels wide.
    const haloMat = track(new MeshBasicMaterial({
      map: glowTex, transparent: true, opacity: 0.30, depthWrite: false,
    }))
    const halo = new Mesh(track(quadGeo(2.5, 2.5)), haloMat)
    halo.position.z = -3.1
    moonGroup.add(halo)
    scene.add(moonGroup)

    // ── Layer 1 — the face disc ───────────────────────────────────────────
    //
    // A disc, not a quad. The sky is a square texture and the dial is round,
    // so a quad would show four corners of sky outside the bezel. The fan
    // carries no UVs, which is fine here: the gradient runs vertically, so the
    // texture is sampled by object-space position in the only axis that
    // matters and the horizon lands where the geometry says it does.
    const faceMat = track(new MeshBasicMaterial({ map: sky.tex }))
    const faceGeo = track(discGeo(R, 96))
    withPlanarUV(faceGeo, R)
    const faceDisc = new Mesh(faceGeo, faceMat)
    faceDisc.position.z = -2.4
    world.add(faceDisc)

    // ── The diorama — a fixed lean, not a tracked one ──────────────────────
    const diorama = new Group()
    world.add(diorama)
    /*
     * P3.1 — a CONSTANT lean, not a hover-tracked one.
     *
     * The old hover tilt was doing real work: rotating the diorama slid each
     * layer sideways by z*sin(theta), which is what separated the near pines
     * from the far ridge. Deleting the tracking entirely would have flattened
     * the scene along with the pointer listener. Keeping the rotation as a
     * fixed constant keeps every bit of that layer separation and costs
     * nothing per frame — a constant needs no damper, no pointer listener and
     * no per-frame write, and the dial never moves under the cursor again.
     */
    diorama.rotation.x = 0.056
    diorama.rotation.y = -0.042

    // Far ridge
    // 4B.2 — `flatShading: true, roughness: 1` is a specific instruction to
    // look like folded paper. Smooth, and slightly less than fully rough, so
    // the ridge catches a sheen along its top edge like a real hillside.
    const farMat = track(new MeshStandardMaterial({ color: srgb(SCENE[bucket].far), flatShading: false, roughness: 0.88, metalness: 0 }))
    farMat.color.lerp(srgb('#ffffff'), 0.22)
    // Kept low on purpose. At the first pass this peaked around +0.10 and the
    // resulting mountain filled the upper half of the dial, hid the sun's arc
    // and left the island looking like foreground clutter in front of it. A
    // backdrop that outranks the subject is not a backdrop.
    //
    // P3.2(e) — a third, higher-frequency term with an `abs()` gives the
    // ridgeline teeth instead of a smooth wave. Its own peak (0.045) is small
    // enough that the ceiling above still holds: -0.28+0.15+0.06+0.045 =
    // -0.025, still comfortably below the dial's centreline.
    const farProfile = (x) =>
      -0.28
      + 0.15 * Math.sin(x * 3.1 + 0.7)
      + 0.06 * Math.sin(x * 7.3)
      + 0.045 * Math.abs(Math.sin(x * 5.7 + 1.9))
    const farRidge = new Mesh(track(ridgeGeo(farProfile, -R, -R, R, 72)), farMat)
    farRidge.position.z = -2.0
    // The same rim, dimmer and further away — atmospheric perspective done
    // with one extra strip rather than with a fog uniform.
    const farRimMat = track(new MeshBasicMaterial({
      color: srgb('#ffc998'), transparent: true, opacity: 0.34,
    }))
    const farRim = new Mesh(
      track(ridgeGeo(farProfile, (x) => farProfile(x) - 0.022, -R, R, 72, R)),
      farRimMat
    )
    farRim.position.z = -1.99
    /*
     * P3.2(e) — a snow cap on the teeth. `snowBase` collapses onto
     * `farProfile` itself below the threshold, which makes `ridgeGeo` skip
     * that column entirely (its own `ta <= ba` guard) rather than needing a
     * second clipping mechanism — the same trick the island's rim band uses
     * to follow an irregular profile.
     */
    const snowMat = track(new MeshBasicMaterial({ color: srgb('#e8eef5'), transparent: true, opacity: 0.7 }))
    const snowThreshold = -0.24
    const snowBase = (x) => (farProfile(x) > snowThreshold ? farProfile(x) - 0.018 : farProfile(x))
    const snowCap = new Mesh(track(ridgeGeo(farProfile, snowBase, -R, R, 72, R)), snowMat)
    snowCap.position.z = -1.995
    diorama.add(farRidge, farRim, snowCap)

    // The floating island: a ridge on top, tapering to a point underneath —
    // the "slice of land" the brief describes.
    const islandMat = track(new MeshStandardMaterial({ color: srgb(SCENE[bucket].island), flatShading: false, roughness: 0.85, metalness: 0 }))
    const islandTop = -0.30
    const islandProfile = (x) => islandTop + 0.055 * Math.sin(x * 5.2 + 1.4) + 0.03 * Math.sin(x * 11 + 0.2)
    const island = new Mesh(
      track(ridgeGeo(islandProfile, -0.46, -0.62, 0.62, 56, R)),
      islandMat
    )
    island.position.z = -1.4
    const keel = new Mesh(track(triGeo([-0.60, -0.455], [0.60, -0.455], [-0.02, -0.80])), islandMat)
    keel.position.z = -1.4
    /*
     * The lit rim along the skyline — a 0.012-unit band following the island's
     * own profile.
     *
     * This is the single line that turns the island from a black bar into a
     * landform. Without it every layer is the same flat ink and the eye reads
     * one silhouette; with it the top edge catches the crescent's backlight
     * and the island separates from the ridge behind it. It is also why
     * `ridgeGeo` now takes a function for its floor.
     */
    // 0.03, not 0.012. At 260 px inside a world scaled to 0.80 a 0.012 band is
    // roughly one physical pixel — present in the buffer and invisible on the
    // screen, which is the same as absent.
    const rimMat = track(new MeshBasicMaterial({ color: srgb('#ffd0a0'), transparent: true, opacity: 0.7 }))
    const islandRim = new Mesh(
      track(ridgeGeo(islandProfile, (x) => islandProfile(x) - 0.030, -0.62, 0.62, 56, R)),
      rimMat
    )
    islandRim.position.z = -1.39
    diorama.add(island, keel, islandRim)

    // Water beneath the island, with the horizon reading through it.
    /*
     * Water that reflects the sky, WITHOUT transmission.
     *
     * `transmission` on any material in the scene makes three.js allocate a
     * transmission render target and render the scene twice — so the water
     * was costing the same second pass the crystal was, for a 40px strip. A
     * smooth, low-roughness metal-free dielectric still picks up the crescent,
     * the sun and the horizon from the environment map and still moves them as
     * the diorama tilts, which is the whole effect. It is the reflection that
     * reads as water, not the refraction.
     */
    const waterMat = track(new MeshPhysicalMaterial({
      color: srgb(SCENE[bucket].water),
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
      envMapIntensity: 1.6,
    }))
    const water = new Mesh(track(ridgeGeo(() => -0.62, -R, -R, R, 48)), waterMat)
    water.position.z = -1.9
    /*
     * P3.2(f) — a shoreline and a moon path.
     *
     * The shoreline is a thin bright band at the water's own top edge — real
     * water always has a bright rim where it meets land. The moon path is the
     * single most recognisable water cue there is: a vertical glow strip under
     * the sun/moon, additively blended so it reads as light ON the water
     * rather than as a second object floating in front of it.
     */
    const shoreMat = track(new MeshBasicMaterial({ color: srgb(SCENE[bucket].rim), transparent: true, opacity: 0.5 }))
    const shoreline = new Mesh(track(ridgeGeo(() => -0.62, () => -0.626, -R, R, 48, R)), shoreMat)
    shoreline.position.z = -1.898
    const moonPathMat = track(new MeshBasicMaterial({
      map: glowTex, transparent: true, opacity: 0.25, depthWrite: false, blending: AdditiveBlending,
    }))
    const moonPath = new Mesh(track(quadGeo(0.10, 0.30)), moonPathMat)
    moonPath.position.set(0, -0.77, -1.897)
    diorama.add(water, shoreline, moonPath)

    // Pines along the island, in two depths.
    // P3.2(b) — two greens on the near line, alternated by index, so the tree
    // line is not one silhouette. `pineMat2` is `pineMat` lifted toward white
    // rather than an unrelated colour, so both stay obviously the same species
    // under every bucket.
    const pineMat = track(new MeshLambertMaterial({ color: srgb(SCENE[bucket].grass) }))
    const pineMat2 = track(new MeshLambertMaterial({ color: srgb(SCENE[bucket].grass) }))
    pineMat2.color.lerp(srgb('#ffffff'), 0.14)
    const pineFarMat = track(new MeshLambertMaterial({ color: srgb(SCENE[bucket].ridge), transparent: true, opacity: 0.75 }))
    const trunkMat = track(new MeshLambertMaterial({ color: srgb('#3a2a1c') }))
    const pineGeos = []
    /*
     * P3.2(b) — trunks, gated to `getTier() >= 2`.
     *
     * A trunk below each pine grounds it — without one the triangle floats.
     * It costs one extra mesh per pine (9 near + 7 far = 16 draw calls), which
     * is the plan's own budget line for this item, so tier 1 keeps the plain
     * 3-triangle pine rather than eating that cost on the machines least able
     * to afford it.
     */
    const addPine = (x, y, h, mat, z) => {
      for (let i = 0; i < 3; i++) {
        const w = h * 0.38 * (1 - i / 3.3)
        const yy = y + (i / 3) * h
        const g = triGeo([x, yy + h / 2.6], [x - w, yy], [x + w, yy])
        pineGeos.push(g)
        const m = new Mesh(g, mat)
        m.position.z = z
        diorama.add(m)
      }
      if (getTier() >= 2) {
        const trunkGeo = limbGeo(0.006, 0.008, h * 0.25)
        pineGeos.push(trunkGeo)
        const trunk = new Mesh(trunkGeo, trunkMat)
        // A hair further back than the foliage, so the triangle's own base
        // hides the seam rather than the trunk poking out in front of it.
        trunk.position.set(x, y, z - 0.01)
        diorama.add(trunk)
      }
    }
    const prand = (s) => { const v = Math.sin(s * 12.9898) * 43758.5453; return v - Math.floor(v) }
    for (let i = 0; i < 9; i++) {
      const x = -0.52 + i * 0.13 + prand(i * 3.1) * 0.04
      const mat = prand(i * 6.6) > 0.5 ? pineMat : pineMat2
      addPine(x, islandTop - 0.02, 0.075 + prand(i * 5.7) * 0.05, mat, -1.0)
    }
    for (let i = 0; i < 7; i++) {
      const x = -0.62 + i * 0.19 + prand(i * 9.3) * 0.05
      addPine(x, -0.12, 0.055 + prand(i * 4.1) * 0.035, pineFarMat, -2.02)
    }

    // ── Sun / moon and its corona ─────────────────────────────────────────
    const bodyMat = track(new MeshBasicMaterial({ color: srgb('#fff3d4') }))
    const sunBody = new Mesh(track(discGeo(0.062, 28)), bodyMat)
    sunBody.position.z = -2.2
    const glowMat = track(new MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.55, depthWrite: false }))
    const sunGlow = new Mesh(track(quadGeo(0.44, 0.44)), glowMat)
    sunGlow.position.z = -2.25
    diorama.add(sunBody, sunGlow)

    // ── Creatures ─────────────────────────────────────────────────────────
    /*
 * REAL COLOURS, and the reasoning matters because the first pass got it wrong.
 *
 * These were near-black inks (#0a1c14 deer, #14303f elephant) chosen to read
 * as silhouettes against a bright horizon. That is defensible for a paper-cut
 * scene and it is not what was asked for: at any hour except dusk the animals
 * were black cut-outs with no species in them.
 *
 * So they get their actual coats — a red deer is a warm russet-brown, an
 * Asian elephant is a cool mid-grey — and the SCENE is allowed to darken them.
 * Because the key light is behind and above (the crescent), a lit surface
 * still falls away to a dark rim at dusk, so the silhouette read survives at
 * the hours it should and the animal is legible at the hours it should not be
 * a shadow.
 *
 * Antlers and tusks are separate, lighter materials: keratin and ivory are
 * genuinely paler than hide, and without the separation both read as one blob.
 */
const deerMat = track(new MeshLambertMaterial({ color: srgb('#6b4526') }))
    const antlerMat = track(new MeshLambertMaterial({ color: srgb('#a08a63') }))
    const deer = makeDeer(deerMat, antlerMat)
    deer.group.position.z = -0.98
    deer.group.scale.setScalar(0.92)
    diorama.add(deer.group)

    const elephantMat = track(new MeshLambertMaterial({ color: srgb('#6f737b'), transparent: true, opacity: 0.92 }))
    const tuskMat = track(new MeshLambertMaterial({ color: srgb('#d8cfb4') }))
    const elephant = makeElephant(elephantMat, tuskMat)
    elephant.group.position.z = -2.01
    elephant.group.scale.setScalar(0.62)
    diorama.add(elephant.group)

    /*
     * P3.2(c) — ground contact shadows.
     *
     * The single highest realism-per-byte change in the file: a shadow is
     * what tells the eye an object is ON a surface rather than floating IN
     * FRONT of it. Both animals currently only ever move in `x` and bob in
     * `y` about a fixed ground line, so each shadow only ever needs its own
     * `x` written per frame — one flattened disc each, sharing one material.
     */
    const shadowMat = track(new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.40, depthWrite: false }))
    const deerShadow = new Mesh(track(discGeo(0.05, 12)), shadowMat)
    deerShadow.scale.set(1, 0.22, 1)
    deerShadow.position.set(0, islandTop + 0.05, deer.group.position.z + 0.001)
    diorama.add(deerShadow)
    const elephantShadow = new Mesh(track(discGeo(0.08, 12)), shadowMat)
    elephantShadow.scale.set(1, 0.22, 1)
    elephantShadow.position.set(0, -0.058, elephant.group.position.z + 0.001)
    diorama.add(elephantShadow)

    // 4B.2 — Lambert, not Physical. Full PBR on a 12-pixel bird is wasted
    // silicon; what these need is for the key light to separate near from far,
    // and a diffuse term does exactly that for almost nothing.
    const birdMat = track(new MeshLambertMaterial({ color: srgb('#243447'), transparent: true, opacity: 0.85 }))
    const birds = []
    for (let i = 0; i < 4; i++) {
      const b = makeBird(birdMat)
      b.group.position.z = -1.95
      b.group.scale.setScalar(0.8 + (i % 2) * 0.25)
      diorama.add(b.group)
      // P3.2(d) — the lane/speed/offset on the LEAD (i === 0) is what the
      // whole flock's y and flap now derive from; followers keep their own
      // `offset` only so their x-crossing still staggers, not their y.
      birds.push({ ...b, offset: i * 1.7, lane: 0.30 + i * 0.055, speed: 0.055 + i * 0.006 })
    }

    // ── The dial: static, never tilted ────────────────────────────────────
    const dialGroup = new Group()
    world.add(dialGroup)
    /*
     * 4B.2 — the dial plate is a real surface now.
     *
     * The canvas stays exactly as it was and becomes a `map` on a physical
     * material rather than the entire appearance of a `MeshBasicMaterial`. The
     * difference is that the plate can now catch the key light across its face
     * — which, on a slightly rough dielectric, is the sunburst brushing that is
     * the defining texture of a real dial. Painted onto a flat colour it was
     * simply a picture of a dial.
     */
    const dialMat = track(new MeshPhysicalMaterial({
      map: dial.tex,
      transparent: true,
      depthWrite: false,
      roughness: 0.42,
      metalness: 0.15,
      envMapIntensity: 0.8,
    }))
    const dialPlane = new Mesh(track(quadGeo(R * 2, R * 2)), dialMat)
    dialPlane.position.z = 0.4
    dialGroup.add(dialPlane)

    /*
     * 4B.2 — a REAL bezel, not a painted one.
     *
     * The ring around the dial used to be drawn into the dial texture. A
     * painted bezel has no highlight: it cannot catch the key light, and it
     * cannot move when the widget tilts. A torus of actual geometry does both,
     * and the travelling highlight along its top edge is one of the strongest
     * "this is an object" cues available for two hundred triangles.
     */
    const bezelMat = track(new MeshPhysicalMaterial({
      color: srgb('#c9ccd2'),
      metalness: 1,
      roughness: 0.15,
      envMapIntensity: 1.6,
    }))
    const bezel = new Mesh(track(new TorusGeometry(R * 0.99, 0.022, 12, 96)), bezelMat)
    bezel.position.z = 0.42
    dialGroup.add(bezel)

    const handMat = track(new MeshPhysicalMaterial({
      /*
       * Polished steel with a lacquer sheen — the single most "real watch" cue
       * available. Was `roughness 0.35, metalness 0.1, flatShading: true`,
       * i.e. a faceted off-white plastic.
       */
      color: srgb('#e8e6df'),
      metalness: 1,
      roughness: 0.18,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.5,
    }))
    const secondMat = track(new MeshPhysicalMaterial({
      /*
       * The emissive is GONE, and that is the point of this line.
       *
       * An emissive metal is a contradiction — metal does not glow, it
       * reflects — and a glowing hand is precisely what made the dial read as
       * a toy rather than as an instrument. The accent survives as a tint on a
       * real metal, which under the environment map still catches the eye
       * because it is the brightest specular on the dial, not because it is
       * lit from inside.
       */
      color: accent.clone(),
      metalness: 1,
      roughness: 0.25,
      envMapIntensity: 1.6,
    }))
    /*
     * Each hand is two meshes: a dark one very slightly larger, and the ivory
     * one on top of it.
     *
     * The sky behind the hands runs from near-black at midnight to a pale
     * amber horizon at dusk, and a single ivory wedge disappears against the
     * bright half of that range — measured on the first pass, where the hands
     * were invisible over the daylight sky. An outline costs two extra
     * triangles each and makes them legible against every hour of the day,
     * which for the one element that has to be readable is the correct trade.
     */
    const outlineMat = track(new MeshBasicMaterial({
      color: srgb('#0b1018'), transparent: true, opacity: 0.55,
    }))
    const hourOutline = new Mesh(track(handGeo(0.040, 0.030, 0.415)), outlineMat)
    hourOutline.position.z = 0.45
    const minuteOutline = new Mesh(track(handGeo(0.032, 0.034, 0.635)), outlineMat)
    minuteOutline.position.z = 0.47
    const hourHand = new Mesh(track(handGeo(0.030, 0.022, 0.40)), handMat)
    hourHand.position.z = 0.46
    const minuteHand = new Mesh(track(handGeo(0.022, 0.026, 0.62)), handMat)
    minuteHand.position.z = 0.48
    dialGroup.add(hourOutline, minuteOutline)
    const secondHand = new Mesh(track(handGeo(0.008, 0.14, 0.74)), secondMat)
    secondHand.position.z = 0.50
    const pivot = new Mesh(track(discGeo(0.032, 20)), secondMat)
    pivot.position.z = 0.52
    dialGroup.add(hourHand, minuteHand, secondHand, pivot)

    /*
     * The crystal (`transmission: 1`, `ior: 1.52`) was here and is removed —
     * see the reversal note at the top of this effect. Transmission is the
     * most expensive material feature in three.js: it forces a separate
     * render target and a much larger shader, every frame, for a refraction
     * that is a few pixels wide at 260px.
     */

    // ── Theme ─────────────────────────────────────────────────────────────
    const stopPalette = onPalette((p) => {
      accent = srgb(p.accent)
      secondMat.color.copy(accent)
      dial.draw(p.accent)
      /*
       * The environment is NOT regenerated here any more.
       *
       * It was rebuilt on every theme change so the accent lamp inside it
       * carried the theme colour. That is a 32×16 texture plus a full material
       * recompile across the scene, on the main thread, in the middle of a
       * view transition — and the visible difference is a tint on the far side
       * of two metal objects. Built once at mount; the accent still drives the
       * second hand, the dial texture and the site's own palette.
       */
    })

    // ── Motion / pointer ──────────────────────────────────────────────────
    let reduced = prefersReducedMotion()
    const onMotionChange = () => { reduced = prefersReducedMotion() }
    document.documentElement.addEventListener('forge:motion-changed', onMotionChange)
    secondHand.visible = !reduced

    // ── Fit ───────────────────────────────────────────────────────────────
    const fit = () => {
      const r = host.getBoundingClientRect()
      const w = Math.max(1, r.width)
      const h = Math.max(1, r.height)
      // The box is square by design, but a stylesheet is not a contract:
      // widen the frustum on the long axis so the dial stays circular even if
      // something downstream gives this a non-square rectangle.
      const a = w / h
      const half = 1.06
      camera.left = a >= 1 ? -half * a : -half
      camera.right = a >= 1 ? half * a : half
      camera.top = a >= 1 ? half : half / a
      camera.bottom = a >= 1 ? -half : -half / a
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(host)
    fit()

    // ── The loop, split in two ────────────────────────────────────────────
    //
    // D-6 — "it lags a lot", and it did: measurably ~10 fps.
    //
    // Everything used to run in ONE `ambient` subscriber, which stacked three
    // independent throttles on the hands:
    //
    //   1. `ambient` is the first band dropped when a frame exceeds
    //      FRAME_BUDGET_MS (24 ms);
    //   2. the per-callback cost governor throttles any callback averaging
    //      > 8 ms to 1-in-2, then 1-in-3, then 1-in-4 frames — and a WebGL
    //      render with ~40 draw calls crosses 8 ms on contended hardware
    //      routinely;
    //   3. the whole ambient band pauses on `window.blur`.
    //
    // Composed with the internal 30 fps gate below, a 1-in-3 divisor gives
    // ~10 fps. A background field at 10 fps is a shimmer nobody notices; a
    // SECOND HAND at 10 fps is a visibly broken watch. `raf.js` already had the
    // `critical` band with exactly this justification written above it — the
    // clock had simply never been added to it.
    //
    // So: hands are `critical` (three rotation writes and one small scissor
    // render, < 0.3 ms), and the diorama — wind, deer, elephant, birds, moon
    // drift — stays `ambient` and stays throttleable. Nobody has ever noticed
    // a deer skipping.
    let t = 0
    let frame = 0
    /*
     * TWO rates, because the two halves have different tolerances.
     *
     * The diorama keeps 30 fps: the deer's gait is a 1.2 s loop and nobody can
     * tell. The hands run at the display's rate, because the whole point of
     * splitting them out is that a dropped frame there is legible as a defect.
     */
    const DIORAMA_FRAME_MS = 1000 / 30
    let lastDraw = 0

    /*
     * P3.8 — stop allocating a Date every frame.
     *
     * `new Date()` ran on every single frame to read the seconds. At the
     * display's refresh rate that is 60–120 allocations a second, on the one
     * subscriber that is now exempt from every throttle, for a value that can
     * be derived arithmetically. One anchor Date is captured here and
     * re-anchored every 60 s so the widget still follows a system clock change
     * or a DST shift.
     */
    let anchorMs = Date.now()
    let anchorPerf = performance.now()
    const clockNow = (frameNow) => {
      const elapsed = frameNow - anchorPerf
      if (elapsed > 60_000) {
        anchorMs = Date.now()
        anchorPerf = frameNow
        return anchorMs
      }
      return anchorMs + elapsed
    }
    /** Shared by both subscribers: is there anything on screen to draw into? */
    const drawable = () => {
      /*
       * NOT `offsetParent === null`, which is the obvious way to write this
       * and is wrong here: the spec says `offsetParent` is null for any
       * `position: fixed` element, so that test is unconditionally true for
       * this component and the scene never rendered at all. `checkVisibility`
       * answers the question that was actually being asked; the rect is the
       * fallback for engines that do not have it yet.
       */
      if (document.hidden) return false
      return host.checkVisibility
        ? host.checkVisibility()
        : host.getBoundingClientRect().width >= 1
    }

    /*
     * 30 fps, on the `critical` band.
     *
     * D-6 was never "30 fps is too slow" — it was that the ONE subscriber sat
     * in `ambient`, where three independent throttles stacked (the frame-budget
     * skip, the 1-in-2/3/4 cost governor, and the blur pause) and composed with
     * the internal 30 fps gate to give ~10 fps. Ten is a broken watch; thirty
     * is a watch.
     *
     * Splitting the bands fixed the throttling and I also raised the render to
     * the display rate, which doubled the cost of the most expensive thing on
     * the page for a difference nobody can see on a second hand. Measured, that
     * showed up as the clock rendering its entire scene — diorama, dial, hands,
     * environment — 60 times a second when only three `rotation.z` values had
     * changed.
     *
     * So: `critical` (never throttled, never paused, never skipped) at a
     * deliberate 30 fps. Smooth, and half the work.
     */
    const HAND_FRAME_MS = 1000 / 30
    let lastHandDraw = 0

    /*
     * Link the shaders before the first frame, not during it.
     *
     * This scene has ~13 materials and an environment map; compiling them all
     * inside the first `render()` is a single blocking task on the main
     * thread at exactly the moment the visitor is trying to scroll. Warming up
     * asynchronously moves that work off the critical path — the widget fades
     * in a frame or two later instead of freezing the page.
     */
    let warm = false
    warmUp(scene, camera).then(() => { warm = true })

    // ── Subscriber 1: THE HANDS. `critical` — never throttled, capped at 30. ──
    const stopHands = onFrame((frameNow) => {
      if (!warm || !drawable()) return
      if (lastHandDraw && frameNow - lastHandDraw < HAND_FRAME_MS) return
      lastHandDraw = frameNow
      const started = performance.now()

      const now = new Date(clockNow(frameNow))
      const s = now.getSeconds() + now.getMilliseconds() / 1000
      const m = now.getMinutes() + s / 60
      const h = (now.getHours() % 12) + m / 60
      secondHand.rotation.z = -(s / 60) * Math.PI * 2
      minuteHand.rotation.z = -(m / 60) * Math.PI * 2
      hourHand.rotation.z = -(h / 12) * Math.PI * 2
      minuteOutline.rotation.z = minuteHand.rotation.z
      hourOutline.rotation.z = hourHand.rotation.z

      renderer.render(scene, camera)

      // P3.10 — the clock reports its own frame cost, so the Phase-4 material
      // budget (<= 4 ms at tier 3, <= 1.5 ms at tier 2) is a measurement
      // rather than a hope. `?perf=1` displays the p95.
      trackCost('moon-forest-clock', performance.now() - started)
    }, { critical: true })

    // ── Subscriber 2: THE DIORAMA. `ambient`, 30 fps, throttleable. ─────────
    const stopDiorama = onFrame((frameNow, dtMs) => {
      if (!drawable()) return

      /*
       * Gate on the frame TIMESTAMP, not on an accumulator.
       *
       * An accumulator has to answer "how much time has this draw actually
       * covered", and the obvious `sinceDraw %= FRAME_MS` loses the carry, so
       * the animation advances by one raf delta while two have elapsed and the
       * deer runs at half speed on a 60 Hz display. The timestamp difference
       * is the elapsed time by construction.
       */
      const sinceDraw = lastDraw ? frameNow - lastDraw : dtMs
      if (sinceDraw < DIORAMA_FRAME_MS) return
      lastDraw = frameNow

      // Clamped so a tab restored after minutes does not teleport the deer.
      const dt = Math.min(sinceDraw / 1000, 0.1)
      t += reduced ? 0 : dt
      frame++

      const now = new Date(clockNow(frameNow))

      // ── Time of day, on a lazy cadence. Four changes a day; there is no
      //    reason to ask more often than every 30th frame. ───────────────
      if (frame % 30 === 0) {
        const next = bucketFor(now.getHours())
        if (next !== bucket) {
          bucket = next
          sky.draw(bucket)
          const scene4 = SCENE[bucket]
          islandMat.color.copy(srgb(scene4.island))
          farMat.color.copy(srgb(scene4.far)).lerp(srgb('#ffffff'), 0.22)
          // P3.2(a)/(b)/(f)/(g) — every other bucket-keyed layer, in one place.
          pineMat.color.copy(srgb(scene4.grass))
          pineMat2.color.copy(srgb(scene4.grass)).lerp(srgb('#ffffff'), 0.14)
          pineFarMat.color.copy(srgb(scene4.ridge))
          waterMat.color.copy(srgb(scene4.water))
          shoreMat.color.copy(srgb(scene4.rim))
          rim.color.copy(srgb(scene4.rim))
        }
        const arc = arcPosition(now.getHours() + now.getMinutes() / 60)
        sunBody.position.x = arc.x
        sunBody.position.y = arc.y
        sunGlow.position.x = arc.x
        sunGlow.position.y = arc.y
        moonPath.position.x = arc.x
        bodyMat.color.set(arc.day ? '#fff3d4' : '#dfe8ff')
        glowMat.opacity = arc.day ? 0.6 : 0.34
      }

      if (!reduced) {
        // Deer: left to right across the island, looping at the edges.
        const dp = ((t * 0.13) % 1)
        deer.group.position.x = -0.60 + dp * 1.2
        deer.group.position.y = islandTop + 0.052 + deer.bob(t)
        deer.step(t)
        // P3.2(c) — the shadow tracks the animal's x, never its bob: a
        // contact shadow that bobbed with its owner would read as the
        // ground moving, not the animal.
        deerShadow.position.x = deer.group.position.x

        // Elephant: the other way, slower, and further back.
        const ep = ((t * 0.045) % 1)
        elephant.group.position.x = 0.66 - ep * 1.32
        elephant.group.position.y = -0.055 + elephant.bob(t)
        elephant.step(t)
        elephantShadow.position.x = elephant.group.position.x

        /*
         * P3.2(d) — a flock, not four independent lanes.
         *
         * `birds[0]` is the lead: its own lane, speed and phase are the
         * flock's. Every follower keeps its own `offset` for how it staggers
         * across x (so four birds do not overlap into one blob), but its y
         * and its wingbeat now come from the LEAD's curve — delayed by
         * 0.02s per position back in the line, and by 0.35 rad per position
         * on the flap — rather than from an independent sine of their own.
         * That is what turns "four things crossing the dial together" into
         * "one thing moving."
         */
        for (let i = 0; i < birds.length; i++) {
          const b = birds[i]
          const bp = ((t * b.speed + b.offset * 0.14) % 1)
          b.group.position.x = -0.9 + bp * 1.8
          const lag = 0.02 * i
          b.group.position.y = birds[0].lane + Math.sin((t - lag) * 1.1 + birds[0].offset) * 0.045
          b.flap(t, birds[0].offset + 0.35 * i)
        }

        // The crescent's very slow drift — 0.02 rad/min, as specified.
        moonGroup.rotation.z += (0.02 / 60) * dt
      }

      // No render call here. The hands subscriber runs every frame and draws
      // the whole scene; a second render in the same frame would be the same
      // picture twice. This subscriber only MUTATES — which is why it can be
      // throttled to 15 fps without the dial ever stuttering.
    }, { band: 'ambient' })

    return () => {
      stopHands()
      stopDiorama()
      ro.disconnect()
      stopPalette()
      document.documentElement.removeEventListener('forge:motion-changed', onMotionChange)
      for (const g of pineGeos) g.dispose()
      for (const d of disposables) d.dispose?.()
      sky.dispose()
      dial.dispose()
      glowTex.dispose()
      environment.dispose()
      dispose()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="forge-clock"
      aria-hidden="true"
      /*
       * P3.1 — the clock never intercepts a pointer event, full stop.
       * `pointer-events: none` comes from `.forge-clock` in index.css; there
       * is no hover tilt left to opt back in for, so nothing here overrides
       * it. A click aimed at the page behind the dial always reaches the page.
       */
    />
  )
}

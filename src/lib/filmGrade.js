/**
 * filmGrade.js — the film layer, owned in one place.
 *
 * Every WebGL scene on this site was rendering *linear light straight to an
 * 8-bit buffer*. That is the single reason hand-built WebGL looks like WebGL
 * and a render looks like a photograph: with no tone curve, anything brighter
 * than 1.0 clips flat to the primary — a white highlight becomes a white hole,
 * an orange emissive becomes a solid orange blob — and the eye reads the
 * clipping instantly even when it cannot name it.
 *
 * Film does not clip. It rolls off: highlights desaturate toward white along a
 * curve as they overexpose. AgX is the modern approximation of that curve (the
 * one Blender switched to), and three.js ships it. Turning it on is four lines
 * and it is the largest single visual change available to this project.
 *
 * The other half is lighting. A `DirectionalLight` gives one hard falloff and
 * a dead black shadow side, which is what makes untextured geometry read as
 * cardboard. A real object is lit from every direction at once by whatever is
 * around it. That is an environment map, and a 16x32 gradient — two kilobytes,
 * generated on the client, no HDR to download — is enough to carry it.
 *
 * Both live here rather than in each component so there is exactly one grade
 * on the site. Two scenes with different tone curves side by side look like
 * two websites.
 */
import {
  AgXToneMapping,
  Color,
  DataTexture,
  EquirectangularReflectionMapping,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'

/**
 * Exposure, in stops-ish.
 *
 * AgX is a *darkening* curve by design — it holds detail where the old
 * clipping path threw it away, and the price is that everything authored
 * against no tone mapping comes back looking under-lit. 1.35 restores the
 * previous perceived brightness of the gem and the desk while keeping the
 * rolloff. It is a single number on purpose: if a scene needs its own, the
 * scene is wrong, not the number.
 */
export const FILM_EXPOSURE = 1.35

/**
 * Put a renderer on the film curve.
 *
 * Safe to call on any three renderer, including one that has already been
 * graded — it is idempotent, which matters because the anchored-renderer
 * factory calls it for every scene it hands out.
 *
 * @param {import('three').WebGLRenderer} renderer
 */
export function applyFilmGrade(renderer) {
  if (!renderer) return renderer
  renderer.toneMapping = AgXToneMapping
  renderer.toneMappingExposure = FILM_EXPOSURE
  /*
   * P4A.2 — say it out loud.
   *
   * `grep -r outputColorSpace src/` returned zero hits before this line. The
   * renderer was relying on the three.js default for the setting that decides
   * whether every colour on the site is right — and three.js has changed that
   * default between versions (r152 flipped the whole colour management model).
   * A dependency bump silently regrading the entire site is not a
   * hypothetical; it is the most likely way this work gets undone.
   *
   * `SRGBColorSpace` is what a canvas element displays. Stating it means the
   * pipeline is: linear working space → AgX → sRGB out, all three declared.
   */
  renderer.outputColorSpace = SRGBColorSpace
  return renderer
}

/**
 * P4A.3 — an sRGB hex literal, converted into the linear working space.
 *
 * `grep -r convertSRGBToLinear src/` also returned zero. Every `new Color('#…')`
 * on this site was being handed to a shader as if the hex digits were linear
 * light, which they are not — they are display-encoded, roughly a 2.2 power
 * curve away from it.
 *
 * The consequence is specific and it is a large part of what "cartoon" means.
 * In linear space, mixing two colours is averaging light; in sRGB space it is
 * averaging *encoded* numbers, which pulls every midtone toward grey. A green
 * lit by a warm key becomes muddy olive instead of yellow-green; two blended
 * layers lose their chroma exactly where the eye is most sensitive to it. No
 * amount of picking better hex values fixes it, because the arithmetic is
 * happening in the wrong space.
 *
 * Every colour literal in the 3-D layer now goes through here. It is the
 * cheapest change in Phase 4 — zero runtime cost, one conversion at construction
 * — and roughly half the perceived realism gain.
 *
 * @param {string|number} hex an sRGB literal, e.g. '#ffe3b4'
 * @returns {Color} the same colour, in linear-sRGB
 */
export function srgb(hex) {
  return new Color(hex).convertSRGBToLinear()
}

/**
 * A tiny procedural environment — a room, not a gradient.
 *
 * The version this replaces wrote the same colour across every column, i.e.
 * it varied with elevation only. On a *metal*, which reflects its surroundings
 * across the whole surface, that has a specific and fatal consequence: turning
 * the object changes nothing, because every direction it could face reflects
 * the same thing. The hero gem spun continuously and its shading never moved —
 * it read as a flat teal pebble with seams drawn on, and no amount of light
 * tuning fixed it, because the lights were never the problem.
 *
 * So this has azimuth. Three features, at three bearings:
 *
 *   - a **key window** high and to one side — the bright source that gives the
 *     specular highlight, and the thing whose travel across the facets is what
 *     actually reads as rotation
 *   - an **accent lamp** at the opposite bearing, near the horizon, in the
 *     theme colour, so the far side of the object carries the site's hue
 *   - a **horizon line**, narrow, dividing bright sky from near-black ground
 *
 * The vertical range is pushed as wide as 8 bits allow (near-black floor,
 * bright ceiling), because contrast in the environment IS contrast on the
 * object. A washed-out room can only produce a washed-out render.
 *
 * 32x16 — azimuth needs the resolution, elevation does not, and it is still
 * two kilobytes generated on the client with no HDR to download.
 *
 * @param {import('three').Color|string} accent
 * @returns {import('three').DataTexture}
 */
export function makeEnvironment(accent) {
  const W = 32
  const H = 16
  const data = new Uint8Array(W * H * 4)
  const sky = new Color('#93a8cc')
  const ground = new Color('#05060a')
  const tint = accent instanceof Color ? accent : new Color(accent)
  const tmp = new Color()

  /** Angular distance on the wrapped azimuth axis, in turns. */
  const arc = (u, at) => {
    const d = Math.abs(u - at)
    return Math.min(d, 1 - d)
  }

  for (let y = 0; y < H; y++) {
    // 0 at the zenith, 1 at the floor.
    const t = y / (H - 1)
    for (let x = 0; x < W; x++) {
      const u = x / W

      tmp.copy(ground).lerp(sky, Math.pow(1 - t, 1.5))

      // The horizon: narrow, so it reads as an edge rather than as a haze.
      const horizon = Math.exp(-Math.pow((t - 0.52) * 16, 2))
      tmp.lerp(sky, horizon * 0.35)

      // Key window — bright, high, one bearing. This is the highlight.
      const key = Math.exp(-Math.pow(arc(u, 0.22) * 7, 2) - Math.pow((t - 0.3) * 5, 2))
      tmp.lerp(new Color(1, 1, 1), Math.min(0.92, key))

      // Accent lamp — opposite bearing, low, theme-coloured.
      const lamp = Math.exp(-Math.pow(arc(u, 0.68) * 5, 2) - Math.pow((t - 0.56) * 6, 2))
      tmp.lerp(tint, Math.min(0.85, lamp))

      const i = (y * W + x) * 4
      data[i] = Math.round(Math.min(1, tmp.r) * 255)
      data[i + 1] = Math.round(Math.min(1, tmp.g) * 255)
      data[i + 2] = Math.round(Math.min(1, tmp.b) * 255)
      data[i + 3] = 255
    }
  }

  const tex = new DataTexture(data, W, H, RGBAFormat, UnsignedByteType)
  tex.mapping = EquirectangularReflectionMapping
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

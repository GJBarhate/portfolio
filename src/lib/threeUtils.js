import { WebGLRenderTarget, LinearFilter, RGBAFormat, FloatType } from 'three'
import { getPalette } from './palette.js'

/**
 * Is WebGL available, and on what renderer?
 *
 * MEMOISED, and that is a real fix rather than a micro-optimisation. This
 * function creates an actual `WebGLRenderingContext`, queries it for the
 * unmasked renderer string, then deliberately kills it with
 * `WEBGL_lose_context`. Five call sites — the clock, the hero gem, the About
 * desk, the avatar and the resilience layer — meant FIVE context
 * create-and-destroy cycles per page load, on top of the four contexts the
 * page actually keeps.
 *
 * Context allocation is one of the more expensive things a GL driver does,
 * and browsers cap live contexts at roughly 8–16 and evict the OLDEST when
 * the cap is reached. Churning five throwaway contexts during the busiest
 * moment of the load is both a direct cost and a way to push a real context
 * closer to eviction.
 *
 * The answer cannot change during a session, so it is computed once.
 */
let webglResult = null

export function checkWebGL() {
  if (webglResult) return webglResult
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      webglResult = { supported: false, renderer: 'none' }
      return webglResult
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : 'unknown'
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    webglResult = { supported: true, renderer }
    return webglResult
  } catch {
    webglResult = { supported: false, renderer: 'none' }
    return webglResult
  }
}

/**
 * Semantic theme colours for WebGL scenes, resolved to hex.
 *
 * Colour reading lives in `lib/palette.js` now (three-free, so 2-D canvases
 * can share it, and it is what drives the §6.1 sweep repaint). This wrapper
 * keeps the legacy aliases several scenes still name their materials by.
 */
export function getThemeColors() {
  const p = getPalette()
  return {
    accent: p.accent,
    violet: p.violet,
    warm: p.warm,
    surface: p.surface,
    // legacy aliases
    plasma: p.accent, cyan: p.violet, ember: p.warm, void: p.surface,
  }
}

export function makePingPongRT(width, height, options = {}) {
  const opts = {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    format: RGBAFormat,
    type: FloatType,
    ...options,
  }
  const rt1 = new WebGLRenderTarget(width, height, opts)
  const rt2 = new WebGLRenderTarget(width, height, opts)
  return { rt1, rt2, current: rt1, alternate: rt2, swap() { const t = this.current; this.current = this.alternate; this.alternate = t } }
}

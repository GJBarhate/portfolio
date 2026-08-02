import { WebGLRenderTarget, LinearFilter, RGBAFormat, FloatType } from 'three'
import { getPalette } from './palette.js'

export function checkWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return { supported: false, renderer: 'none' }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : 'unknown'
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { supported: true, renderer }
  } catch {
    return { supported: false, renderer: 'none' }
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

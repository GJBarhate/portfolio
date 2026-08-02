import { WebGLRenderTarget, LinearFilter, RGBAFormat, FloatType } from 'three'

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

function cssColorToHex(raw) {
  if (!raw) return raw
  try {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = raw
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
  } catch {
    return raw
  }
}

/**
 * Semantic theme colours for WebGL scenes, resolved to hex.
 *
 * Reads the semantic tokens first and falls back to the legacy colour-named
 * ones, so scenes keep working whichever palette layer is in play. `plasma`,
 * `cyan` and `ember` are kept as aliases because several scenes still name
 * their materials that way.
 */
export function getThemeColors() {
  const root = getComputedStyle(document.documentElement)
  const read = (...names) => {
    for (const n of names) {
      const v = root.getPropertyValue(n).trim()
      if (v) return cssColorToHex(v)
    }
    return null
  }
  const accent = read('--accent') || '#2fd4d4'
  const violet = read('--violet') || '#8b5cf6'
  const warm = read('--warm') || '#f5a524'
  const surface = read('--surface-0') || '#0a0a0f'
  return {
    accent, violet, warm, surface,
    // legacy aliases
    plasma: accent, cyan: violet, ember: warm, void: surface,
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

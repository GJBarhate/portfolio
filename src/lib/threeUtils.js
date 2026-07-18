import * as THREE from 'three'

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

export function getThemeColors() {
  const root = getComputedStyle(document.documentElement)
  const plasma = cssColorToHex(root.getPropertyValue('--plasma').trim()) || '#d946ef'
  const cyan = cssColorToHex(root.getPropertyValue('--cyan').trim()) || '#06b6d4'
  const ember = cssColorToHex(root.getPropertyValue('--ember').trim()) || '#f97316'
  const inkVoid = cssColorToHex(root.getPropertyValue('--ink-void').trim()) || '#0a0a0f'
  return { plasma, cyan, ember, void: inkVoid }
}

export function makePingPongRT(width, height, options = {}) {
  const opts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    ...options,
  }
  const rt1 = new THREE.WebGLRenderTarget(width, height, opts)
  const rt2 = new THREE.WebGLRenderTarget(width, height, opts)
  return { rt1, rt2, current: rt1, alternate: rt2, swap() { const t = this.current; this.current = this.alternate; this.alternate = t } }
}

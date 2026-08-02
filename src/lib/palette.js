/**
 * Theme palette for canvas / WebGL layers — and the fix for §6.1.
 *
 * CSS variables are invisible to a canvas: every GL uniform and every
 * `ctx.fillStyle` samples them exactly once, at init. So when the theme sweep
 * expands its circle, the pixels inside it are painted with the OLD palette
 * and stay that way — the "colours don't spread properly" complaint. There is
 * no CSS fix; the flip has to be pushed to those layers.
 *
 * `ThemeContext` dispatches `forge:theme-changed` after `data-theme` flips.
 * This module re-reads the tokens and hands subscribers a palette that LERPS
 * from old to new over the same 650 ms as the sweep, so the canvas travels
 * with the circle instead of snapping ahead of it.
 *
 * Nothing here imports three, so a 2-D canvas can use it for free.
 */
import { onFrame } from './raf.js'

const TOKENS = ['--accent', '--accent-bright', '--violet', '--warm', '--surface-0', '--surface-1', '--ink']
const SWEEP_MS = 650

/** Resolve any CSS colour (including oklch) to `#rrggbb`. */
function toHex(raw) {
  if (!raw) return null
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase()
  try {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = raw
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function readPalette() {
  const root = getComputedStyle(document.documentElement)
  const out = {}
  for (const t of TOKENS) {
    out[t] = toHex(root.getPropertyValue(t).trim())
  }
  return {
    accent: out['--accent'] || '#2fd4d4',
    accentBright: out['--accent-bright'] || '#7fe3e5',
    violet: out['--violet'] || '#8b5cf6',
    warm: out['--warm'] || '#f5a524',
    surface: out['--surface-0'] || '#0a0a0f',
    surface1: out['--surface-1'] || '#14161a',
    ink: out['--ink'] || '#e8ecef',
  }
}

const KEYS = ['accent', 'accentBright', 'violet', 'warm', 'surface', 'surface1', 'ink']

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function toHexStr([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}
/* --ease-cinema, cubic-bezier(0.65, 0, 0.35, 1), close enough in one line. */
function easeCinema(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

let current = null
const subs = new Set()

/** The palette as it stands right now (mid-sweep values while sweeping). */
export function getPalette() {
  if (!current) current = readPalette()
  return current
}

/**
 * Subscribe to palette changes. The callback fires immediately with the
 * current palette, then on every frame of a theme sweep.
 * @param {(palette: object) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onPalette(fn) {
  subs.add(fn)
  fn(getPalette())
  return () => subs.delete(fn)
}

function emit() {
  for (const fn of subs) {
    try { fn(current) } catch { /* one bad listener must not stall the sweep */ }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('forge:theme-changed', () => {
    const from = getPalette()
    const to = readPalette()
    if (!subs.size) { current = to; return }

    const fromRgb = {}
    const toRgbMap = {}
    for (const k of KEYS) {
      fromRgb[k] = toRgb(from[k])
      toRgbMap[k] = toRgb(to[k])
    }

    let elapsed = 0
    const stop = onFrame((_t, dt) => {
      elapsed += dt
      const p = Math.min(1, elapsed / SWEEP_MS)
      const e = easeCinema(p)
      const next = {}
      for (const k of KEYS) {
        next[k] = toHexStr([
          fromRgb[k][0] + (toRgbMap[k][0] - fromRgb[k][0]) * e,
          fromRgb[k][1] + (toRgbMap[k][1] - fromRgb[k][1]) * e,
          fromRgb[k][2] + (toRgbMap[k][2] - fromRgb[k][2]) * e,
        ])
      }
      current = next
      emit()
      if (p >= 1) { current = to; emit(); stop() }
    })
  })
}

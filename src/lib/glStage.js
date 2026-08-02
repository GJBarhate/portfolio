/**
 * A single shared WebGL renderer for the whole page.
 *
 * WebGL resources cannot be shared across contexts: every extra
 * `WebGLRenderer` re-compiles shaders and re-uploads textures, and browsers
 * cap contexts at roughly 8–16 — past which the OLDEST context is silently
 * lost and whatever it was drawing goes black. This site ran nine at once.
 *
 * Three.js's recommended pattern for many small canvases is one full-viewport
 * renderer plus `setViewport`/`setScissor` per virtual canvas. Components
 * register `{ element, scene, camera }`; one frame callback walks the
 * registry, skips anything off-screen, and scissor-renders the rest into the
 * region occupied by each element.
 *
 * Usage:
 *   const handle = register({ element, scene, camera, onFrame })
 *   handle.dispose()
 */
import { WebGLRenderer } from 'three'
import { onFrame, getTier } from './raf.js'

let renderer = null
let canvas = null
let stopFrame = null
let io = null
const entries = new Set()

function ensureRenderer() {
  if (renderer) return renderer

  canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    // Sits behind page content; individual scenes appear inside their own
    // element's rectangle, so this reads as several independent canvases.
    zIndex: '0',
  })
  document.body.appendChild(canvas)

  renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, getTier() >= 3 ? 1.75 : 1.25))
  renderer.setScissorTest(true)
  resize()
  window.addEventListener('resize', resize)

  io = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        for (const e of entries) {
          if (e.element === r.target) e.visible = r.isIntersecting
        }
      }
    },
    { rootMargin: '10% 0px' }
  )

  stopFrame = onFrame(renderAll)
  return renderer
}

function resize() {
  if (!renderer) return
  renderer.setSize(window.innerWidth, window.innerHeight, false)
}

function renderAll(t, dt) {
  if (!renderer || entries.size === 0) return
  const vh = window.innerHeight

  for (const entry of entries) {
    if (!entry.visible) continue
    const rect = entry.element.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) continue
    // Fully outside the viewport — the observer margin can lag a fast scroll.
    if (rect.bottom < 0 || rect.top > vh) continue

    entry.onFrame?.(t, dt, rect)

    // WebGL's origin is bottom-left; the DOM's is top-left.
    const left = rect.left
    const bottom = vh - rect.bottom
    renderer.setViewport(left, bottom, rect.width, rect.height)
    renderer.setScissor(left, bottom, rect.width, rect.height)

    if (entry.camera.isPerspectiveCamera) {
      const aspect = rect.width / rect.height
      if (entry.camera.aspect !== aspect) {
        entry.camera.aspect = aspect
        entry.camera.updateProjectionMatrix()
      }
    }
    renderer.render(entry.scene, entry.camera)
  }
}

/**
 * Register a scene to be drawn into the bounds of `element`.
 * @param {{element: HTMLElement, scene: object, camera: object, onFrame?: Function}} config
 * @returns {{dispose: () => void, renderer: object}}
 */
export function register({ element, scene, camera, onFrame: cb }) {
  ensureRenderer()
  const entry = { element, scene, camera, onFrame: cb, visible: false }
  entries.add(entry)
  io.observe(element)

  return {
    get renderer() { return renderer },
    dispose() {
      entries.delete(entry)
      io?.unobserve(element)
      if (entries.size === 0) teardown()
    },
  }
}

function teardown() {
  stopFrame?.()
  stopFrame = null
  io?.disconnect()
  io = null
  window.removeEventListener('resize', resize)
  renderer?.dispose()
  renderer = null
  canvas?.remove()
  canvas = null
}

/** The shared renderer, or null if nothing has registered yet. */
export function getRenderer() {
  return renderer
}

// ── Overlay renderer ───────────────────────────────────────────────────────
// The scissor stage draws into a single fixed layer BEHIND page content, which
// is right for ambient scenes but wrong for an effect that must sit on top of
// a specific element (the project-card hover distortion). Those share one
// module-level renderer whose canvas is moved to whichever element is active —
// only one card can be hovered at a time, so one context is genuinely enough.
let overlay = null

/**
 * The single overlay renderer + canvas, created on first use.
 * @returns {{renderer: object, canvas: HTMLCanvasElement}}
 */
export function getOverlayRenderer() {
  if (overlay) return overlay
  const el = document.createElement('canvas')
  el.setAttribute('aria-hidden', 'true')
  const r = new WebGLRenderer({ canvas: el, alpha: true, antialias: false })
  r.setPixelRatio(Math.min(window.devicePixelRatio, getTier() >= 3 ? 1.75 : 1.25))
  overlay = { renderer: r, canvas: el }
  return overlay
}

/**
 * A renderer whose canvas lives INSIDE `element`.
 *
 * The scissor stage draws into one fixed layer at z-index 0, i.e. behind
 * `<main>`. That is correct for a true background field like the particle
 * universe, but a scene anchored to an element that sits on top of an opaque
 * section background (the hero gem, the About desk) would be completely
 * hidden by it. Raising the stage above `<main>` is not an option either —
 * it would cover every heading on the page.
 *
 * So those scenes keep a canvas of their own. They are still lazily mounted,
 * tier-gated, viewport-gated and driven by the one shared frame loop, and
 * construction stays in this module so there is a single owner.
 *
 * @param {HTMLElement} element
 * @returns {{renderer: object, dispose: () => void}}
 */
export function createAnchoredRenderer(element) {
  const el = document.createElement('canvas')
  el.setAttribute('aria-hidden', 'true')
  el.style.display = 'block'
  el.style.width = '100%'
  el.style.height = '100%'
  const r = new WebGLRenderer({ canvas: el, alpha: true, antialias: false })
  r.setPixelRatio(Math.min(window.devicePixelRatio, getTier() >= 3 ? 1.75 : 1.25))
  element.appendChild(el)

  return {
    renderer: r,
    dispose() {
      r.dispose()
      // Explicitly drop the GPU context rather than waiting for GC — this is
      // what keeps the live-context count bounded as sections mount/unmount.
      r.forceContextLoss?.()
      if (el.parentNode === element) element.removeChild(el)
    },
  }
}

/**
 * A dedicated renderer for pipelines the scissor stage cannot express.
 *
 * The fluid simulation ping-pongs between its own float render targets across
 * ~20 passes per step; that cannot be expressed as a viewport into a shared
 * scene graph. It is the one legitimate exception, and it only ever mounts on
 * a tier-3 machine with 8+ cores.
 *
 * @param {HTMLCanvasElement} canvasEl
 * @param {object} [opts]
 */
export function createDedicatedRenderer(canvasEl, opts = {}) {
  return new WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: false, ...opts })
}

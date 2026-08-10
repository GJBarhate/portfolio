/**
 * WebGL renderer construction for the whole page, in one place.
 *
 * WebGL resources cannot be shared across contexts: every extra
 * `WebGLRenderer` re-compiles shaders and re-uploads textures, and browsers
 * cap contexts at roughly 8–16 — past which the OLDEST context is silently
 * lost and whatever it was drawing goes black. This site once ran nine.
 *
 * ── The shared scissor stage was removed ──────────────────────────────────
 *
 * This module used to also implement three.js's "many small canvases" pattern:
 * one full-viewport renderer plus `setViewport`/`setScissor` per registered
 * element. It was ~90 lines — a fixed canvas, an IntersectionObserver, a
 * ResizeObserver, a frame subscriber and a `register()` API — and **nothing
 * ever called it.** Every scene on this site sits on top of an opaque section
 * background, which is precisely the case the stage cannot serve (it draws
 * behind `<main>`), so all three used the anchored escape hatch instead.
 *
 * Dead code that describes an architecture the code does not use is worse than
 * no comment: the module's own documentation asserted a design that had never
 * shipped. What remains is what is actually used.
 *
 * Three live contexts by design — the hero gem, the About desk and the corner
 * clock — plus the background field, which owns its own raw-WebGL context in
 * `lib/bgEngine.js`.
 */
import { WebGLRenderer } from 'three'
import { getTier } from './raf.js'
import { applyFilmGrade } from './filmGrade.js'

/**
 * P0.8 — how many GL contexts are actually alive.
 *
 * The whole reason this module exists is that the site once ran nine contexts
 * and lost the oldest ones silently. "How many are live right now" was
 * nevertheless unanswerable without opening about:gpu, so every claim about it
 * was an assertion. Every construction site in this file increments; every
 * disposal decrements. `?perf=1` reads it, and so does the e2e budget.
 */
let liveContexts = 0

/** Live `WebGLRenderer` count — the number `check-budgets` budgets at ≤ 3. */
export function liveContextCount() {
  return liveContexts
}

// The project-card hover distortion used to take an overlay renderer from
// here. It is now one fullscreen quad on raw WebGL (`lib/rawGL.js`, ~3 KB) —
// a scene graph was never needed for a 2-D shader, and importing three for it
// put 131 KB on the Projects path.

/**
 * A renderer whose canvas lives INSIDE `element` — the only kind this site
 * uses.
 *
 * Every 3-D scene here sits ON TOP of its section's opaque background, so a
 * shared behind-content layer could not draw any of them, and raising such a
 * layer above `<main>` would cover every heading on the page. Each scene
 * therefore owns its canvas. They are still lazily mounted, viewport-gated
 * and driven by the one shared frame loop, and construction stays in this
 * module so there is a single owner of context lifetime.
 *
 * @param {HTMLElement} element
 * @returns {{renderer: object, dispose: () => void}}
 */
export function createAnchoredRenderer(element, { antialias = false } = {}) {
  const el = document.createElement('canvas')
  el.setAttribute('aria-hidden', 'true')
  el.style.display = 'block'
  el.style.width = '100%'
  el.style.height = '100%'
  /*
   * 4B.5 — `antialias` is now a per-caller decision rather than a blanket
   * `false`.
   *
   * MSAA cost scales with pixel count, which is exactly why the blanket answer
   * was wrong: it is unaffordable on a full-viewport field and nearly free on a
   * 260 px dial. On that dial, a thin second hand without it has visible
   * stair-stepping, and stair-stepping is one of the most reliable "this is a
   * cheap render" signals there is.
   */
  const r = new WebGLRenderer({ canvas: el, alpha: true, antialias })
  liveContexts += 1
  // Every anchored scene is graded here rather than in the component, so the
  // gem and the desk cannot end up on two different tone curves. See
  // filmGrade.js for why this is the largest single visual change available.
  applyFilmGrade(r)
  // Tier scales RESOLUTION, never existence. A tier-1 machine still gets the
  // scene, drawn at device pixels; it is the cheapest lever there is and the
  // visitor cannot tell the difference at this size.
  const t = getTier()
  r.setPixelRatio(Math.min(window.devicePixelRatio, t >= 3 ? 1.75 : t >= 2 ? 1.25 : 1))
  element.appendChild(el)

  let disposed = false
  return {
    renderer: r,
    /**
     * Compile this scene's programs OFF the blocking path.
     *
     * A `renderer.render()` on a scene whose programs are not yet linked
     * compiles them synchronously, on the main thread, right then — which is a
     * stall the visitor feels as the page locking up for a moment the first
     * time each scene appears. It is one of the few WebGL costs that is
     * genuinely expensive on real GPUs as well as on software ones, because
     * the stall is in the driver's compiler, not in rasterisation.
     *
     * `compileAsync` uses `KHR_parallel_shader_compile` where the driver has
     * it and falls back to the synchronous path where it does not, so this is
     * never worse and is usually much better. Callers await it before their
     * first frame.
     */
    async warmUp(scene, camera) {
      try { await r.compileAsync(scene, camera) } catch { /* older three, or a lost context */ }
    },
    dispose() {
      if (disposed) return
      disposed = true
      liveContexts = Math.max(0, liveContexts - 1)
      r.dispose()
      // Explicitly drop the GPU context rather than waiting for GC — this is
      // what keeps the live-context count bounded as sections mount/unmount.
      r.forceContextLoss?.()
      if (el.parentNode === element) element.removeChild(el)
    },
  }
}

/*
 * `createDedicatedRenderer` was removed with its only caller.
 *
 * It existed for the hero fluid simulation, which ping-ponged between float
 * render targets across ~20 passes per step and could not be expressed as a
 * viewport into a shared scene. The simulation is gone; a factory whose only
 * justification was one deleted caller is not an extension point, it is an
 * unused branch that the next reader has to evaluate.
 */

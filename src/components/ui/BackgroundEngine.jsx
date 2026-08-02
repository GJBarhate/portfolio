import { useEffect, useRef } from 'react'
import { onFrame, getTier, onTierChange } from '../../lib/raf.js'
import { onPalette } from '../../lib/palette.js'
import { createBackgroundEngine, hexToVec3 } from '../../lib/bgEngine.js'

// The order the shader blends between (§14.1 uSection). Anything not listed
// resolves to "near-still".
const SECTIONS = ['hero', 'about', 'stats', 'skills', 'projects', 'timeline', 'how-i-build', 'contact']

/** Framerate-independent damping, k per Research #19. */
function damp(current, target, dt, k) {
  return current + (target - current) * (1 - Math.exp(-(dt / 1000) * k))
}

/**
 * §14 — one GPU layer for the whole site.
 *
 * Mounts only at tier ≥ 2. Tier 1, phones, reduced-motion and save-data never
 * get a context at all: they see the static CSS gradient composition of the
 * same palette that `critical.css` already paints (§14.4, the "PNG export"
 * principle — same design language, at the device's honest budget).
 */
export default function BackgroundEngine() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (getTier() < 2) return

    const engine = createBackgroundEngine(canvas)
    if (!engine) return
    const { gl, uniforms } = engine

    let disposed = false
    let time = 0
    const mouse = { x: 0.5, y: 0.5 }
    const smoothMouse = { x: 0.5, y: 0.5 }
    let scrollVel = 0
    let smoothVel = 0
    let lastScrollY = window.scrollY
    let section = 0
    let smoothSection = 0
    let palette = null

    // ── resolution ladder (§14.4) ────────────────────────────────────────
    // Tier 2 renders at half resolution and lets the compositor upscale.
    // For a soft gradient field that is imperceptible and roughly 4× cheaper.
    const scaleForTier = (t) => (t >= 3 ? Math.min(window.devicePixelRatio || 1, 1.5) : 1) * (t >= 3 ? 1 : 0.5)

    let scale = scaleForTier(getTier())
    const resize = () => {
      const w = Math.max(1, Math.round(window.innerWidth * scale))
      const h = Math.max(1, Math.round(window.innerHeight * scale))
      if (canvas.width === w && canvas.height === h) return
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uniforms.uResolution, w, h)
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    // ── palette (§6.1 — lerped across the theme sweep) ───────────────────
    const stopPalette = onPalette((p) => {
      palette = p
      gl.useProgram(engine.program)
      gl.uniform3fv(uniforms.uSurface, hexToVec3(p.surface))
      gl.uniform3fv(uniforms.uAccent, hexToVec3(p.accent))
      gl.uniform3fv(uniforms.uGlow, hexToVec3(p.accentBright))
    })

    // ── pointer ──────────────────────────────────────────────────────────
    const onPointer = (e) => {
      mouse.x = e.clientX / window.innerWidth
      mouse.y = 1 - e.clientY / window.innerHeight
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    // ── which section are we in ──────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idx = SECTIONS.indexOf(e.target.id)
          if (idx >= 0) section = idx
        }
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    const attach = () => {
      for (const id of SECTIONS) {
        const el = document.getElementById(id)
        if (el) io.observe(el)
      }
    }
    attach()
    const mo = new MutationObserver(attach)
    mo.observe(document.body, { childList: true, subtree: true })

    // ── tier ladder ──────────────────────────────────────────────────────
    const offTier = onTierChange((t) => {
      if (t < 2) { teardown(); return }
      scale = scaleForTier(t)
      resize()
    })

    // ── dev GPU budget probe (§14.2) ─────────────────────────────────────
    let query = null
    let queryFrame = 0
    const probe = engine.timerExt

    let stopFrame = onFrame((_t, dt) => {
      if (disposed) return
      const tier = getTier()
      // Tier 3 runs at full speed; tier 2's field moves more slowly, which
      // costs nothing and reads as "calm" rather than "dropped frames".
      time += (dt / 1000) * (tier >= 3 ? 1.0 : 0.6)

      const y = window.scrollY
      scrollVel = (y - lastScrollY) / Math.max(dt, 1)
      lastScrollY = y

      smoothMouse.x = damp(smoothMouse.x, mouse.x, dt, 8)
      smoothMouse.y = damp(smoothMouse.y, mouse.y, dt, 8)
      smoothVel = damp(smoothVel, Math.max(-3, Math.min(3, scrollVel)), dt, 8)
      smoothSection = damp(smoothSection, section, dt, 4)

      if (probe && !query && queryFrame++ % 240 === 0) {
        query = probe.createQueryEXT()
        probe.beginQueryEXT(probe.TIME_ELAPSED_EXT, query)
      }

      gl.useProgram(engine.program)
      gl.uniform1f(uniforms.uTime, time)
      gl.uniform2f(uniforms.uMouse, smoothMouse.x, smoothMouse.y)
      gl.uniform1f(uniforms.uScrollVel, smoothVel)
      gl.uniform1f(uniforms.uSection, smoothSection)
      gl.uniform1f(uniforms.uIntensity, tier >= 3 ? 1.0 : 0.75)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      if (probe && query) {
        probe.endQueryEXT(probe.TIME_ELAPSED_EXT)
        const done = probe.getQueryObjectEXT(query, probe.QUERY_RESULT_AVAILABLE_EXT)
        const disjoint = gl.getParameter(probe.GPU_DISJOINT_EXT)
        if (done && !disjoint) {
          const ns = probe.getQueryObjectEXT(query, probe.QUERY_RESULT_EXT)
          const ms = ns / 1e6
          console.info(
            `%cbg engine%c ${ms.toFixed(2)} ms/frame · tier ${tier} · budget 1.20 ms${ms > 1.2 ? ' ⚠ OVER' : ''}`,
            'color:#7fe3e5;font-weight:bold', 'color:inherit'
          )
          query = null
        }
      }
    })

    function teardown() {
      if (disposed) return
      disposed = true
      stopFrame?.()
      stopFrame = null
      stopPalette()
      io.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      engine.dispose()
    }

    return () => { offTier(); teardown() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="bg-engine"
      aria-hidden="true"
    />
  )
}

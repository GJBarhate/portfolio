import { useEffect, useRef, useState } from 'react'
import { onFrame, getTier, onTierChange, prefersReducedMotion } from '../../lib/raf.js'
import { guardContext, markGlUnavailable } from '../../lib/glResilience.js'
import { onPalette } from '../../lib/palette.js'
import { bgSceneId } from '../../lib/bgScene.js'
import { createBackgroundEngine, hexToVec3 } from '../../lib/bgEngine.js'

// The order the shader blends between (§14.1 uSection).
const SECTIONS = ['hero', 'about', 'stats', 'skills', 'projects', 'timeline', 'how-i-build', 'contact', 'footer']

/*
 * Which motif each section wears. Ids are the branches in `motif()`
 * (bgEngine.js): 0 fog · 1 cells · 2 dots · 3 net · 4 waves · 5 topology
 * 6 trunk · 7 halo · 8 globe · 9 clouds · 10 rings.
 *
 * This list exists because motif id used to BE the section index, and that
 * coupling made the placement accidental: whichever motif happened to be
 * written eighth got the last section, and three of them — clouds, globe,
 * rings — sat past the end of the page where nobody would ever see them. A
 * backdrop nobody reaches is not implemented, it is merely compiled.
 *
 *   hero        clouds     the first thing anyone sees, and the one that has
 *                          to say "this page renders" before a word is read
 *   about       globe      a world turning behind the story of getting here
 *   stats       dots       a lattice receding to a horizon: data, in depth
 *   skills      net        nodes joined to their neighbours — which is what a
 *                          stack actually is
 *   projects    waves      the section allowed real motion
 *   timeline    topology   contour lines: layers laid down over years
 *   how-i-build trunk      rings around a centre, one per pass
 *   contact     halo       a single warm mass where the page asks for a reply
 *   footer      rings      the finale, and the only place loud is correct
 *
 * fog (0) is the fallback for anything unlisted — it is the site's original
 * field and the safest thing to be looking at. cells (1) is implemented and
 * one edit from being used; it lost about to the globe on looks alone.
 */
const SECTION_MOTIF = [9, 8, 2, 3, 4, 5, 6, 7, 10]

/** Framerate-independent damping, k per Research #19. */
function damp(current, target, dt, k) {
  return current + (target - current) * (1 - Math.exp(-(dt / 1000) * k))
}

/**
 * §14 — one GPU layer for the whole site.
 *
 * Mounts only at tier ≥ 2. Tier 1, reduced-motion and save-data never get a
 * context at all: they see the static CSS gradient composition of the same
 * palette that `critical.css` already paints (§14.4, the "PNG export"
 * principle — same design language, at the device's honest budget).
 *
 * Phones DO get it. They used to be excluded by viewport width, which was the
 * wrong question — this is one fullscreen triangle running two octaves of
 * noise, and at the resolution rung below it costs a phone less than the
 * blurred gradient stack it was replacing. Width is not a capability; the tier
 * governor already measures the thing we actually care about, and it will pull
 * the layer back down if a given handset disagrees.
 */
export default function BackgroundEngine() {
  const canvasRef = useRef(null)
  /*
   * T-045.1 — context loss is routine on mobile, and this canvas has no
   * meaningful state to preserve across one: the field is a pure function of
   * time, scroll and pointer. So "restore" is simply "build it again", which
   * a generation counter expresses exactly — the effect tears down and re-runs
   * with a fresh context. `gaveUp` is the second half: after two losses the
   * component stops rebuilding and the CSS mesh layer becomes the experience,
   * because a loss/restore loop costs more battery than the effect ever did.
   */
  const [generation, setGeneration] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    /*
     * `getTier() < 2` used to be part of this condition, and it was the LAST
     * of the four ways this component could refuse to exist.
     *
     * The other three are documented at the tier-ladder handler below. This
     * one is the worst of them, because it fires at MOUNT: a machine that
     * merely started at tier 1 — a phone, a laptop with `saveData`, anything
     * with <= 2 cores — never ran this effect at all, so the background was
     * not "degraded", it was absent for the whole session with no path back.
     *
     * `gaveUp` stays. That is set only after two real WebGL context losses,
     * which is a genuine "this cannot work here", not a performance opinion.
     */
    if (gaveUp) return

    const detachGuard = guardContext(canvas, {
      label: 'background-field',
      onLost: () => teardown(),
      onRestored: () => setGeneration((g) => g + 1),
      onGiveUp: () => { markGlUnavailable(); setGaveUp(true) },
    })

    const engine = createBackgroundEngine(canvas)
    if (!engine) { detachGuard(); markGlUnavailable(); return }
    const { gl, uniforms } = engine

    let disposed = false
    let time = 0
    const mouse = { x: 0.5, y: 0.5 }
    const smoothMouse = { x: 0.5, y: 0.5 }
    const ripple = { x: 0.5, y: 0.5, life: 0 }
    let scrollVel = 0
    let smoothVel = 0
    let lastScrollY = window.scrollY
    let section = 0
    let smoothSection = 0

    /*
     * §4.18 — the normalised hour, read from the real clock and pushed to
     * `uHour` on a throttle, not every frame. `Date.now()` on every frame is
     * the exact allocation MoonForestClock.jsx's own `clockNow` comment (P3.8)
     * already measured as a real cost at 60–120 calls/sec; the hour only
     * needs to be honest to within a minute for the background and the
     * corner clock to visibly agree.
     */
    let lastHourCheckMs = 0
    let hourFloat = (() => {
      const d = new Date()
      return d.getHours() + d.getMinutes() / 60
    })()

    // ── resolution ladder (§14.4) ────────────────────────────────────────
    // Tier 2 renders at half resolution and lets the compositor upscale.
    // For a soft gradient field that is imperceptible and roughly 4× cheaper.
    //
    // Phones get a rung of their own below that. A handset's fill rate is its
    // scarcest resource and its pixels are the smallest, so the upscale is the
    // least visible exactly where it buys the most — and it is what makes
    // running this at all on mobile an honest trade rather than a boast.
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const scaleForTier = (t) => {
      // T-058.1 — 1.25, not 1.5. A background blur does not need retina
      // resolution, and fill rate is quadratic in the scale factor: dropping
      // 1.5 to 1.25 is a 30 % GPU saving that nobody can see. The declared
      // cost in the effect registry is this number.
      if (t >= 3) return Math.min(window.devicePixelRatio || 1, 1.25)
      return coarse ? 0.4 : 0.5
    }

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
    // T-011 — the canvas is fullscreen-fixed, so the root box IS its size.
    // A ResizeObserver reports that once per real change; `resize` fired on
    // every URL-bar collapse, reallocating the drawing buffer mid-scroll.
    const ro = new ResizeObserver(resize)
    ro.observe(document.documentElement)

    // ── palette (§6.1 — lerped across the theme sweep) ───────────────────
    const stopPalette = onPalette((p) => {
      gl.useProgram(engine.program)
      gl.uniform3fv(uniforms.uSurface, hexToVec3(p.surface))
      gl.uniform3fv(uniforms.uAccent, hexToVec3(p.accent))
      gl.uniform3fv(uniforms.uGlow, hexToVec3(p.accentBright))
    })

    // ── pointer ──────────────────────────────────────────────────────────
    // `pointermove` covers a dragging finger as well as a cursor, so touch
    // needs no separate path for the bloom.
    const onPointer = (e) => {
      mouse.x = e.clientX / window.innerWidth
      mouse.y = 1 - e.clientY / window.innerHeight
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    // A tap, though, is not a move — it is a single instant with no trail
    // behind it. It gets an impulse instead: the field is struck, and the ring
    // spreads and dies on its own clock.
    const onPointerDown = (e) => {
      mouse.x = e.clientX / window.innerWidth
      mouse.y = 1 - e.clientY / window.innerHeight
      ripple.x = mouse.x
      ripple.y = mouse.y
      ripple.life = 1
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true })

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
    /*
     * MEASURED FIX — two bugs, and together they are the whole of
     * "the background moves, sometimes I see it, sometimes I don't".
     *
     * 1. `if (t < 2) { teardown(); return }` — the engine DESTROYED ITS OWN
     *    CONTEXT when the frame governor demoted to tier 1. Gating the mount
     *    on tier in App was only half the problem; even mounted, the component
     *    deleted itself. Measured: the background vanished at 42.5 s into a
     *    session and never came back.
     *
     * 2. `scale = scaleForTier(t); resize()` on every change reallocated the
     *    drawing buffer whenever the tier flapped. Measured across one session
     *    the canvas flipped 1440 -> 720 -> 1440 -> 720, which is a visible
     *    resolution pop — the background appearing to fade in and out.
     *
     * The rule now: the engine NEVER tears down, and its resolution only ever
     * goes DOWN, once, as a rescue under sustained load. Raising resolution
     * mid-session is a visible change with no benefit to anyone; lowering it
     * is a legitimate response to a machine that is struggling. Not existing
     * is never the answer — `glStage.js` has said so all along.
     */
    const offTier = onTierChange((t) => {
      const next = scaleForTier(t)
      if (next >= scale) return
      scale = next
      resize()
    })

    // ── dev GPU budget probe (§14.2) ─────────────────────────────────────
    let query = null
    let queryFrame = 0
    const probe = engine.timerExt

    // T-058.3 — the ambient field renders at 30 fps, not at the display's
    // refresh rate. On a slow-drifting gradient the eye cannot tell, and it
    // halves the GPU cost of the single most expensive layer on the page.
    // Input-driven work (the cursor, the magnetic buttons) keeps the native
    // rate: two rates, one clock.
    const AMBIENT_FRAME_MS = 1000 / 30
    let sinceDraw = 0

    // Re-read per frame rather than captured once: the visitor can change the
    // motion mode from the palette at any moment, and the field must settle
    // or resume without a remount.
    let reduced = prefersReducedMotion()
    const onMotionChange = () => { reduced = prefersReducedMotion() }
    document.documentElement.addEventListener('forge:motion-changed', onMotionChange)

    /*
     * §14.5 — the scene, re-read on change rather than captured at mount.
     *
     * Switching between calm / motifs / forest is a uniform write, so it takes
     * effect on the next frame with no recompile, no new context and no
     * remount. That is the whole reason all three live in one program: a
     * visitor flipping through them from the palette should see the page
     * change, not see it reload.
     */
    /*
     * P5 — degrade by resolution, never by deletion.
     *
     * `uScene` comes from the visitor's stored preference and from NOWHERE
     * else. Tier may change the pixel ratio, the frame rate, the octave count
     * and the wildlife guard band. Tier may never change this uniform.
     *
     * If you are reading this because you want a "low-end fallback scene":
     * lower uIntensity, drop DPR to 0.75, halve the frame rate, skip the
     * god-ray taps. Do not change this value. A visitor who chose Forest and
     * was silently given Calm cannot tell the difference between the site
     * respecting their machine and the site ignoring them, and the second
     * reading is the one they will reach.
     *
     * `scripts/check-appearance-parity.mjs` fails the build if this uniform is
     * ever assigned from anything but `bgSceneId()`.
     */
    let scene = bgSceneId()
    const onSceneChange = () => { scene = bgSceneId() }
    document.documentElement.addEventListener('forge:bg-scene-changed', onSceneChange)

    let stopFrame = onFrame((frameNow, dt) => {
      if (disposed) return
      const tier = getTier()

      sinceDraw += dt
      if (sinceDraw < AMBIENT_FRAME_MS) return
      // Carry the remainder rather than resetting to zero, or the effective
      // rate drifts to half of what was asked for on a 60 Hz display.
      sinceDraw %= AMBIENT_FRAME_MS
      /*
       * Tier 3 runs at full speed; tier 2's field moves more slowly, which
       * costs nothing and reads as "calm" rather than "dropped frames".
       *
       * D-46 — and reduced motion holds the clock completely still. This is
       * where that preference is now honoured: the motif for each section is
       * still drawn, still its own, still in the theme's palette — it simply
       * does not move. The alternative, which is what this replaced, was to
       * refuse to mount the layer at all, and that does not reduce motion, it
       * deletes the design.
       */
      time += (dt / 1000) * (reduced ? 0 : tier >= 3 ? 1.0 : 0.6)

      const y = window.scrollY
      scrollVel = (y - lastScrollY) / Math.max(dt, 1)
      lastScrollY = y

      smoothMouse.x = damp(smoothMouse.x, mouse.x, dt, 8)
      smoothMouse.y = damp(smoothMouse.y, mouse.y, dt, 8)
      smoothVel = damp(smoothVel, Math.max(-3, Math.min(3, scrollVel)), dt, 8)
      smoothSection = damp(smoothSection, section, dt, 4)

      // ~1.4 s from strike to silence, in real seconds rather than frames.
      if (ripple.life > 0) ripple.life = Math.max(0, ripple.life - dt / 1400)

      // §4.18 — re-read the clock once a minute, not once a frame.
      if (frameNow - lastHourCheckMs > 60_000) {
        lastHourCheckMs = frameNow
        const d = new Date()
        hourFloat = d.getHours() + d.getMinutes() / 60
      }

      if (probe && !query && queryFrame++ % 240 === 0) {
        query = probe.createQueryEXT()
        probe.beginQueryEXT(probe.TIME_ELAPSED_EXT, query)
      }

      gl.useProgram(engine.program)
      gl.uniform1f(uniforms.uTime, time)
      gl.uniform2f(uniforms.uMouse, smoothMouse.x, smoothMouse.y)
      gl.uniform1f(uniforms.uScrollVel, smoothVel)
      gl.uniform1f(uniforms.uSection, smoothSection)
      /* The damped section index carries its own crossfade: the whole part
         picks the motif, the fraction is how far it has turned into the next
         one. Clamped rather than wrapped — past the last section there is
         nothing to blend toward, and blending back round to the hero's clouds
         at the footer would read as the page restarting. */
      const lo = Math.max(0, Math.min(SECTION_MOTIF.length - 1, Math.floor(smoothSection)))
      const hi = Math.min(SECTION_MOTIF.length - 1, lo + 1)
      gl.uniform1f(uniforms.uMotifA, SECTION_MOTIF[lo])
      gl.uniform1f(uniforms.uMotifB, SECTION_MOTIF[hi])
      gl.uniform1f(uniforms.uBlend, Math.max(0, Math.min(1, smoothSection - lo)))
      // D-38 — 0.9 at tier 2, not 0.75. The tier already buys its saving from
      // the resolution ladder (0.4-0.5x) and the 30 fps cap, both of which are
      // invisible; dimming the field on top of those is a third saving taken
      // from the only one of the three that the visitor can see.
      gl.uniform1f(uniforms.uIntensity, tier >= 3 ? 1.0 : 0.9)
      gl.uniform3f(uniforms.uRipple, ripple.x, ripple.y, ripple.life)
      gl.uniform1f(uniforms.uScene, scene)
      // §4.18 — the same hour the corner clock is showing, so the two
      // elements of the page can never disagree about what time it is.
      gl.uniform1f(uniforms.uHour, hourFloat)
      // §4.19 — the tier ladder, as a float the biome's mix() calls read
      // directly. BackgroundEngine never mounts below tier 2 (see this
      // file's own header comment), so this is 2 or 3 in practice.
      gl.uniform1f(uniforms.uDetail, tier)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      if (probe && query) {
        probe.endQueryEXT(probe.TIME_ELAPSED_EXT)
        const done = probe.getQueryObjectEXT(query, probe.QUERY_RESULT_AVAILABLE_EXT)
        const disjoint = gl.getParameter(probe.GPU_DISJOINT_EXT)
        if (done && !disjoint) {
          const ns = probe.getQueryObjectEXT(query, probe.QUERY_RESULT_EXT)
          const ms = ns / 1e6
          console.info(
            `%cbg engine%c ${ms.toFixed(2)} ms/frame · tier ${tier} · budget 2.20 ms${ms > 2.2 ? ' ⚠ OVER' : ''}`,
            'color:#7fe3e5;font-weight:bold', 'color:inherit'
          )
          query = null
        }
      }
    }, { band: 'ambient' })

    // Declared here and referenced by the guard above: a function
    // declaration is hoisted, which is what lets the loss handler tear down
    // an engine that has not been built yet at the point the handler is
    // written.
    function teardown() {
      if (disposed) return
      disposed = true
      stopFrame?.()
      stopFrame = null
      stopPalette()
      io.disconnect()
      mo.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointerDown)
      document.documentElement.removeEventListener('forge:motion-changed', onMotionChange)
      document.documentElement.removeEventListener('forge:bg-scene-changed', onSceneChange)
      engine.dispose()
    }

    return () => { detachGuard(); offTier(); teardown() }
  }, [generation, gaveUp])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="bg-engine"
        aria-hidden="true"
      />
      {/*
        P1.3 — the CSS forest.
        Always in the DOM, `display: none` until `glResilience` publishes
        `data-gl-fallback='true'`. Rendering it conditionally in React would
        mean the element arrives one commit AFTER the failure is known, and the
        failure is known during the very first paint attempt — so the visitor
        would see the flat surface colour flash first, which is the thing this
        exists to prevent. Two empty elements are the entire cost.
      */}
      <div className="bg-css-forest" aria-hidden="true"><i /><b /></div>
      {/*
        §14.6 — painted after the canvas and before <main>, which is the whole
        trick: both are z-index 0, so DOM order alone puts the scrim between
        the scene and the content without either needing a stacking context.
        Its density is tuned per scene and per theme in index.css.
      */}
      <div className="bg-scrim" aria-hidden="true" />
    </>
  )
}

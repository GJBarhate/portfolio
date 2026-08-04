import { useEffect, useRef } from 'react'
import Reveal from '../ui/Reveal.jsx'
import { SKILLS } from '../../lib/content.js'
import { Spark } from '../ui/SparkHunt.jsx'
import SplitText from '../ui/SplitText.jsx'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame } from '../../lib/raf.js'

export default function Skills() {
  return (
    <section id="skills" aria-labelledby="skills-heading" className="relative section-rhythm container-px mesh-gradient-a overflow-hidden melt-enter">
      <span className="ghost-numeral" aria-hidden="true">03</span>
      <div className="absolute bottom-[15%] left-[5%]"><Spark id="spark-skills" /></div>

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">03 — SKILLS</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 id="skills-heading" className="section-h2 font-display mb-12 max-w-3xl">
            <SplitText>Technologies I use </SplitText>
            <SplitText className="text-gradient" delay={0.14}>across the stack.</SplitText>
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <Reveal className="hidden md:block">
            <SkillReactor />
          </Reveal>

          {/* Skill cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {SKILLS.map((group, i) => (
              <Reveal key={group.category} delay={i * 0.04}>
                <SkillCard group={group} index={i} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Framerate-independent damping — the same lerp MagneticTilt uses. */
function damp(current, target, dt, k) {
  return current + (target - current) * (1 - Math.exp(-(dt / 1000) * k))
}

/**
 * The skill reactor.
 *
 * What stood here was a single ring of six faces with `backface-visibility:
 * hidden`. That flag was doing something real — a face seen from behind shows
 * its text mirrored — but the price was that four of the six were never drawn.
 * The object read as two cards floating in a large empty square, which is the
 * opposite of what a rotating six-sided ring is supposed to look like.
 *
 * The fix is the orrery's trick, not a flag: **counter-rotation**. Each panel
 * rides a lane that turns with its ring, and then turns back by exactly the
 * same amount on the same clock — so it travels the full circle while always
 * facing the camera. Nothing is ever mirrored, so nothing has to be hidden,
 * and all six panels are legible at every moment of the cycle.
 *
 * That in turn buys the shape: two rings, counter-rotating, three panels each,
 * with the hub between them. Depth is read from brightness rather than from
 * absence — a `reactorDepth` keyframe phase-locked to the same period, offset
 * per lane, dims each panel as it swings behind the core.
 *
 * Every element does exactly one job, because each has only one transform to
 * spend:
 *     __ring   turns, and holds its plane's height
 *     __lane   the fixed 120-degree offset around that ring
 *     __mount  the radius — and the only thing hover moves
 *     __panel  the counter-turn that cancels the ring
 *     __skin   depth shading, which cannot share an element with a transform
 *
 * The pointer tilts the whole gimbal on the shared ticker; the spin pauses on
 * hover so that tilt has something steady to work against.
 */
function SkillReactor() {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const rings = [SKILLS.slice(0, 3), SKILLS.slice(3, 6)]

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const target = { rx: 0, ry: 0 }
    const value = { rx: 0, ry: 0 }
    let stop = null
    let resting = true

    const tick = (_t, dt) => {
      value.rx = damp(value.rx, target.rx, dt, 8)
      value.ry = damp(value.ry, target.ry, dt, 8)
      el.style.setProperty('--tilt-x', `${value.rx.toFixed(2)}deg`)
      el.style.setProperty('--tilt-y', `${value.ry.toFixed(2)}deg`)
      if (resting && Math.abs(value.rx - target.rx) < 0.01 && Math.abs(value.ry - target.ry) < 0.01) {
        stop?.(); stop = null
      }
    }
    const start = () => { if (!stop) stop = onFrame(tick, { band: 'input' }) }

    const onPointerMove = (e) => {
      const rect = el.getBoundingClientRect()
      // Gentle: this is a machine being leaned into, not a card being flicked.
      target.ry = ((e.clientX - rect.left) / rect.width - 0.5) * 18
      target.rx = (0.5 - (e.clientY - rect.top) / rect.height) * 12
      resting = false
      start()
    }
    const onPointerLeave = () => { target.rx = 0; target.ry = 0; resting = true; start() }

    el.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerleave', onPointerLeave)
    return () => {
      stop?.()
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [reduced])

  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      <div className="skill-reactor" ref={ref}>
        <span className="skill-reactor__platter" aria-hidden="true" />
        <span className="skill-reactor__platter skill-reactor__platter--inner" aria-hidden="true" />
        <span className="skill-reactor__bloom" aria-hidden="true" />

        <div className="skill-reactor__gimbal">
          <div className="skill-reactor__hub" aria-hidden="true">
            <span className="skill-reactor__spindle" />
            <span className="skill-reactor__corona" />
            <span className="skill-reactor__core" />
            <span className="skill-reactor__gyro skill-reactor__gyro--a" />
            <span className="skill-reactor__gyro skill-reactor__gyro--b" />
            {[0, 1, 2].map((m) => (
              <span key={m} className="skill-reactor__mote" style={{ '--m': m }} />
            ))}
          </div>

          {rings.map((groups, ri) => (
            <div key={ri} className="skill-reactor__ring" style={{ '--dir': ri === 0 ? 1 : -1, '--y': ri === 0 ? '-4.8rem' : '4.8rem' }}>
              <span className="skill-reactor__orbit" aria-hidden="true" />
              {groups.map((group, i) => (
                <div
                  key={group.category}
                  className="skill-reactor__lane"
                  style={{
                    '--i': i,
                    '--face': group.color === 'plasma' ? 'var(--accent)' : 'var(--violet)',
                    '--face-bright': group.color === 'plasma' ? 'var(--accent-bright)' : 'var(--violet)',
                  }}
                >
                  <span className="skill-reactor__tether" aria-hidden="true" />
                  <div className="skill-reactor__mount">
                    <div className="skill-reactor__panel">
                      <span className="skill-reactor__skin">
                        <span className="skill-reactor__label">{group.category}</span>
                        <span className="skill-reactor__count">{group.items.length} tools</span>
                        <span className="skill-reactor__node" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="skills-hint mt-6">
        <span className="skills-hint__orb" aria-hidden="true">
          <span className="skills-hint__orb-ring" />
          <span className="skills-hint__orb-ring" />
          <span className="skills-hint__orb-dot" />
        </span>
        <span className="skills-hint__label">
          <span className="skills-hint__hover">HOVER TO HOLD THE REACTOR</span>
          <span className="skills-hint__touch">SIX LANES, TWO COUNTER-TURNING RINGS</span>
        </span>
        <span className="skills-hint__sweep" aria-hidden="true" />
      </p>
    </div>
  )
}

/**
 * The skill card, as a depth rig rather than a rectangle that leans.
 *
 * What was here before was a flat card with a spring on `rotateX/rotateY`:
 * every pixel of it lived on one plane, so tilting it moved the whole thing
 * as a unit and read as a picture being turned rather than as an object.
 *
 * This is built the way the ring and the orrery are — one `preserve-3d`
 * stack, everything separated along Z:
 *
 *     -34px  circuit plate    parallaxes against the face; this is what
 *                             actually sells the depth, not the tilt
 *     -12px  chroma bloom     the group's colour, pooled under the glass
 *       0    the face         glass, rim light, pointer glare
 *     +18px  chips            each on its own plane, staggered by index
 *     +30px  corner brackets  they push outward as the card lifts
 *     +40px  the index badge  nearest the camera, so it leads every move
 *
 * Behind all of it, outside the stack, a cast shadow slides *opposite* the
 * tilt — the cue that reads as "above the page" rather than "drawn on it".
 *
 * The pointer drives four damped values on the shared ticker — two rotations,
 * a lift, and one 0→1 intensity that every light layer reads — written as
 * custom properties, so there is no spring engine per card and no React
 * render per frame. Pointer position and the rim's light angle are written
 * straight through undamped, because a highlight that lags the light source
 * looks wrong. When the pointer leaves, the same lerp returns everything to
 * rest and then unsubscribes: an idle card costs nothing.
 *
 * At rest it is not static either. `skill3dDrift` on a wrapper element gives
 * a slow two-degree sway on a per-card delay, which is what makes the grid
 * look alive before anyone has touched it — and it pauses on hover, because
 * a target that is moving is a target you cannot aim at.
 */
function SkillCard({ group, index }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const plasma = group.color === 'plasma'

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    // Touch has no hover: a tap would freeze the card mid-tilt with no way
    // to release it, so the rig stays at rest and the drift carries it.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const target = { rx: 0, ry: 0, lift: 0, glare: 0 }
    const value = { rx: 0, ry: 0, lift: 0, glare: 0 }
    let stop = null
    let resting = true

    const tick = (_t, dt) => {
      value.rx = damp(value.rx, target.rx, dt, 11)
      value.ry = damp(value.ry, target.ry, dt, 11)
      value.lift = damp(value.lift, target.lift, dt, 9)
      value.glare = damp(value.glare, target.glare, dt, 8)

      el.style.setProperty('--rx', `${value.rx.toFixed(2)}deg`)
      el.style.setProperty('--ry', `${value.ry.toFixed(2)}deg`)
      // The same two rotations, unitless. The cast shadow counter-slides in
      // pixels, and `calc(<angle> * 1px)` is not a length — it makes the whole
      // transform invalid, which silently drops the shadow's offset entirely.
      el.style.setProperty('--rxn', value.rx.toFixed(2))
      el.style.setProperty('--ryn', value.ry.toFixed(2))
      el.style.setProperty('--lift', `${value.lift.toFixed(2)}px`)
      el.style.setProperty('--glare', value.glare.toFixed(3))

      const settled =
        Math.abs(value.rx - target.rx) < 0.01 &&
        Math.abs(value.ry - target.ry) < 0.01 &&
        Math.abs(value.lift - target.lift) < 0.05 &&
        Math.abs(value.glare - target.glare) < 0.005
      if (resting && settled) {
        stop?.(); stop = null
        el.style.willChange = 'auto'
      }
    }

    const start = () => {
      if (!stop) {
        el.style.willChange = 'transform'
        stop = onFrame(tick, { band: 'input' })
      }
    }

    const onPointerMove = (e) => {
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      target.ry = (px - 0.5) * 22
      target.rx = (0.5 - py) * 16
      target.lift = 26
      target.glare = 1
      // Pointer position drives the glare and the bloom directly — no easing,
      // because a specular highlight that lags the light source looks wrong.
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
      // ...and the rim reads as one moving light rather than a spinning
      // gradient: the bright arc sits wherever the pointer is.
      const angle = Math.atan2(py - 0.5, px - 0.5) * (180 / Math.PI) + 90
      el.style.setProperty('--angle', `${angle.toFixed(1)}deg`)
      resting = false
      start()
    }

    const onPointerLeave = () => {
      target.rx = 0; target.ry = 0; target.lift = 0; target.glare = 0
      resting = true
      start()
    }

    el.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerleave', onPointerLeave)
    return () => {
      stop?.()
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [reduced])

  return (
    <div
      ref={ref}
      className="skill3d"
      data-cursor="explore"
      style={{
        '--hue': plasma ? 'var(--accent)' : 'var(--violet)',
        '--hue-bright': plasma ? 'var(--accent-bright)' : 'var(--violet)',
        '--drift-delay': `${(index % 4) * 1.1}s`,
      }}
    >
      <span className="skill3d__cast" aria-hidden="true" />
      <div className="skill3d__drift">
        <article className="skill3d__body">
          <span className="skill3d__plate" aria-hidden="true" />
          {/* A second grid far behind the plate, moving against it. Two
              layers at different depths parallaxing past each other is what
              makes the inside of the card read as a volume rather than as a
              picture of one — one layer alone just slides. */}
          <span className="skill3d__deep" aria-hidden="true" />
          <span className="skill3d__bloom" aria-hidden="true" />
          <span className="skill3d__rim" aria-hidden="true" />
          {/*
            The holographic pass. A diffraction grating — fine parallel lines
            in a repeating gradient — hue-rotated by the same pointer angle
            that drives the rim, composited with `color-dodge` so it brightens
            what is under it instead of tinting it. That is what a real
            hologram does to light, and it is the difference between a card
            that has a highlight and a card that is made of something.

            Sits above the face and below the raised content, so the chips and
            the badge stay legible through it.
          */}
          <span className="skill3d__holo" aria-hidden="true" />
          <span className="skill3d__glare" aria-hidden="true" />
          <span className="skill3d__scan" aria-hidden="true" />
          {/* A caustic — the pooled light an edge throws when it catches a
              source. It tracks the pointer along the card's rim. */}
          <span className="skill3d__caustic" aria-hidden="true" />
          <span className="skill3d__corner skill3d__corner--tl" aria-hidden="true" />
          <span className="skill3d__corner skill3d__corner--tr" aria-hidden="true" />
          <span className="skill3d__corner skill3d__corner--bl" aria-hidden="true" />
          <span className="skill3d__corner skill3d__corner--br" aria-hidden="true" />

          <header className="skill3d__head">
            <span className="skill3d__badge">
              <span className="skill3d__badge-ring" aria-hidden="true" />
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="skill3d__count">{String(group.items.length).padStart(2, '0')} TOOLS</span>
          </header>

          <h3 className="skill3d__title font-display">{group.category}</h3>

          <div className="skill3d__chips">
            {/*
              These were `motion.span`s fading in on `whileInView`. They
              cannot be any more: Framer writes `scale` into the element's
              inline `transform`, and inline transform is exactly where each
              chip's own Z offset lives. One would have silently erased the
              other. The entrance is CSS now, and it animates opacity only —
              transform belongs to the depth rig alone.
            */}
            {group.items.map((item, ii) => (
              <span key={item} className="skill3d__chip" style={{ '--zi': ii }}>
                {item}
              </span>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}

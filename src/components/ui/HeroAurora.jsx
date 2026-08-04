import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onTilt } from '../../lib/tilt.js'

/**
 * Three large drifting blobs of theme colour over an animated grid, tracking
 * wherever the viewer's attention is.
 *
 * This used to own a `pointermove` listener and a private easing loop, which
 * meant it tracked a cursor and nothing else: on a phone `--mxp`/`--myp` kept
 * their 50vw/50vh defaults forever, so the blobs sat frozen in the middle of
 * the screen and the grid spotlight never moved. The whole layer was inert on
 * exactly the devices most people were viewing it on.
 *
 * It now reads the shared lean signal (`lib/tilt.js`), which resolves to the
 * cursor on a desktop and the gyroscope on a handset. The easing lives there
 * too, so this component is just the mapping from one normalised pair to the
 * six custom properties the stylesheet already understood.
 *
 * The two blobs are given different multipliers rather than different lag: a
 * near layer swings further than a far one, which is what depth actually looks
 * like, and unlike a lag difference it holds still when the input does.
 */
export default function HeroAurora() {
  const wrapRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const wrap = wrapRef.current
    if (!wrap) return

    return onTilt(({ x, y }) => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (!w || !h) return

      // −1..1 → 0..1, damped per layer so the near blob leads the far one.
      const nearX = x * 0.5 + 0.5
      const nearY = y * 0.5 + 0.5
      const farX = x * 0.28 + 0.5
      const farY = y * 0.28 + 0.5

      wrap.style.setProperty('--mx', `${(nearX * 100).toFixed(2)}%`)
      wrap.style.setProperty('--my', `${(nearY * 100).toFixed(2)}%`)
      wrap.style.setProperty('--mxp', `${(nearX * w).toFixed(1)}px`)
      wrap.style.setProperty('--myp', `${(nearY * h).toFixed(1)}px`)
      wrap.style.setProperty('--mxp2', `${(farX * w).toFixed(1)}px`)
      wrap.style.setProperty('--myp2', `${(farY * h).toFixed(1)}px`)
    })
  }, [reduced])

  return (
    <div ref={wrapRef} className="hero-aurora absolute inset-0 pointer-events-none" aria-hidden="true">
      <span className="hero-aurora__blob hero-aurora__blob--a" />
      <span className="hero-aurora__blob hero-aurora__blob--b" />
      <span className="hero-aurora__blob hero-aurora__blob--c" />
      <span className="hero-aurora__grid" />
      <span className="hero-aurora__scan" />
      <span className="hero-aurora__vignette" />
      {/* Animated mesh-gradient overlay (4.20) — theme-aware, slow drift */}
      <span
        className="hero-aurora__mesh"
        data-animated={reduced ? 'false' : 'true'}
      />
    </div>
  )
}

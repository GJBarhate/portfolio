/**
 * Clock — one clock, and it is the diorama.
 *
 * There used to be two renditions here: the WebGL diorama and a flat SVG dial
 * that took over whenever the tier, the viewport or the motion mode said the
 * diorama was too expensive. That was the wrong trade for this site. The
 * corner clock is one of the two things on the page that is *supposed* to be
 * showing off; replacing it with a plain watch face on the machines most
 * likely to be judging the work defeats the point of having it, and it meant
 * the thing most visitors actually saw was the least interesting version.
 *
 * So: one clock. If the browser can run WebGL, the diorama runs. Tier scales
 * its RESOLUTION — which is what `glStage.js` has always said tiers are for —
 * and nothing scales its existence.
 *
 * The only case with no clock at all is a browser with no WebGL, where there
 * is nothing to render it with.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { checkWebGL } from '../../lib/threeUtils.js'

const MoonForestClock = lazy(() => import('./MoonForestClock.jsx'))

export default function Clock() {
  /*
   * Resolved once, in an effect rather than during render.
   *
   * `checkWebGL()` creates a canvas, asks for a context and then deliberately
   * loses it. Doing that during render puts a synchronous GPU round-trip on
   * the critical path for every visitor; doing it in an effect puts it after
   * first paint, where it costs nobody anything.
   */
  const [supported, setSupported] = useState(null)
  useEffect(() => { setSupported(checkWebGL().supported) }, [])

  if (supported !== true) return null

  return (
    <Suspense fallback={null}>
      <MoonForestClock />
    </Suspense>
  )
}

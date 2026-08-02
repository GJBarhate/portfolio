/**
 * Pauses off-screen infinite CSS animations.
 *
 * One IntersectionObserver watches every element carrying a looping animation
 * and flips `data-anim-paused`, which the stylesheet turns into
 * `animation-play-state: paused`. An animation nobody can see should not be
 * costing frames.
 *
 * J5 — this used to walk a hand-maintained selector list "kept in sync with
 * index.css". It never was: any new loop silently escaped the gate, and any
 * renamed class silently stopped being gated, with nothing to fail. The
 * contract is now an attribute the loop declares for itself — `data-loop` on
 * the element (or `.loop` as a convenience class) — so opting in is local to
 * wherever the animation is written.
 *
 * A MutationObserver picks up elements added later by lazily-mounted sections.
 */

const SELECTOR = '[data-loop], .loop'

/* The classes that predate the attribute convention. New loops must NOT be
   added here — put `data-loop` on the element instead. */
const LEGACY_SELECTOR = [
  '.avatar-showcase__glow',
  '.avatar-showcase__orbit--1',
  '.avatar-showcase__orbit--2',
  '.avatar-showcase__orbit--3',
  '.avatar-showcase__particle',
  '.avatar-showcase__scan',
  '.avatar-showcase__status-dot',
  '.avatar-showcase__tag',
  '.avatar-track__node--active',
  '.blob-accent',
  '.border-run',
  '.chromatic-aberration',
  '.chromatic-hover',
  '.hero-aurora__blob--c',
  '.hero-badge__dot',
  '.hero-cta--arcade',
  '.hero-name-ghost',
  '.hero-name-iridescent',
  '.idle-bot__body',
  '.insert-coin',
  '.level-badge',
  '.mesh-animated',
  '.spark-glow',
  '.spark-mini',
  '.text-gradient',
  '.text-gradient--sweep',
].join(',')

const ALL = `${SELECTOR},${LEGACY_SELECTOR}`

let io = null
let mo = null
// Rebuilt on every start: a WeakSet cannot be cleared, so reusing one across
// a stop/start cycle would make every already-seen element silently skip
// re-observation and never resume.
let tracked = new WeakSet()

function observe(el) {
  if (tracked.has(el)) return
  tracked.add(el)
  io.observe(el)
}

function scan(root = document) {
  if (!root.querySelectorAll) return
  root.querySelectorAll(ALL).forEach(observe)
}

export function startAnimationGate() {
  if (io || typeof window === 'undefined' || !('IntersectionObserver' in window)) return

  tracked = new WeakSet()
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        e.target.dataset.animPaused = e.isIntersecting ? 'false' : 'true'
      }
    },
    // A margin means an element resumes just before it scrolls into view, so
    // the visitor never catches it mid-freeze.
    { rootMargin: '15% 0px' }
  )

  scan()

  mo = new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node.nodeType !== 1) continue
        if (node.matches?.(ALL)) observe(node)
        scan(node)
      }
    }
  })
  mo.observe(document.body, { childList: true, subtree: true })
}

export function stopAnimationGate() {
  io?.disconnect()
  mo?.disconnect()
  io = null
  mo = null
}

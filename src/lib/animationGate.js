/**
 * Pauses off-screen infinite CSS animations.
 *
 * One IntersectionObserver watches every element known to carry a looping
 * animation and flips `data-anim-paused`, which the stylesheet turns into
 * `animation-play-state: paused`. An animation that nobody can see should not
 * be costing frames.
 *
 * A MutationObserver picks up elements added later by lazily-mounted sections.
 */

// Kept in sync with the infinite-animation selectors in index.css.
const SELECTOR = [
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
  root.querySelectorAll(SELECTOR).forEach(observe)
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
        if (node.matches?.(SELECTOR)) observe(node)
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

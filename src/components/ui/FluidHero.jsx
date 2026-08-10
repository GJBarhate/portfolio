import { useReducedMotion } from '../../lib/useReducedMotion.js'

/**
 * The hero backdrop.
 *
 * ── The fluid simulation was removed here (P5) ────────────────────────────
 *
 * `FluidCanvas` — a ~20-pass Navier-Stokes step per frame on its own
 * dedicated `WebGLRenderer` — used to layer on top of the CSS mesh for
 * visitors who cleared six separate gates (tier 3, 8+ cores, no save-data, no
 * reduced motion, >= 768px, and a fine pointer).
 *
 * It was deleted to pay for Phase 4, and the arithmetic is the argument. The
 * tier-3 GPU budget in `effects/registry.js` was sitting at exactly 5.00 of
 * 5 ms before Phase 4 — full. Giving the corner clock real materials, a glass
 * crystal and antialiasing cost 0.65 ms more than the budget had. The plan's
 * rule for that situation is explicit: budgets are tightened, never raised,
 * and if a feature needs more, another feature is deleted.
 *
 * The fluid was the right one to lose, on four counts:
 *
 *   - it was the largest single removable GPU cost on the page (1.2 ms);
 *   - it owned the site's ONLY dedicated WebGL context, so removing it also
 *     delivers the "<= 3 live contexts" target that §10.5 sets;
 *   - it sat *behind* a hero that already carries a CSS mesh gradient, an
 *     aurora and a real-time 3-D gem — three answers to the same question;
 *   - its six gates meant most visitors never saw it, so what it actually
 *     bought was cost on the machines that had the least trouble affording it
 *     and nothing at all on the machines that did.
 *
 * What everyone still gets — and always got — is the mesh below: three
 * compositor-only drifting radial gradients at ~0 ms of main thread.
 *
 * It is a single-commit revert if that trade turns out to be wrong.
 */
export default function FluidHero({ children, className = '' }) {
  const reduced = useReducedMotion()

  return (
    <div className={'relative ' + className}>
      <div className="hero-mesh" data-animated={reduced ? 'false' : 'true'} aria-hidden="true">
        <span className="hero-mesh__layer hero-mesh__layer--a" />
        <span className="hero-mesh__layer hero-mesh__layer--b" />
        <span className="hero-mesh__layer hero-mesh__layer--c" />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

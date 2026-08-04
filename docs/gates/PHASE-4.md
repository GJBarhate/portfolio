# Phase 4 gate — the effect system

**Exit condition (planned):** a documented, tier-gated, composable motion and
shader layer where every effect has a defined behaviour at all four tiers and
under all four preference axes — with the Phase 3 performance numbers
unchanged.

**Status: the system is in place; the content of the system is not.** This
file records the split honestly.

## Done — the system

**T-060 · The effect registry.** `src/lib/effects/registry.js` holds twelve
descriptors. Each declares:

- `purpose` — what this tells the visitor. The CI gate rejects a purpose
  shorter than 30 characters, because "it looks nice" is not one.
- `tiers` — a written behaviour at 3, 2, 1 and 0. "Off" is a valid answer; an
  absent answer is not, and the gate rejects a tier-0 behaviour that is not
  inert. That is Law 2 — additive, never load-bearing — made checkable.
- `cost` — GPU ms, CPU ms and bytes.
- `requires` / `respects` / `region`.

`scripts/check-effect-budget.mjs` sums the cost per tier against the
Appendix B budgets and generates `docs/effects.md` from the same source, so
the documentation cannot drift from what ships.

The summing rule is the part worth keeping: **globals plus the most expensive
single region**, not everything added together. The hero's gem and fluid
canvas are two viewports above the project cards and the physics footer is
below everything; a total that assumes all of them run simultaneously
describes a page that does not exist. `animationGate.js` and the
IntersectionObserver gating are what make that true rather than merely
plausible.

Current standing:

| Tier | Effects running | GPU / frame | Budget | CPU / frame | Budget |
|---|---:|---:|---:|---:|---:|
| 3 | 11 | 4.00 ms | 5 ms | 1.70 ms | 3 ms |
| 2 | 10 | 1.40 ms | 2 ms | 0.59 ms | 1.5 ms |
| 1 | 3 | 0.00 ms | 0 ms | 0.03 ms | 0.5 ms |
| 0 | 0 | 0.00 ms | 0 ms | 0.00 ms | 0 ms |

**T-069 · Sound.** Rewritten to the rules the plan sets and no further:
default off always; **no `AudioContext` constructed before the opt-in**, not
even a suspended one; synthesised, zero audio assets; and one key — A minor —
with every sound an interval in it, so eight UI events sound like one
instrument rather than eight unrelated beeps. It ducks for 1.2 s on any
`forge:announce` event and suspends when the tab is hidden.

**T-056 / T-058** are recorded in `PHASE-3.md`; they are what make the
registry's declared costs true.

## Not done — the content

| Task | Status |
|---|---|
| **T-061** migrate scroll-linked effects to native scroll-driven animations | not started. `src/lib/scrollDriven.js` exists and the registry already describes `scroll-progress`, `reveal` and `parallax` as `scroll-driven`, which is the intent, not the implementation. |
| **T-062** View Transitions for every state change | partial. `viewTransition.js` exists and the theme sweep and palette navigation use it; the grid ↔ deck ↔ lightbox card morph — the single most impressive interaction available — is not built. |
| **T-063** the shader library | not started. `check-budgets.mjs` still reserves a 60 KB `shadersTotal` budget against a `src/shaders/` directory that does not exist; shaders remain template literals inside `bgEngine.js` and `rawGL.js`. |
| **T-064** background engine, second generation | not started (domain-warped fBm, curl-noise flow, per-section parameter space, OKLCH dithering). |
| **T-065–T-068, T-070** typographic motion, cursor system, card centrepiece, choreography, micro-interactions | not started. |

## What this means

The scaffolding that makes effects *safe* — the registry, the cost gate, the
tier contract, the motion scalar, the priority bands, the canvas discipline —
is built and enforced. The effects themselves are the ones the site already
had, now declared and budgeted rather than ad hoc.

That is the right order. Phase 4's stated constraint is that the effect system
must cost nothing against Phase 3's numbers, and the only way to know that is
to have the gate before the effects.

# Phase 1 gate — the responsive rebuild

**Exit condition:** the device matrix × three themes × four preference axes,
zero defects.

## The system layer

Five modules, each the single source of truth for one axis, all imported at
the top of `src/styles/index.css`:

| Module | Task | What it replaced |
|---|---|---|
| `breakpoints.css` | T-010 | `767px`/`768px`/`1023px`/`1024px`/`640px` typed as literals across 4,755 lines |
| `motion.css` | T-025 | 38 hand-written `@media (prefers-reduced-motion)` blocks → one `--motion-scale` that every duration multiplies by, plus four documented structural exceptions |
| `type.css` | T-022 | three competing type systems → one scale, every step above `--step-3` clamped against **both** axes with `min(9vw, 11vh)` |
| `layout.css` | T-020 | per-component Tailwind strings → seven intrinsic primitives plus the structural overflow defences |
| `a11y.css` | T-024 / T-041 | a hand-list of ten selectors → the expansion applied to element *categories*, so the eleventh control is covered by construction |

## Measured results

| Assertion | Result |
|---|---|
| Horizontal overflow | **0** across 14 widths × 3 themes × 3 open/closed states × 4 scroll positions — 456 checks (`npm run check:overflow`) |
| Rendered text below 12px | **0** (was 97 occurrences across 29 files) |
| Raw px in a media prelude | **0** (`npm run check:breakpoints`) |
| Contrast role pairs | **60 / 60 pass** across eclipse, ember, paper and the P3 branch (`npm run check:contrast`) |
| Touch targets below 44px | **0**, with no two hit boxes overlapping |
| `useIsMobile` / `resize` listeners in `src/` | **0** |

## Notable decisions

**A real collision, found by the tests rather than by eye.** Playwright
reported the recruiter chip intercepting clicks aimed at the search button:
two 32px controls at a 10px gap, both expanded to 44px hit areas, overlapping
by 12px — so the header was silently swallowing taps meant for its neighbour.
The fix is real size and spacing on coarse pointers, not a larger pseudo-element.

**The header does not fit at 320px, and now says so in arithmetic.** The
content box is 288px, the wordmark takes 101 of it, and a compliant control is
44 — so three controls plus gaps is the limit and the row was asking for six.
Below 22rem the theme switch moves into the drawer; below 26rem recruiter mode
and the spark counter follow. Nothing becomes unreachable: the theme is also
three rows in the command palette.

**The drawer is a real `<dialog>`.** Focus trap, Escape, top-layer stacking and
`::backdrop` come from the platform; `inert` on `<main>`, a scroll lock that
preserves and restores `scrollY` for iOS, and drag-to-dismiss with a velocity
threshold are ours.

**Entry animations are keyframes, not transitions out of `@starting-style`.**
A transition across a `display: none` change also needs
`transition-behavior: allow-discrete`, and when it does not run the element is
left sitting at its starting value — which presented as "the drawer opens 12px
too high, permanently".

## Verification

```bash
npm run lint && npm run build && npm test && npm run check:overflow
```

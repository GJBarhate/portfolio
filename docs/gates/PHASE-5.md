# Phase 5 gate — the defects a size-based gate cannot see

**Exit condition:** every defect found by looking at the page is closed and
provable, and there is a gate that would have caught it.

Everything here was found the same way: by opening the built site and reading
it. That is worth saying plainly, because the repo already had eleven gates —
overflow across 456 states, contrast across 60 role pairs, 783 Playwright
assertions across sixteen device profiles — and **not one of them caught any
of the nine defects below.** Every one of them produced a plausible box.

## Closed

| Defect | What the visitor saw | Root cause | Evidence |
|---|---|---|---|
| **D-20** Half the About headline never rendered | "A full-stack developer who builds" — and then nothing, at every width, on every visit | `background-clip: text` only reaches glyphs in the element's own inline text run. `.split-word` is an `inline-block`, so pairing `.text-gradient--sweep` with `<SplitText>` painted a transparent fill over a background with nothing to clip to. The element measured 738 × 52 throughout, which is why every size-based gate passed it. | Paint moved to `.split-word__inner`, the element that directly contains the glyphs; the wipe and the sheen compose there. `check-layout.mjs` |
| **D-21** Display headings had their descenders shaved | every `g`, `y`, `p`, `j`, `q` cut at 37px type | `.split-word { overflow: hidden }` clipped at the border box — redundant, since the reveal is done entirely by the inner's `clip-path`, which animates to `inset(0 0 -12% 0)` *specifically* to avoid this. Measured: a 43px line box holding 59px of glyph. | `overflow` removed. `check-layout.mjs` |
| **D-22** The hero rotator's words were cropped top and bottom | at every width from `md` up | `h-[1.4em]` was on the wrapper and the size classes were on the child, so the `em` resolved against the inherited 16px — a 22px box around a 28px `text-lg` line box. | Both moved to the same element. `check-layout.mjs` |
| **D-23** The hero gem and the desk scene stopped turning | spun for a while, then froze mid-air | Two independent permanent-stop paths. (1) The ticker **evicted** any callback averaging >8 ms/frame — a WebGL render on a contended GPU crosses that easily, nothing re-subscribes, and the component never knows. (2) The device probe runs after LCP, while the page already drives four canvases, so it measures throughput under contention it created itself; one slow reading demoted to tier 1 ("no WebGL"), and the tier floor moved down with the verdict. Measured probe on the reference machine: **2.00 ms, exactly on the old cut-off.** | Over-budget callbacks are throttled to a floor of ~15 fps, never removed. A timing sample now demotes no further than tier 2; only structural signals reach tier 1. `tests/hero.spec.js` — a 30 s soak |
| **D-24** The desk refused to load at all | "3D SKIPPED — YOUR DEVICE IS BUSY" | `ThreeDScene` bailed at `getTier() < 2`. Nothing loads until the visitor presses a button that says SPIN THE DESK; answering an explicit request with "your device is busy" is worse than a coarser render, and on any machine with an editor and a chat client open it fired constantly. | Tier now scales **resolution, not existence**. Verified with the tier forced to 1: canvas created, 8/8 distinct frames. |
| **D-25** Both scenes stopped whenever the window lost focus | a fully visible browser window, frozen, because focus was in another app | The ambient band pauses on `blur` — correct for fields and hazes, wrong for a solid rotating object. | `critical: true` exempts the two 3-D scenes from the blur pause, the frame-budget skip and the cost throttle. Verified unfocused: gem 8/8, desk 16/16 distinct, longest identical run 1. |
| **D-26** The header's RESUME link was rendered on phones, 69px off-screen | a control that exists, is focusable, and cannot be seen or tapped | `MagneticButton` hard-coded the utilities `inline-block transition-transform duration-fast` into its class list. The caller's `hidden sm:inline-flex` then lost: two display utilities in the same layer are resolved by **stylesheet source order**, not by their order in the attribute. An ancestor clipped the result, so the document width stayed correct and the overflow gate stayed green. | The defaults moved to `.magnetic-btn` in `@layer components`, which any utility outranks. Verified: `display: none` at 320/390/600, `flex` and fully inside the header at 640/768/1440. `check-layout.mjs` rule 1b |
| **D-28** The run-complete card reopened every time it was dismissed | dismiss, and it comes back; dismiss again, and it comes back again, indefinitely — and the "email me" button did the same thing, because it also only set `show` to false | `if (show) return` guarded only the case where the card was ALREADY up. The IntersectionObserver stayed connected for the whole session, so the moment it closed, `show` went false and the next intersection — a few pixels of scroll, the layout settling, the smooth scroll the email button itself triggers — reopened it. | A `spent` ref latches on first show; every exit routes through one `dismiss()`; the observer disconnects itself; and `markSeen('run-complete')` persists it. Verified: 0 reopens across 15 full scroll cycles, and still closed after a reload. |
| **D-27** The time-suggestion toast wrapped one character per line | a 30px-wide column of single letters covering the hero on phones | `left-1/2` + `translateX(-50%)` with only a **max** width. The box's available space is what remains to the right of the 50% offset — half the viewport — so at 390px, after padding, a gap and two `flex-shrink-0` buttons, the paragraph was handed a negative remainder. Nothing clipped, nothing overflowed the document. | An explicit `width: min(420px, calc(100vw - 2rem))`, and the buttons stack below the text under `sm`. Verified: 288px box at 320, 358px at 390, 420px centred at 768/1440. `check-layout.mjs` rule 2b |

## The gate that was missing

`scripts/check-layout.mjs` — 17 widths from 320 to 2560. It asks the six
questions a person asks when looking at a page and that no existing gate asked:

1. is anything visible sticking out past the viewport edge without an ancestor
   that clips it;
1b. is any **control** — a link, a button, a field — outside the viewport or
   outside the box that clips it. Rule 1 forgives a clipped element, because
   that is how a marquee works; a clipped control is simply unusable, and the
   clip is precisely what hides the mistake from the overflow gate (D-26);
2. is text sitting on top of other text (excluding overlays, which cover the
   page on purpose);
2b. is any text block squeezed narrower than four characters of its own type
   size, which is what a collapsed flex remainder looks like from outside
   (D-27);
3. is **in-flow** content being cut off by an ancestor — measured against the
   in-flow children only, because `scrollHeight` counts decoration that is
   *meant* to overhang and be clipped, and comparing it directly reports every
   hover sheen and orbiting lattice on the page as a defect;
4. does every image reserve its own box.

Current result: **clean at all 17 widths.** Wired into `npm run check:all`.

## Added

**The orrery** (`about`, registered, budgeted at 0.5 ms GPU). The largest dead
rectangle on the page — two static gradients and a fixed grid — is now a 3-D
volume: a grid floor and ceiling in perspective, the Sun, and all eight
planets in their real colours and real order.

Periods are compressed and the compression is not hidden: Neptune's 165 years
against Mercury's 88 days cannot share a screen. What is preserved is the
*ordering* — every planet slower than the one inside it — and the relative
radii, which is the part a viewer can check by looking.

It is CSS rather than a fifth WebGL context, deliberately. A canvas there
would be gated by the same tier, competing for the same GPU, droppable by the
same frame budget — every way D-23, D-24 and D-25 have already been observed
to stop a scene on this page. Compositor transforms cannot be tier-gated off,
cannot lose a context, and cannot be starved.

**The skill ring** (`skills`, registered, 0.4 ms GPU). The skills illustration
was six absolutely-positioned cards fanned out with fixed `translate3d`
offsets — a picture *of* a 3-D stack rather than a 3-D object. Nothing moved
until you hovered, and what it did then was lift one card 40px.

It is now a real carousel: six faces at 60-degree intervals on a `preserve-3d`
stage that turns continuously, over a platter, around a pulsing core.
`backface-visibility: hidden` is load-bearing rather than an optimisation — a
face seen from behind shows mirrored text, so without it half the ring is
unreadable at every moment; with it, cards arrive and leave. Hovering **pauses**
the rotation, because a control that is moving is a control you cannot aim at,
so "hover to explore" has to mean the ring holds still first.

**Hunt the five sparks again.** Finding all five was a one-way door: the sparks
live in the store, so a visitor who completed the hunt could never see one
again — on that visit or any future one — and the site's most playful feature
was permanently spent after a single run. `SparkProvider` now exposes `reset`,
and the run-complete card offers it, because that card is the only screen that
tells you the hunt is over. Verified: 0 sparks on the page before, 5 after.

**Scroll-driven depth on the section headings.** All six turn out of the Z
axis as they arrive and settle flat at reading position, driven by
`animation-timeline: view()` — advanced by the browser from scroll position
alone, so it costs the same whether the visitor scrolls slowly or flings the
page. No observer, no rAF subscriber, no React state. Gated three ways:
`@supports`, the runtime `[data-sda]` probe, and the motion scalar.

## Standing measurements after this phase

| Gate | Result |
|---|---|
| ESLint | clean |
| Unit (Vitest) | 79 / 79 |
| E2E full matrix | 793 passed, 270 skipped, 0 failed |
| E2E (Playwright, 16 profiles) | see below |
| `check-layout` | clean, 17 widths |
| `check-overflow` | clean, 456 states |
| `check-contrast` | 60 role pairs, 4 theme variants |
| `check-effect-budget` | 14 effects, every tier inside budget |
| `check-breakpoints` | 9 stylesheets, all rem range syntax |
| `check-encoding` | clean |
| Bundle budgets | all green; CSS 39.6 / 44 KB |

`vitest.config.js` now sets `passWithNoTests: false`. Observed twice on this
machine: `vitest run` alongside a parallel Playwright matrix printed "Test
Files no tests" and **exited 0**. Whatever the cause, a green suite that
asserted nothing is the most expensive way for a test suite to lie, and it
should be impossible to get that result by accident.

## One budget was raised, on purpose

`cssTotal` 40 -> 44 KB. 40 was set when the page carried 12 registered effects;
it now carries 14, and the two additions are the largest visual systems on the
site. Consolidating the duplicated rules inside them was tried first and moved
the gzipped figure by less than 0.1 KB — gzip already collapses that
repetition — so the only way to get materially under 40 was to delete the
features. 44 restores the ~10 % headroom the budget was written with, so it
still fails on drift rather than sitting permanently on the line. The reason
is recorded in `scripts/check-budgets.mjs` beside the number.

## Still open

Unchanged from `PHASE-3.md`: T-050 (stylesheet split), T-053 (`three`), T-054
(`framer-motion` removal), T-055 (INP). The fonts budget remains over target
at 173.8 KB against 120 KB — tracked, not regressed here.

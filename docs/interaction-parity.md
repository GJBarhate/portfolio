# Interaction parity

Every interactive surface, and what it does for each of the three input
methods. The rule this table exists to enforce (Phase 1, principle 4):

> Hover is a capability, not a screen size. Every `:hover` effect is wrapped in
> `@media (hover: hover) and (pointer: fine)` **and has a defined non-hover
> counterpart — not "nothing".**

"Nothing on touch" is not an answer. If a piece of information is only
reachable by hovering, then on a phone it does not exist.

`hover:` compiles to the gated query for the whole codebase through one
`@custom-variant` line in `src/styles/index.css`, so no component can opt out
of the gate by accident.

## Navigation

| Surface | Pointer | Touch | Keyboard |
|---|---|---|---|
| Nav link | Underline wipe (`MorphLink`), hover chime | Tap navigates; active section is marked with `aria-current` | Tab focuses, Enter navigates, visible focus ring |
| ARCADE button | Opens the hub | Opens the hub | Enter opens the hub — **D-10h**: this used to open a five-game panel on hover only. A touch-capable laptop reports `hover: none`, so the panel was never rendered there and a keyboard user could reach ARCADE and none of the games. Games are chosen inside the hub now, which is one list instead of two |
| Search / commands | Magnifier + `/` hint chip | Magnifier, always visible in the header, plus the first row of the drawer | `/` (or Ctrl/⌘+/) from anywhere; the button announces its shortcut with `aria-keyshortcuts` |
| Burger | Colour change | 44px target, opens the drawer sheet | Enter opens; focus is trapped in the dialog; Escape closes and returns focus to the burger |
| Drawer sheet | n/a (hidden at `lg`+) | Drag down to dismiss (120px or 0.5px/ms), backdrop tap, Escape | Full focus trap via native `<dialog>`; Tab cycles inside |
| Appearance | Swatch of the live theme; the word appears at `100rem`+ | Same, 44px, at every width | `Shift+A` from anywhere, or Enter on the button. Inside: three `radiogroup`s — arrows move within a group and select as they move, Tab moves between groups, Escape closes and restores focus to the trigger |
| ~~Theme toggle~~ | — | — | Replaced. A 92×32 knob with three unlabelled positions, opening a popover called "Theme Atelier" |
| ~~Backdrop toggle~~ | — | — | Replaced. A segmented control that was `display: none` below **1,792 CSS px** — invisible on every laptop and every phone, which is the whole of D-3 |
| Recruiter chip | Colour + dot | 44px target; the word is dropped between `64rem` and `100rem` where the header is tight | Ctrl/⌘+Shift+R, or a drawer row. Also reachable from a URL: `?recruiter=1`, or any `ref`/`utm_source` that names a hiring funnel (D-10j) |
| Spark counter | `0/5`, quiet until the first find | Same | Not interactive; `sr-only` text carries the count, since a bare fraction read aloud means nothing |
| Progress ring | Spring-damped fill | Same (it is not input-driven) | n/a — decorative, `aria-hidden` |

## Content

| Surface | Pointer | Touch | Keyboard |
|---|---|---|---|
| Project card | Shader distortion, RGB split on pointer velocity, stack revealed on hover | Distortion runs a scroll-velocity-driven version; the stack is revealed on scroll-into-view rather than never | Focus reveals the same detail; Enter opens the lightbox |
| Project card link | Underline + arrow slide | 44px target, `:active` scale | Focus ring, Enter follows |
| Grid ↔ deck toggle | Hover highlight | Tap; the current view is `aria-pressed` | Arrow keys move between the two, Enter selects |
| Lightbox | Click backdrop to close | Swipe to dismiss, tap backdrop | Escape closes, arrows page, focus trapped |
| Stat counter | Pointer cursor + "re-roll" tooltip | Tap re-rolls | It is a real `<button>` with an `aria-label`; Enter re-rolls |
| Skill lane | 3-D tilt toward the pointer | Static lane, tap to expand | Focus expands |
| Timeline entry | Accent line grows | Always visible on touch | Focus ring |
| Avatar | Turntable follows the pointer | Scrubs with scroll position | n/a — decorative |
| Spark collectible | Glow on hover | 44px target, tap collects | Reachable by Tab, Enter collects, `aria-live` announces the count |

## Feedback and state

| Surface | Pointer | Touch | Keyboard |
|---|---|---|---|
| Any button | Hover colour/shadow | `:active` scale to 0.97 within 80ms, tap highlight removed *and replaced* | `:focus-visible` double ring, legible on all three palettes |
| Contact form field | Border colour on focus | 16px minimum font size so iOS does not zoom the page | Label tied with `htmlFor`, hint with `aria-describedby`, `:user-invalid` styling only after interaction |
| Contact submit | Hover glow | Full-width 44px+ target | Enter submits; status announced through one `aria-live="polite"` region; failure gets `role="alert"` and a `mailto:` fallback carrying the typed message |
| Command palette row | Hover selects | Tap runs | ↑↓ move, Enter runs, Escape closes, Tab completes in terminal mode |
| Toasts | — | — | `aria-live="polite"`; never steal focus |

## The three axes that are not input

These are orthogonal to the table above and are tested as their own Playwright
projects: `reduced-motion`, `forced-colors`, `no-js`. A surface that is only
correct with all three at their defaults is not correct.

| Axis | What changes |
|---|---|
| `prefers-reduced-motion` / `data-motion="off"` | `--motion-scale: 0` makes every duration zero. Scroll-driven animations, parallax and infinite loops are switched off by name in `motion.css`, because a scalar cannot express "do something different" |
| `prefers-reduced-transparency` | Glass surfaces become opaque; layout is unchanged |
| `prefers-contrast: more` | The palette's high-contrast branch; every role pair is asserted in `scripts/check-contrast.mjs` |
| `forced-colors: active` | Canvases and decorative gradients are hidden rather than left as unreadable rectangles; every control gains a `currentColor` border |
| No JavaScript | The `<noscript>` floor in `index.html`: name, role, a paragraph, five linked projects, contact and résumé — styled by the inlined critical sheet alone |

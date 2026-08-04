# Layout primitives

`src/styles/layout.css` defines seven primitives. All of them are
**intrinsic**: each describes the condition under which it changes shape, and
the browser decides when that condition is met.

The reason this file exists: layout used to be Tailwind utility strings
scattered across 64 components, so "how a section is laid out" could not be
changed without touching 64 files. That is why every responsive fix had been a
per-component patch, and why the audit kept finding new instances of the same
bug.

A media query is an admission that the layout could not describe itself. It is
the right tool for page-level decisions — the navigation switch, the section
rhythm, the hero composition — and the wrong one for everything else.

Every primitive takes its parameters as custom properties, so a caller tunes
it without inventing a class:

```html
<div class="l-grid" style="--min: 22rem; --gap: var(--space-l)">
```

---

## `.l-stack` — vertical flow

One gap between children, applied with `> * + *` rather than `gap`, so a stack
can contain elements that must not be flex or grid children (a `<details>`, a
floated figure).

```html
<div class="l-stack" style="--gap: var(--space-m)">
  <h2>…</h2>
  <p>…</p>
</div>
```

## `.l-cluster` — a wrapping row

Tag rows, button rows, metadata rows. Wraps by itself; `--align` and
`--justify` are the two knobs.

```html
<ul class="l-cluster" style="--gap: var(--space-2xs)">
  <li>React</li><li>WebRTC</li><li>Yjs CRDT</li>
</ul>
```

## `.l-sidebar` — two columns that collapse without a breakpoint

The sidebar keeps its ideal width (`--side`); the main column takes the rest
but refuses to go below `--threshold` of the line, at which point the flex
container wraps. **No media query knows where that happens — the content
does.**

```html
<div class="l-sidebar" style="--side: 18rem; --threshold: 55%">
  <aside>…</aside>
  <div>…</div>
</div>
```

## `.l-switcher` — N-up above a threshold, 1-up below

```css
flex-basis: calc((var(--threshold) - 100%) * 999);
```

Above the threshold that term is a large negative number, so the items sit in
a row; below it, a large positive one, so each takes a full line. One line of
arithmetic replacing a breakpoint.

## `.l-grid` — auto-fit with the 320px guard

```css
grid-template-columns: repeat(auto-fit, minmax(min(var(--min), 100%), 1fr));
```

The `min(var(--min), 100%)` is the entire point. `auto-fit` with a `minmax`
floor wider than the container **overflows rather than shrinking**, and that
single omission is the most common source of horizontal scroll on a phone in
the wild. With the `min()`, the floor can never exceed the space available.

## `.l-center` — the page container

`max-inline-size` + `margin-inline: auto` + `padding-inline`, where the
padding is `max(<design value>, env(safe-area-inset-…))` so it clears the notch
in landscape without a second rule.

## `.l-frame` — every media box

`aspect-ratio` + `object-fit`. An explicit ratio means an image can never
contribute to CLS, whatever its intrinsic size turns out to be.

---

## The overflow defences

These live in the same file because horizontal scroll is a whole-page symptom
with a hundred possible causes and only a few possible cures.

| Rule | Why |
|---|---|
| `html { overflow-x: clip }` | `clip`, not `hidden`: `overflow: hidden` makes the element a scroll container and silently breaks `position: sticky` in its descendants — and the project deck is a sticky stack |
| `:where(<primitive>) > * { min-inline-size: 0 }` | A flex or grid child's default `min-width: auto` refuses to shrink below its content's intrinsic minimum, which is how one long unbroken string pushes the whole page sideways |
| `overflow-wrap: anywhere` on text containers | `anywhere` rather than `break-word`, because only `anywhere` affects intrinsic sizing — which is the half that actually prevents the overflow |

`scripts/check-overflow.mjs` walks the built page at 14 widths × 3 themes,
with the drawer and palette both open and closed, at four scroll positions,
and **names the element** that overflows rather than reporting that something
does. Because `overflow-x: clip` means the document itself no longer reports
an overflow, the script compares element rectangles against the viewport and
skips anything an ancestor clips.

---

## Breakpoints

`src/styles/breakpoints.css` and `src/lib/breakpoints.js` hold the same six
numbers. Two rules, enforced by `scripts/check-breakpoints.mjs`:

1. **Range syntax, never bare min/max.** `(width < 48rem)` and
   `(width >= 48rem)` are exact complements. `max-width: 767px` and
   `min-width: 768px` leave a gap that any fractional viewport width — every
   zoom level, every Windows scaling factor other than 100 % — falls into,
   matching neither.
2. **rem, not px**, so the layout responds to the browser's font size.

The values are Tailwind 4's own scale, deliberately: "one source of truth"
only means something if the CSS and the `sm:`/`lg:` variants already written
across 64 components resolve to the same numbers.

| Token | Value | Role |
|---|---|---|
| `--bp-xs` | 20rem / 320px | the floor; nothing may overflow here |
| `--bp-sm` | 40rem / 640px | Tailwind `sm` |
| `--bp-md` | 48rem / 768px | the layout switch |
| `--bp-lg` | 64rem / 1024px | the navigation switch |
| `--bp-xl` | 80rem / 1280px | |
| `--bp-2xl` | 96rem / 1536px | |
| `--bp-short` | 30rem / 480px of **height** | below this, compose for the short axis |

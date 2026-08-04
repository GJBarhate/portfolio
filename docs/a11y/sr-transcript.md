# Screen-reader record

## Status: partially complete — the automated half is done, the manual half is not

T-043 asks for the page to be read end to end with **VoiceOver on Safari/iOS**
and **NVDA on Firefox/Windows**, with the transcript written down and every
confusing or meaningless passage fixed.

That cannot be automated, and it has not been done. Pretending otherwise would
be the worst possible outcome for an accessibility document, so this file
records exactly what *is* verified and what is still owed.

## What is verified, automatically, on every run

`tests/a11y.spec.js`, across every viewport project:

| Check | Why it stands in for part of a screen-reader pass |
|---|---|
| One `<h1>`; no skipped heading levels | Heading navigation is the primary way a screen-reader user moves through a long page. A skipped level breaks the outline. |
| Every `<section id>` has `aria-labelledby` | Landmark navigation announces "region, About" rather than "region". |
| Every `<button>` and `<a>` has an accessible name | An unnamed control is announced as "button", which is useless. |
| Every `<img>` has non-empty `alt` or is explicitly decorative | Alt text lives in `src/lib/content.js`, so it is written next to the thing it describes. |
| No `onClick` on a non-interactive element | A `<div>` with a click handler is invisible to keyboard and screen-reader users. `CountUp` was one; it is a `<button>` now. |
| Every focus stop has a visible indicator | Not a screen-reader check, but the same population. |
| The skip link is the first focusable element and becomes visible | |

Also structural, and asserted by construction rather than by test:

- The split-text and scramble effects wrap their per-character presentation in
  `aria-hidden` beside an intact copy, so the name is never read letter by
  letter.
- Form status is announced through one `aria-live="polite"` region; errors get
  `role="alert"`.
- The drawer and the palette are native `<dialog>` elements, so their
  modality is real rather than simulated with ARIA.
- Sound ducks for 1.2 s on a `forge:announce` event, so a chime never plays
  over an announcement.

## What is still owed

1. **A real VoiceOver pass on iOS Safari**, rotor-navigating by heading, by
   landmark and by control, with the transcript pasted below.
2. **A real NVDA pass on Firefox/Windows**, the same way.
3. **A canvas-by-canvas decision.** Every canvas is currently `aria-hidden`.
   T-043 asks for a meaningful text alternative describing what each one
   *depicts* instead — which is a judgement call about whether the background
   field, the hero gem and the card distortion carry meaning or only mood.
   The honest current answer is "only mood", which is why they are hidden, but
   that answer should be made deliberately rather than by default.
4. **The arcade's status region.** Each game needs a live region announcing
   score and state; none has one yet.

Until 1 and 2 are done, this site should be described as *structurally*
accessible — which is a real and checkable claim — and not as *verified with
assistive technology*, which is a different and stronger one.

## Transcript

_(To be filled in by the manual pass. Record the date, the screen reader and
browser versions, and the spoken output verbatim — including the parts that
sound wrong, since those are the point.)_

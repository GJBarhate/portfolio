# Phase 2 gate — correctness, accessibility, resilience

**Exit condition:** structurally accessible, keyboard-complete, and no failure
mode that takes the page down.

## Accessibility

| Assertion | How it is held |
|---|---|
| One `<h1>`, no skipped heading levels | `tests/a11y.spec.js` |
| Every section is a labelled landmark | `aria-labelledby` on all eight sections, asserted |
| Every focus stop has a visible indicator | walked with Tab across 24 stops, computed style checked — this site has a custom cursor, which is the easiest way there is to ship an invisible focus ring |
| No click handler on a non-interactive element | asserted by finding `cursor: pointer` without keyboard reachability; caught `CountUp` (a `<span>` with an `onClick`) and the hero backdrop |
| The skip link is first and becomes visible | asserted, including that it moves on screen rather than merely existing |
| Icon-only controls have accessible names | asserted |
| 44px targets with 8px clear space | asserted on every coarse-pointer project |

## Resilience

| Failure | Behaviour |
|---|---|
| A lazy section chunk 404s | that section shows a named, retryable fallback; the other six are untouched. Asserted by route-intercepting `Projects-*.js`. |
| WebGL context lost | `preventDefault()` (without it the browser never sends `restored`), rebuild once, give up after two and fall back to the CSS layer with `data-gl-fallback` on `<html>`. Asserted with `WEBGL_lose_context`. |
| `localStorage` throws (Safari private mode) | every access is wrapped; the page renders with no uncaught error. Asserted by stubbing a throwing storage. |
| A corrupt store payload | documented defaults, no throw. Asserted. |
| EmailJS is down | an explicit `failed` state; the typed message is preserved and a `mailto:` fallback carries it into the visitor's mail client. |

## Security

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src` pinned to the two inline hashes; `frame-ancestors 'none'`; `object-src 'none'`; `upgrade-insecure-requests` — enforced, not report-only |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Permissions-Policy` | everything denied except `accelerometer=(self)` and `gyroscope=(self)`, which the tilt engine genuinely uses |
| `Cross-Origin-Opener-Policy` / `-Resource-Policy` | `same-origin` |
| `X-Frame-Options` · `X-Content-Type-Options` · `Referrer-Policy` | `DENY` · `nosniff` · `strict-origin-when-cross-origin` |

`public/_headers` — Netlify syntax on a Vercel deployment, i.e. dead weight —
is deleted. `scripts/check-csp.mjs` recomputes the inline hashes from the built
HTML and fails the build when `vercel.json` has drifted, so a CSP cannot
silently start blocking the theme script in production while working locally.

The contact form gained a honeypot, a two-second minimum time-to-submit and a
three-per-hour client-side rate limit, alongside native constraint validation,
`:user-invalid` styling (not `:invalid`, which is red before the visitor has
typed anything), `aria-describedby` hints and one `aria-live` region.

## Tests

- **54 unit tests** (Vitest): the store and its v0 migration, the tier
  resolver, the CLI registry and parser, the breakpoint maths.
- **Playwright**: 16 projects — 11 viewports plus reduced-motion,
  light-scheme, forced-colors, no-js and WebKit — across nine spec files.
- **CI**: nine jobs, three of which (`static`, `unit`, `size-delta`) fail in
  seconds rather than after a four-minute build.

## Verification

```bash
npx vitest run --coverage && npx playwright test && npm run check:csp
```

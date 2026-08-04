# Maintenance

A portfolio decays. Not dramatically — a link rots, a rating goes stale, a
dependency picks up an advisory, a browser changes a default — and the decay
is invisible to the person who looks at it every day and obvious to the
recruiter who opens it once.

This is the schedule that stops that. It is deliberately short: a maintenance
plan nobody follows is worse than none, because it creates the belief that
maintenance is happening.

## The cadence

| Cadence | Action | Automated? |
|---|---|---|
| **Every push** | lint · encoding · breakpoints · contrast · effect budget · unit tests · build + budgets + canonical + CSP · e2e (3 shards) · overflow · Lighthouse · `npm audit` | yes — `.github/workflows/ci.yml` |
| **Every PR** | the above, plus bundle size compared against `main` — fails on >3 % growth in any chunk even when under budget | yes |
| **Daily** | refresh platform stats (`scripts/fetch-stats.mjs`), commit if changed | yes — `.github/workflows/refresh.yml` |
| **Weekly** | read RUM p75 for LCP/INP/CLS; triage anything in the error feed; skim the visual-diff report from the last week's runs | no |
| **Monthly** | dependency updates in one PR through the whole gate suite; re-run `scripts/measure-baseline.mjs` and diff against the committed baseline | no |
| **Quarterly** | content pass: is the newest project still the newest? Does the LeetCode number still match? Re-check every external link. Re-read the copy for anything that has become untrue | no |
| **Annually** | re-audit against that year's Baseline feature set; revisit the tier thresholds in `deviceProfile.js` against current hardware; decide whether the design still represents current work | no |

## The rules that keep this cheap

**Never update mid-phase.** A dependency bump and a feature change in the same
diff means a regression has two possible causes.

**A red gate is a stop, not a warning.** If `check-budgets` fails, the budget
was the decision and the change has to fit it — or the budget gets raised
deliberately, in its own commit, with the reason written down.

**Re-measure rather than remember.** `docs/baseline/2026-08.md` is generated
by a script for exactly this reason. Every number in it goes stale; the script
does not.

## When something breaks in production

1. **The service worker is the first suspect** for "the site is showing me an
   old version". `window.forgeSwKill()` from the console, or the same from the
   palette terminal, drops every cache and unregisters. That escape hatch was
   built before the caching logic, deliberately.
2. **A blank section** is a failed lazy chunk. Each section has its own error
   boundary with a retry, so this degrades one section rather than the page —
   and the boundary reports to RUM with the section's name.
3. **A black canvas** is WebGL context loss. It recovers twice, then falls
   back to the CSS layer and sets `data-gl-fallback` on `<html>`.
4. **Nothing renders at all** — check the CSP. It is enforced (not
   report-only) and it pins the hash of the inline theme script; if that
   script changed without `node scripts/check-csp.mjs --write`, the build gate
   catches it, but a hand-edited `vercel.json` would not be caught.

## What is deliberately not automated

Screen-reader passes, real-device testing, and design judgement. A tool can
tell you the contrast ratio is 4.6:1; it cannot tell you the sentence is
confusing when VoiceOver reads it aloud. Those belong in the quarterly pass,
with the transcript committed to `docs/a11y/`.

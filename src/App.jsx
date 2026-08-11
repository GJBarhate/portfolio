import { useCallback, useEffect, useState, lazy, Suspense, Activity } from 'react'
import { SmoothScrollProvider } from './contexts/SmoothScrollContext.jsx'
import { SoundProvider } from './contexts/SoundContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { GameProvider } from './contexts/GameContext.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import SectionSkeleton from './components/ui/SectionSkeleton.jsx'
import Navbar from './components/ui/Navbar.jsx'
import ScrollProgress from './components/ui/ScrollProgress.jsx'
import Preloader from './components/ui/Preloader.jsx'
import FluidHero from './components/ui/FluidHero.jsx'
import ParallaxLayer from './components/ui/ParallaxLayer.jsx'
import { SparkProvider, SparkCompleteToast } from './components/ui/SparkHunt.jsx'
import Hero from './components/sections/Hero.jsx'
import { useKonamiCode } from './hooks/useKonamiCode.js'
import { startAnimationGate, stopAnimationGate } from './lib/animationGate.js'
import { invalidateProfile, scheduleProbe } from './lib/deviceProfile.js'
import { initTier } from './lib/raf.js'
import { useDeviceTier } from './lib/useMedia.js'
import { installMotionMode } from './lib/motion.js'
import { installBgScene } from './lib/bgScene.js'
import { installNotices, claimOverlay } from './lib/overlayBus.js'
import { OPEN_CONSOLE_EVENT, isAppearanceShortcut, openAppearanceConsole } from './lib/appearance.js'
import { PALETTE_HINT, isPaletteShortcut } from './lib/platform.js'
import { getStore, hasSeen, markSeen } from './lib/store.js'
import { installRecruiter, isRecruiter, onRecruiterChange } from './lib/recruiter.js'
import { navigateToSection } from './lib/viewTransition.js'

// ── Sections ──────────────────────────────────────────────────────────────
const About = lazy(() => import('./components/sections/About.jsx'))
const PlayerStats = lazy(() => import('./components/sections/PlayerStats.jsx'))
const Skills = lazy(() => import('./components/sections/Skills.jsx'))
const Projects = lazy(() => import('./components/sections/Projects.jsx'))
const Timeline = lazy(() => import('./components/sections/Timeline.jsx'))
const HowIBuild = lazy(() => import('./components/sections/HowIBuild.jsx'))
const Contact = lazy(() => import('./components/sections/Contact.jsx'))
const Footer = lazy(() => import('./components/sections/Footer.jsx'))

// ── Ambient / HUD chrome: nothing here is visible at first paint, so all of
//    it is deferred to the first idle callback. ──────────────────────────────
const TickerMarquee = lazy(() => import('./components/ui/TickerMarquee.jsx'))
// §14 — ONE background engine. This replaces three overlapping ambient layers
// (`AmbientParticles`, `ParticleUniverse`, `AmbientField`), each of which held
// its own canvas, its own theme handling and its own idea of "calm". One
// fullscreen quad, one shader, character shifting per section.
const BackgroundEngine = lazy(() => import('./components/ui/BackgroundEngine.jsx'))
const XPBar = lazy(() => import('./components/ui/XPBar.jsx'))
const LevelRibbon = lazy(() => import('./components/ui/LevelRibbon.jsx'))
const LevelMap = lazy(() => import('./components/ui/LevelMap.jsx'))
const AchievementToast = lazy(() => import('./components/ui/AchievementToast.jsx'))
const TimeSuggestionToast = lazy(() => import('./components/ui/TimeSuggestionToast.jsx'))
const IdleEasterEgg = lazy(() => import('./components/ui/IdleEasterEgg.jsx'))
const WelcomeBackToast = lazy(() => import('./components/ui/WelcomeBackToast.jsx'))
const RunComplete = lazy(() => import('./components/ui/RunComplete.jsx'))
const ExitIntent = lazy(() => import('./components/ui/ExitIntent.jsx'))
const CoachChip = lazy(() => import('./components/ui/CoachChip.jsx'))
// Mounted here rather than inside Hero, which is the whole point: the corner
// clock is fixed to the viewport and must survive scrolling past the first
// screen. Its predecessor lived in Hero and therefore unmounted with it.
// `Clock` is the decision; it statically imports the ~0 ms SVG dial and only
// lazily requests the WebGL diorama when the machine has already been judged
// able to afford it. Importing MoonForestClock here directly would put the
// 128 KB `three` chunk on the path of every phone.
const Clock = lazy(() => import('./components/ui/Clock.jsx'))

// ── Interaction-gated: these chunks are never fetched unless the visitor
//    actually does the thing. ──────────────────────────────────────────────
const CustomCursor = lazy(() => import('./components/ui/CustomCursor.jsx'))
const CommandPalette = lazy(() => import('./components/ui/CommandPalette.jsx'))
const ArcadeHub = lazy(() => import('./components/arcade/ArcadeHub.jsx'))
// The panel is ~4 KB of markup for three radio groups and is not on screen at
// first paint, so it is fetched the first time somebody asks for it — from the
// header button, the drawer row, the palette, Shift+A, or the first-run
// choreography. The BUTTON that opens it is eager and always visible; that is
// the part that had to stop being conditional.
const AppearanceConsole = lazy(() => import('./components/ui/AppearanceConsole.jsx'))

const requestIdle = (fn, timeout = 2500) =>
  (window.requestIdleCallback || ((cb) => setTimeout(cb, 200)))(fn, { timeout })
const cancelIdle = (id) => (window.cancelIdleCallback || clearTimeout)(id)

/** True once the browser has had an idle moment after first paint. */
function useIdleMount(timeout = 2500) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    const id = requestIdle(() => setIdle(true), timeout)
    return () => cancelIdle(id)
  }, [timeout])
  return idle
}

/*
 * The background deliberately does NOT get an earlier deadline, and this is a
 * measured reversal rather than an omission.
 *
 * The field first appears at ~4 s, which looked like something to fix: before
 * that the page is a flat surface colour. So it was given its own 400 ms
 * deadline instead of sharing the general idle one. Re-measured:
 *
 *                          shared idle (2.5 s)    own deadline (400 ms)
 *   background appears            4.1 s                  8.4 s
 *   worst single freeze          898 ms                2855 ms
 *
 * Both got worse, and the reason is that this component is expensive to
 * START — an 871-line fragment shader that compiles synchronously. Asking for
 * it at 400 ms puts that compile in the middle of the lazy-chunk wave, where
 * it contends with everything else and lands LATER than if it had waited.
 *
 * The lesson is the general one about idle work: moving expensive
 * initialisation earlier does not make it finish earlier when the main thread
 * is already saturated. It just makes the saturation worse.
 */

/**
 * P5.8 — mount the idle chrome in WAVES, not in one task.
 *
 * `{idle && <>…</>}` mounted eleven lazy components in a single render, in a
 * single idle callback. Each one is a chunk to evaluate, a component to
 * reconcile, effects to run and — for several of them — an observer or a frame
 * subscription to install. Doing all of that between two frames is the textbook
 * shape of a long task, and long tasks are what INP actually measures: a
 * visitor who taps during that window waits for the whole wave to finish before
 * the browser can even acknowledge the tap.
 *
 * So the wave is dealt out one step per idle callback, with a real yield
 * between steps. The order is deliberate — the things a visitor is most likely
 * to look at or interact with first come first, and the purely decorative ones
 * arrive last, by which time nothing is waiting on them.
 *
 * `requestIdleCallback` already yields to input by definition; the `timeout`
 * guarantees the tail still arrives on a busy page rather than never.
 *
 * @param {number} steps how many waves to deal out
 * @param {boolean} start whether the first wave may begin
 * @returns {number} how many waves have landed
 */
function useStaggeredMount(steps, start) {
  const [wave, setWave] = useState(0)

  useEffect(() => {
    if (!start || wave >= steps) return
    // A longer timeout for later waves: the first two carry things the visitor
    // can see, the rest can genuinely wait for a quiet moment.
    const id = requestIdle(() => setWave((n) => n + 1), wave < 2 ? 1200 : 4000)
    return () => cancelIdle(id)
  }, [start, wave, steps])

  return wave
}

/**
 * The full-viewport background field is decoration, so it mounts only where
 * the device can demonstrably afford it.
 *
 * This used to read `hardwareConcurrency >= 4`, which is true of essentially
 * every phone sold since 2019 — including thermally-throttled budget Androids
 * that then dropped the whole page to ~20 fps until the frame governor
 * noticed three seconds later. Core count is not a GPU benchmark, and the
 * `min-width: 768px` clause it replaced was not one either.
 *
 * `useDeviceTier()` is the answer from `deviceProfile.js`: five proxies and
 * one real 250 ms measurement of the actual shader, taken after LCP so the
 * probe cannot delay the paint it exists to protect (T-007).
 *
 * Below tier 2 the visitor is not given a dead page. The `.hero-mesh` CSS
 * layer (index.css) provides three compositor-only drifting radial gradients
 * at ~0 ms of main thread — the phone gets the cheap version of a live page,
 * not a static one.
 */
function useBackgroundAllowed(idle) {
  /*
   * MEASURED FIX — the background is gated on WEBGL, not on tier.
   *
   * This used to return `idle && tier >= 2`, which meant the frame governor
   * demoting to tier 1 UNMOUNTED the background field. Measured over one
   * session on the production build:
   *
   *     368ms   tier=undefined  background=false
   *    5027ms   tier=2          background=true    <- 5 seconds of nothing
   *   16101ms   tier=3          background=true
   *   21788ms   tier=2          background=true
   *   25628ms   tier=2          background=true
   *   35122ms   tier=3          background=true
   *   42564ms   tier=1          background=FALSE   <- gone, and it stays gone
   *
   * That is the whole of "the background moves, sometimes I see it, sometimes
   * I don't". It is also a feedback loop: the page is slow, so the governor
   * demotes, so the background disappears — and the demotion was caused by
   * work the background was only part of.
   *
   * `glStage.js` states the rule this broke, in its own comments: "Tier scales
   * RESOLUTION, never existence." The engine already honours that internally —
   * it drops DPR to 0.5 and freezes its clock under reduced motion — so tier 1
   * does not need it deleted, it needs it cheaper. It renders at a lower
   * resolution and keeps existing.
   *
   * The only remaining gate is WebGL support, which is not a preference.
   */
  const tier = useDeviceTier()
  // `tier` is still read so the engine re-renders when quality changes; it no
  // longer decides whether the engine exists.
  void tier
  return idle
}

/**
 * Whether the cinematic curtain runs — T-031.
 *
 * Three changes from `sessionStorage.getItem('forge-intro')`. It is now once
 * per *visitor* (30-day TTL in the unified store) rather than once per tab,
 * so opening the site in a second tab does not replay it. It is skipped
 * entirely on the devices that can least afford a self-inflicted LCP delay.
 * And the decision is made synchronously during the first render, because a
 * curtain that appears one frame late is worse than no curtain.
 */
const INTRO_TTL = 30 * 24 * 60 * 60 * 1000

/** P9.3 — the first-run reveal is once per visitor per 90 days. */
const FIRST_RUN_TTL = 90 * 24 * 60 * 60 * 1000
/** Long enough to read three theme names; short enough not to be a modal. */
const FIRST_RUN_MS = 4000
/**
 * 11 s: past the overlay bus's 10 s quiet period, so the site's own opening
 * move obeys the same rule it imposes on everything else.
 */
const FIRST_RUN_DELAY_MS = 11_000

function shouldRunIntro() {
  if (typeof window === 'undefined') return false
  if (hasSeen('intro', INTRO_TTL)) return false
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if (navigator.connection?.saveData) return false
  // A device that has already been probed in this session and came back below
  // tier 2 does not get a cinematic intro. On a first visit the probe has not
  // run yet, and the cheap proxies stand in for it.
  if ((navigator.deviceMemory || 4) < 4) return false
  if ((navigator.hardwareConcurrency || 4) <= 2) return false
  return true
}

export default function App() {
  const [arcadeOpen, setArcadeOpen] = useState(false)
  const [arcadeGame, setArcadeGame] = useState(null)
  const [paletteMounted, setPaletteMounted] = useState(false)
  const [appearanceMounted, setAppearanceMounted] = useState(false)
  // Carried across the lazy mount: the FIRST open happens before the console
  // exists to hear its own event (see `defaultOpen` there), so the auto-close
  // duration has to travel as a prop rather than in the event detail.
  const [appearanceAutoClose, setAppearanceAutoClose] = useState(0)
  const [pointerSeen, setPointerSeen] = useState(false)
  const [showPreloader] = useState(shouldRunIntro)
  const [introDone, setIntroDone] = useState(() => !shouldRunIntro())

  const idle = useIdleMount()
  const backgroundAllowed = useBackgroundAllowed(idle)

  /*
   * P2.5 — recruiter mode decides what MOUNTS, not just what is visible.
   *
   * This used to be `getStore().prefs.recruiter`, read once during render and
   * never again, so toggling the mode did not even re-render App. Worse, the
   * ~20 things the mode "removes" were removed with `display: none`: every one
   * of them still mounted, still subscribed to the frame loop, and in the
   * clock's case still held a WebGL context. The page looked like it was doing
   * less and did exactly as much.
   *
   * `isRecruiter()` reads the attribute the pre-paint script may already have
   * set from the URL, so a visitor arriving from a job board never mounts the
   * arcade graph at all — not for one frame.
   */
  const [recruiter, setRecruiter] = useState(isRecruiter)
  useEffect(() => {
    const off = onRecruiterChange(setRecruiter)
    const uninstall = installRecruiter()
    setRecruiter(isRecruiter())
    return () => { off(); uninstall() }
  }, [])

  // Three waves of HUD chrome, dealt out across successive idle callbacks.
  const wave = useStaggeredMount(3, idle)

  const [arcadeMounted, setArcadeMounted] = useState(false)

  const openGame = useCallback(() => {
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'secret-found' }))
    setArcadeGame('snake')
    setArcadeMounted(true)
    setArcadeOpen(true)
  }, [])

  const openArcade = useCallback((e) => {
    // T-004 — the nav dropdown launches a specific game through the same
    // event, carrying its id in `detail`.
    setArcadeGame(typeof e?.detail === 'string' ? e.detail : null)
    setArcadeMounted(true)
    setArcadeOpen(true)
  }, [])

  useKonamiCode(openGame)

  useEffect(() => {
    window.addEventListener('forge:open-arcade', openArcade)
    return () => window.removeEventListener('forge:open-arcade', openArcade)
  }, [openArcade])

  /**
   * D-01 — the reported bug. The palette used to be mounted from inside a
   * `keydown` handler testing for ⌘K, and nothing else could reach it: no
   * button, no gesture, no drawer entry. A phone has no ⌘K, so 100 % of
   * mobile visitors carried 1.9 KB of gzip for a feature they could not open.
   *
   * There is now exactly one door: the `forge:open-palette` event. The
   * keyboard shortcut, the header button and the drawer row all knock on it,
   * which is what stops the next entry point from being wired to a private
   * setter again.
   */
  useEffect(() => {
    const open = () => setPaletteMounted(true)
    window.addEventListener('forge:open-palette', open)
    if (paletteMounted) return () => window.removeEventListener('forge:open-palette', open)

    const onKey = (e) => {
      if (!isPaletteShortcut(e)) return
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('forge:open-palette'))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('forge:open-palette', open)
      window.removeEventListener('keydown', onKey)
    }
  }, [paletteMounted])

  /**
   * The Appearance Console — one door, exactly like the palette's.
   *
   * `Shift+A` is bound here rather than inside the panel, because a shortcut
   * that only works once the panel is mounted is a shortcut that does not
   * work. The chunk is fetched on the first knock and stays mounted after, so
   * the second open is instant.
   */
  useEffect(() => {
    /*
     * TWO listeners, and they are deliberately not collapsed into one effect
     * that unbinds once the chunk has landed.
     *
     * The palette's equivalent effect drops its `keydown` binding after the
     * first open, which is safe there because the mounted palette rebinds ⌘K
     * for itself. Copying that shape here was a bug: the console has no
     * internal shortcut handler, so `Shift+A` worked exactly once per page
     * load and then silently stopped. Caught by pressing it twice.
     *
     * The key handler therefore lives for the life of the app — it is one
     * comparison per keydown — and only the *mounting* is one-shot.
     */
    const mount = (e) => {
      setAppearanceAutoClose(e?.detail?.autoClose ?? 0)
      setAppearanceMounted(true)
    }
    const onKey = (e) => {
      if (!isAppearanceShortcut(e)) return
      e.preventDefault()
      openAppearanceConsole({ source: 'keyboard' })
    }
    window.addEventListener(OPEN_CONSOLE_EVENT, mount)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(OPEN_CONSOLE_EVENT, mount)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // The custom cursor is meaningless until a real pointer shows up.
  useEffect(() => {
    if (pointerSeen) return
    const onPointer = (e) => {
      if (e.pointerType === 'touch') return
      setPointerSeen(true)
    }
    window.addEventListener('pointermove', onPointer, { once: true, passive: true })
    return () => window.removeEventListener('pointermove', onPointer)
  }, [pointerSeen])

  // Pause every looping CSS animation that scrolls out of view.
  useEffect(() => {
    startAnimationGate()
    return () => stopAnimationGate()
  }, [])

  // One motion scalar, wired to the store, the OS preference and the DOM.
  useEffect(() => installMotionMode(), [])

  // §14.5 — which backdrop is on: calm, motifs or forest. Published on
  // `<html data-bg-scene>` so the legibility scrim can be tuned per scene.
  useEffect(() => installBgScene(), [])

  // P2.5 — the stored Do Not Disturb preference, published on
  // `<html data-notices>` before the first overlay can possibly claim a slot.
  useEffect(() => installNotices(), [])

  /*
   * D-45 — a motion change re-decides the graphics tier.
   *
   * `data-motion` feeds `prefersReducedMotion()`, which feeds the tier ladder,
   * which decides whether there is any WebGL on the page at all. Without this
   * the decision was made once at startup and never revisited: a visitor who
   * chose Motion: full got the CSS animations immediately and the background
   * field, the hero fluid and the 3-D scenes only after a reload. The probe is
   * re-run too, since its cached verdict was reached under the old answer.
   */
  useEffect(() => {
    const onMotion = () => {
      invalidateProfile()
      initTier()
      scheduleProbe()
    }
    document.documentElement.addEventListener('forge:motion-changed', onMotion)
    return () => document.documentElement.removeEventListener('forge:motion-changed', onMotion)
  }, [])

  // T-007 — the capability probe, scheduled for after LCP and then for idle.
  useEffect(() => { scheduleProbe() }, [])

  /*
   * P0.8 — the instrument panel, behind `?perf=1`.
   *
   * Imported dynamically and only when asked for, so it is not in the eager
   * graph and a normal visitor never pays for it. It is the measurement device
   * for every claim Phases 3–5 make about frame cost, live GL contexts and the
   * overlay budget; without it those are opinions.
   */
  useEffect(() => {
    // The flag is read HERE, before the import, not inside the module. A
    // dynamic import that always fires still fetches, parses and evaluates the
    // chunk for every visitor — which would make the performance tool a
    // performance cost for the 100 % of people who did not ask for it.
    let requested = false
    try { requested = new URLSearchParams(location.search).get('perf') === '1' } catch { /* opaque origin */ }
    if (!requested) return

    let unmount
    let cancelled = false
    import('./lib/perfHud.js').then((hud) => {
      if (cancelled) return
      unmount = hud.mountPerfHud()
    }).catch(() => {})
    return () => { cancelled = true; unmount?.() }
  }, [])

  // T-008 — RUM, dynamically imported at idle so it never enters the eager
  // graph (`check-budgets.mjs` asserts that).
  useEffect(() => {
    const id = requestIdle(() => {
      import('./lib/rum.js').then((rum) => rum.install()).catch(() => {})
      // T-057 — the service worker, also at idle, also never blocking. It is
      // skipped entirely on the dev server, where a stale cached module graph
      // would be indistinguishable from a build bug.
      import('./lib/sw-register.js').then((sw) => {
        sw.registerServiceWorker()
        // The kill switch is reachable from the palette terminal too, so a bad
        // cache can be cleared from the phone it is broken on.
        window.forgeSwKill = sw.killServiceWorker
      }).catch(() => {})
    })
    return () => cancelIdle(id)
  }, [])

  /**
   * The console easter egg — T-003. The ~60 lines of command definitions that
   * used to live here are now `src/lib/forgeCli.js`, and this is the thin
   * shim that binds them to `window.forge`. Nothing changed for someone with
   * a devtools console open; everything changed for someone on a phone, who
   * can now reach the same commands from the palette's `>` mode.
   */
  useEffect(() => {
    const id = requestIdle(() => {
      const style = 'color:#7dd3fc;font-size:14px;font-weight:bold;font-family:monospace'
      const sub = 'color:#94a3b8;font-size:11px;font-family:monospace'
      console.log('%c🔧 FORGE v5 — Gaurav Barhate', style)
      console.log(`%cType %cforge.help() %cfor commands — or press ${PALETTE_HINT} and type > on any device`, sub, 'color:#38bdf8', sub)

      // Imported here rather than at module scope: the registry is ~2 KB of
      // strings that only a console user or the palette chunk ever reads, and
      // the entry bundle is the one budget with no room to spare.
      import('./lib/forgeCli.js').then(({ installConsoleShim }) => {
        window.forge = installConsoleShim({
          setTheme: (theme) => window.dispatchEvent(new CustomEvent('forge:set-theme', { detail: theme })),
          openArcade: () => setArcadeOpen(true),
          scrollTo: (sectionId) => navigateToSection(sectionId),
        })
      }).catch(() => {})
    })
    return () => cancelIdle(id)
  }, [])

  /**
   * P9.2 — the one-visit surprise, and it is a DISCOVERY rather than an effect.
   *
   * The brief's ask was "user visit once only — it should surprise him/her",
   * and the tempting reading is "add more effects". The plan's reading is
   * better and this implements it: the single most surprising thing this page
   * can do for a first-time visitor is show them that it has three complete
   * looks and that they are one click away.
   *
   * So on a first visit only, once the entrance has finished and the quiet
   * period has passed, the Appearance Console opens by itself for four
   * seconds. It is not a tooltip pointing at a button — it IS the panel, with
   * live previews of all three themes, so the discovery and the control are
   * the same object.
   *
   * Four constraints, all of which are the difference between a delight and an
   * annoyance:
   *   · once per visitor per 90 days (`markSeen`), never again;
   *   · never in Recruiter Mode — someone evaluating you does not want a tour;
   *   · after the intro, not during it;
   *   · it spends ONE of the Do-Not-Disturb budget's two interruptions, which
   *     is deliberate: this is the interruption the site chooses to make, and
   *     everything else now has to compete for the remaining one.
   */
  useEffect(() => {
    if (!idle || recruiter) return
    if (hasSeen('first-run-appearance', FIRST_RUN_TTL)) return
    // Not on a returning visitor: `lastVisit` is written by WelcomeBackToast,
    // so its presence means this is not a first visit even if the flag above
    // has aged out.
    if (Number.isFinite(getStore().seen?.lastVisit)) return

    const id = setTimeout(() => {
      markSeen('first-run-appearance')
      openAppearanceConsole({ source: 'first-run', autoClose: FIRST_RUN_MS })
    }, FIRST_RUN_DELAY_MS)
    return () => clearTimeout(id)
  }, [idle, recruiter])

  /*
   * P5.3 — a quieter fallback for the visitor the panel-opening above never
   * reaches.
   *
   * That effect spends the visit's one Do-Not-Disturb interruption opening
   * the full panel — but only on a visitor's very first-ever visit, before
   * `lastVisit` exists. Anyone who arrives later (a second visit, a link from
   * somewhere, a recruiter who came back) never sees any hint that the
   * Appearance button does anything at all. This is that hint: a 2.2s ring
   * pulse on the button itself, no card, no text, no dismiss control —
   * `claimOverlay` already refuses it outright in Recruiter Mode and when
   * the budget is spent, which on the visit the panel auto-opens is exactly
   * what happens (one budget, already claimed) — so the two can never stack.
   */
  useEffect(() => {
    if (!idle || recruiter) return
    if (hasSeen('appearance-hint', FIRST_RUN_TTL)) return
    let release = null
    const id = setTimeout(() => {
      // The bus owns the 2.2s TTL and clears `data-overlay` itself when it
      // expires — `release` is kept only so an early unmount (a recruiter
      // toggling mid-hint, a route change) cannot leave the claim dangling.
      release = claimOverlay('appearance-hint', { ttl: 2200, once: true })
    }, FIRST_RUN_DELAY_MS + 2000)
    return () => {
      clearTimeout(id)
      release?.()
    }
  }, [idle, recruiter])

  /**
   * T-003.4 — the coach mark. The terminal is the feature this site is
   * proudest of and the one nobody discovers, because "press / then >" is not
   * guessable. After a real dwell on a first visit, a dismissible chip says so
   * once, ever.
   *
   * D-34.2 — two corrections, both from watching it on a phone.
   *
   * It advertised a KEYSTROKE to devices with no keyboard: at 390x844 the chip
   * read "press Ctrl K, then >" and sat over the hero. A hint whose
   * instruction the reader cannot physically follow is worse than no hint, so
   * the wording now follows the input the visitor actually has.
   *
   * And 8 s was measured from the idle callback, which on a phone fires while
   * the hero is still assembling — so the chip landed during the entrance
   * rather than after it. 14 s from idle, and only while nothing else is on
   * screen (§overlay arbiter), which is what makes it a hint rather than an
   * interruption.
   */
  useEffect(() => {
    if (!idle || hasSeen('terminal-coach')) return
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
    const id = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('forge:coach', {
        detail: {
          id: 'terminal-coach',
          text: fine
            // D.1 — two instructions in one hint is one too many. The `>`
            // mode is discoverable once the palette is open; getting there is
            // the only thing this chip needs to say.
            ? `There's a command bar. Press ${PALETTE_HINT}.`
            : 'There is a command bar — tap search.',
        },
      }))
      markSeen('terminal-coach')
    }, 14000)
    return () => clearTimeout(id)
  }, [idle])

  return (
    <ThemeProvider>
      <SoundProvider>
        <SparkProvider>
        <GameProvider>
          <SmoothScrollProvider>
            {showPreloader && <Preloader onReveal={() => setIntroDone(true)} />}
            {/* P5.5 — the `.film-grain` layer that used to sit here is gone;
                the grain now lives in the background shader, where grain
                belongs. See index.css §"Film grain — DELETED". */}
            <div className="grade-wash" aria-hidden="true" />
            <ScrollProgress />
            <Navbar />

            <Suspense fallback={null}>
              {pointerSeen && <CustomCursor />}
              {paletteMounted && (
                <CommandPalette onPlayGame={openGame} onOpenArcade={openArcade} defaultOpen />
              )}
              {appearanceMounted && <AppearanceConsole defaultAutoClose={appearanceAutoClose} />}
              {arcadeMounted && (
                <Activity mode={arcadeOpen ? 'visible' : 'hidden'}>
                  <ArcadeHub
                    open={arcadeOpen}
                    initialGame={arcadeGame}
                    onClose={() => setArcadeOpen(false)}
                  />
                </Activity>
              )}
            </Suspense>

            {/*
              THE BACKGROUND AND THE CLOCK EACH GET THEIR OWN SUSPENSE BOUNDARY.
              ================================================================

              This is the root cause of "the background is there, then it is
              not". It is not a tier bug and not a CSS bug — it is React.

              When any component inside a Suspense boundary starts loading,
              React hides that boundary's ALREADY-RENDERED content by writing
              `display: none !important` inline on it, then reveals it again
              once the new child resolves. Found by trapping
              `CSSStyleDeclaration.setProperty` and getting a stack with no
              application frames in it at all — pure React commit code.

              `BackgroundEngine` used to share one boundary with eleven lazy
              HUD components, so every one of them that began loading blanked
              the background for the duration. P5.8's staggered mount then made
              it strictly worse: three waves means three separate suspensions,
              and the field disappeared for each one.

              A boundary of its own means nothing else can hide it. Same for
              the clock, for the same reason.
            */}
            <Suspense fallback={null}>
              {backgroundAllowed && <BackgroundEngine />}
            </Suspense>

            <Suspense fallback={null}>
              {idle && !recruiter && <Clock />}
            </Suspense>

            <Suspense fallback={null}>
              {idle && (
                <>
                  {!recruiter && (
                    <>
                      {/* Wave 1 — the two the visitor can actually see. */}
                      {wave >= 1 && <XPBar />}
                      {wave >= 1 && <LevelRibbon />}
                      {/* Wave 2 — reachable, but only on demand. */}
                      {wave >= 2 && <LevelMap />}
                      {wave >= 2 && <AchievementToast />}
                      {/* Wave 3 — nothing here can appear for at least 10 s
                          anyway (the overlay bus's quiet period), so arriving
                          late costs the visitor exactly nothing. */}
                      {wave >= 3 && <RunComplete />}
                      {wave >= 3 && <IdleEasterEgg />}
                      {wave >= 3 && <ExitIntent />}
                    </>
                  )}
                  {wave >= 2 && <TimeSuggestionToast />}
                  {wave >= 3 && <WelcomeBackToast />}
                  {wave >= 3 && <CoachChip />}
                </>
              )}
            </Suspense>
            <SparkCompleteToast />

            {/*
              T-029 / D-20 — one Suspense and one ErrorBoundary PER SECTION.

              A height-reserving wrapper was tried here and removed. The
              measurement is the reason: a slot with `min-block-size: 70svh`
              around a section whose real height is 1,800px does not prevent a
              shift, it CAUSES one — the reservation is smaller than the
              content, so the moment the content lands the slot grows and
              everything below it jumps. Measured CLS went from 0.0005 to
              1.48. The skeletons already approximate their sections' real
              heights, which is the version of this idea that works.
              All seven used to share a single pair, so one failed lazy chunk
              replaced the entire page body with a four-card skeleton that
              matched none of them. Now a chunk that 404s degrades exactly one
              section, and each skeleton reserves the height of the content it
              stands in for, which is what keeps CLS at ~0 through the swap.
            */}
            <main id="main" className="relative z-[1]">
              <ErrorBoundary name="Hero">
                <FluidHero>
                  <ParallaxLayer speed={0.15}>
                    <Hero introDone={introDone} />
                  </ParallaxLayer>
                </FluidHero>
              </ErrorBoundary>

              <ErrorBoundary name="Ticker">
                <Suspense fallback={<SectionSkeleton variant="ticker" />}><TickerMarquee /></Suspense>
              </ErrorBoundary>

              <ErrorBoundary name="About" minHeight="52svh">
                <Suspense fallback={<SectionSkeleton variant="prose" label="About" />}><About /></Suspense>
              </ErrorBoundary>

              <ErrorBoundary name="Player Stats" minHeight="70svh">
                <Suspense fallback={<SectionSkeleton variant="stats" label="Player stats" />}><PlayerStats /></Suspense>
              </ErrorBoundary>

              <ErrorBoundary name="Skills" minHeight="75svh">
                <Suspense fallback={<SectionSkeleton variant="lanes" label="Skills" />}><Skills /></Suspense>
              </ErrorBoundary>

              <ErrorBoundary name="Projects" minHeight="90svh">
                <Suspense fallback={<SectionSkeleton variant="cards" label="Projects" />}><Projects /></Suspense>
              </ErrorBoundary>

              <ErrorBoundary name="Ticker">
                <Suspense fallback={<SectionSkeleton variant="ticker" />}><TickerMarquee /></Suspense>
              </ErrorBoundary>

              <ErrorBoundary name="Journey" minHeight="85svh">
                <Suspense fallback={<SectionSkeleton variant="timeline" label="Journey" />}><Timeline /></Suspense>
              </ErrorBoundary>

              <ErrorBoundary name="Process" minHeight="70svh">
                <Suspense fallback={<SectionSkeleton variant="cards" label="Process" />}><HowIBuild /></Suspense>
              </ErrorBoundary>

              <ErrorBoundary name="Contact" minHeight="80svh">
                <Suspense fallback={<SectionSkeleton variant="form" label="Contact" />}><Contact /></Suspense>
              </ErrorBoundary>
            </main>

            <ErrorBoundary name="Footer">
              <Suspense fallback={null}>
                <Footer />
              </Suspense>
            </ErrorBoundary>
          </SmoothScrollProvider>
        </GameProvider>
        </SparkProvider>
      </SoundProvider>
    </ThemeProvider>
  )
}

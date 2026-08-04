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
import { scheduleProbe } from './lib/deviceProfile.js'
import { useDeviceTier } from './lib/useMedia.js'
import { installMotionMode } from './lib/motion.js'
import { getStore, hasSeen, markSeen } from './lib/store.js'
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
const NowStatus = lazy(() => import('./components/ui/NowStatus.jsx'))
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

// ── Interaction-gated: these chunks are never fetched unless the visitor
//    actually does the thing. ──────────────────────────────────────────────
const CustomCursor = lazy(() => import('./components/ui/CustomCursor.jsx'))
const CommandPalette = lazy(() => import('./components/ui/CommandPalette.jsx'))
const ArcadeHub = lazy(() => import('./components/arcade/ArcadeHub.jsx'))

const requestIdle = (fn, timeout = 2500) =>
  (window.requestIdleCallback || ((cb) => setTimeout(cb, 200)))(fn, { timeout })
const cancelIdle = (id) => (window.cancelIdleCallback || clearTimeout)(id)

/** True once the browser has had an idle moment after first paint. */
function useIdleMount() {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    const id = requestIdle(() => setIdle(true))
    return () => cancelIdle(id)
  }, [])
  return idle
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
function useHeavyAmbientAllowed(idle) {
  const tier = useDeviceTier()
  return idle && tier >= 2
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
  const [pointerSeen, setPointerSeen] = useState(false)
  const [showPreloader] = useState(shouldRunIntro)
  const [introDone, setIntroDone] = useState(() => !shouldRunIntro())

  const idle = useIdleMount()
  const heavyAmbient = useHeavyAmbientAllowed(idle)

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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('forge:open-palette'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('forge:open-palette', open)
      window.removeEventListener('keydown', onKey)
    }
  }, [paletteMounted])

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

  // T-007 — the capability probe, scheduled for after LCP and then for idle.
  useEffect(() => { scheduleProbe() }, [])

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
      console.log('%cType %cforge.help() %cfor commands — or press ⌘K and type > on any device', sub, 'color:#38bdf8', sub)

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
   * T-003.4 — the coach mark. The terminal is the feature this site is
   * proudest of and the one nobody discovers, because "press ⌘K then >" is
   * not guessable. After 8 s of dwell on a first visit, a dismissible chip
   * says so once, ever.
   */
  useEffect(() => {
    if (!idle || hasSeen('terminal-coach')) return
    const id = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('forge:coach', {
        detail: { id: 'terminal-coach', text: 'Try the terminal — press ⌘K, then >' },
      }))
      markSeen('terminal-coach')
    }, 8000)
    return () => clearTimeout(id)
  }, [idle])

  const recruiter = getStore().prefs.recruiter

  return (
    <ThemeProvider>
      <SoundProvider>
        <SparkProvider>
        <GameProvider>
          <SmoothScrollProvider>
            {showPreloader && <Preloader onReveal={() => setIntroDone(true)} />}
            <div className="grade-wash" aria-hidden="true" />
            <div className="film-grain" aria-hidden="true" />
            <ScrollProgress />
            <Navbar />

            <Suspense fallback={null}>
              {pointerSeen && <CustomCursor />}
              {paletteMounted && (
                <CommandPalette onPlayGame={openGame} onOpenArcade={openArcade} defaultOpen />
              )}
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

            <Suspense fallback={null}>
              {idle && (
                <>
                  {heavyAmbient && <BackgroundEngine />}
                  <XPBar />
                  <LevelMap />
                  <AchievementToast />
                  <NowStatus />
                  <TimeSuggestionToast />
                  <IdleEasterEgg />
                  <WelcomeBackToast />
                  <LevelRibbon />
                  <RunComplete />
                  <CoachChip />
                  {!recruiter && <ExitIntent />}
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

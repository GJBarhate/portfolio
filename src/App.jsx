import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { SmoothScrollProvider } from './contexts/SmoothScrollContext.jsx'
import { SoundProvider } from './contexts/SoundContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { GameProvider } from './contexts/GameContext.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import Navbar from './components/ui/Navbar.jsx'
import ScrollProgress from './components/ui/ScrollProgress.jsx'
import Preloader from './components/ui/Preloader.jsx'
import FluidHero from './components/ui/FluidHero.jsx'
import ParallaxLayer from './components/ui/ParallaxLayer.jsx'
import { SparkProvider, SparkCompleteToast } from './components/ui/SparkHunt.jsx'
import Hero from './components/sections/Hero.jsx'
import { useKonamiCode } from './hooks/useKonamiCode.js'
import { startAnimationGate, stopAnimationGate } from './lib/animationGate.js'

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

// ── Interaction-gated: these chunks are never fetched unless the visitor
//    actually does the thing. ──────────────────────────────────────────────
const CustomCursor = lazy(() => import('./components/ui/CustomCursor.jsx'))
const CommandPalette = lazy(() => import('./components/ui/CommandPalette.jsx'))
const ArcadeHub = lazy(() => import('./components/arcade/ArcadeHub.jsx'))

function SectionSkeleton() {
  return (
    <div className="section-rhythm container-px" aria-hidden="true">
      <div className="section-shell space-y-6 animate-pulse">
        <div className="h-4 w-32 rounded-full bg-[var(--surface-2)]" />
        <div className="h-10 w-2/3 rounded-lg bg-[var(--surface-2)]" />
        <div className="h-4 w-1/2 rounded bg-[var(--surface-2)]" />
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[var(--surface-1)]" />
          ))}
        </div>
      </div>
    </div>
  )
}

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
 * The full-viewport particle field is decoration. It only mounts on a machine
 * that can clearly afford it and where a pointer exists to appreciate it.
 */
function useHeavyAmbientAllowed(idle) {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (!idle) return
    const allowed =
      (navigator.hardwareConcurrency || 0) >= 4 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !navigator.connection?.saveData &&
      window.matchMedia('(min-width: 768px)').matches
    setOk(allowed)
  }, [idle])
  return ok
}

export default function App() {
  const [arcadeOpen, setArcadeOpen] = useState(false)
  const [arcadeGame, setArcadeGame] = useState(null)
  const [paletteMounted, setPaletteMounted] = useState(false)
  const [pointerSeen, setPointerSeen] = useState(false)
  // Cinematic entry runs once per session; Hero delays its type reveal until
  // the curtain starts lifting so the animation is actually seen.
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem('forge-intro') === '1')
  const [showPreloader] = useState(() => sessionStorage.getItem('forge-intro') !== '1')

  const idle = useIdleMount()
  const heavyAmbient = useHeavyAmbientAllowed(idle)

  const openGame = useCallback(() => {
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'secret-found' }))
    setArcadeGame('snake')
    setArcadeOpen(true)
  }, [])

  const openArcade = useCallback(() => {
    setArcadeGame(null)
    setArcadeOpen(true)
  }, [])

  useKonamiCode(openGame)

  // Listen for arcade open from navbar
  useEffect(() => {
    window.addEventListener('forge:open-arcade', openArcade)
    return () => window.removeEventListener('forge:open-arcade', openArcade)
  }, [openArcade])

  // The palette's own ⌘K listener cannot run before its chunk exists, so a
  // tiny listener here summons it and hands over the open state.
  useEffect(() => {
    if (paletteMounted) return
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteMounted(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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

  // The idle warm of About/Projects that used to live here is gone. It was
  // always duplicative — these are `lazy()` children of a Suspense boundary
  // that mounts at first render, so React already requests their chunks then;
  // the warm just re-requested them at idle. What it *did* do, back when those
  // files statically imported three, was guarantee 131 KB reached every
  // visitor. Both chunks are now three-free (§8.2), and the genuinely heavy
  // islands — the hover distortion and the About desk scene — warm on intent
  // inside their own components (Research #17) rather than on a timer.

  // Pause every looping CSS animation that scrolls out of view.
  useEffect(() => {
    startAnimationGate()
    return () => stopAnimationGate()
  }, [])

  // Console easter egg (4.33) — ~40 strings and a window global, none of it
  // needed during startup.
  useEffect(() => {
    const id = requestIdle(() => {
      const style = [
        'color: var(--accent-bright)',
        'font-size: 14px',
        'font-weight: bold',
        'font-family: monospace',
      ].join(';')
      const sub = [
        'color: var(--ink-low)',
        'font-size: 11px',
        'font-family: monospace',
      ].join(';')
      console.log('%c🔧 FORGE v4 — Gaurav Barhate', style)
      console.log('%cType %cforge.help() %cfor available commands', sub, 'color: var(--accent)', sub)

      window.forge = {
        help() {
          const cmds = [
            'forge.theme("eclipse")    — Switch theme',
            'forge.arcade()            — Open arcade hub',
            'forge.matrix()            — Toggle ASCII dither mode',
            'forge.status()            — Show player stats',
            'forge.hire()              — Mini resume + email',
            'forge.version             — Show version',
            'forge.scrollTo("about")   — Navigate to section',
          ]
          console.log('%cAvailable commands:', 'color: var(--violet); font-weight: bold')
          cmds.forEach((c) => console.log(`  %c${c}`, 'color: var(--ink-low)'))
        },
        hire: () => {
          const art = [
            '╔══════════════════════════════════╗',
            '║     GAURAV BARHATE               ║',
            '║     Full-Stack Developer          ║',
            '║     B.Tech CSE · IIIT Vadodara   ║',
            '╠══════════════════════════════════╣',
            '║  LeetCode Knight · 1972 max      ║',
            '║  800+ problems solved             ║',
            '║  5+ production apps shipped       ║',
            '╠══════════════════════════════════╣',
            '║  Stack: MERN · Socket.IO · Redis  ║',
            '║  WebRTC · Yjs CRDT · Gemini AI    ║',
            '╠══════════════════════════════════╣',
            '║  📧 gauravbarhate55@gmail.com    ║',
            '║  📱 +91 93733 27427               ║',
            '╚══════════════════════════════════╝',
          ]
          console.log('%c' + art.join('\n'), 'color: var(--accent-bright); font-family: monospace; font-size: 11px; line-height: 1.5')
          console.log('%c→ mailto:gauravbarhate55@gmail.com', 'color: var(--violet); font-size: 12px')
          window.open('mailto:gauravbarhate55@gmail.com')
        },
        theme: (id) => {
          window.dispatchEvent(new CustomEvent('forge:set-theme', { detail: id }))
          window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'shapeshifter' }))
          console.log(`%cTheme switched to ${id}`, 'color: var(--accent-bright)')
        },
        arcade: () => setArcadeOpen(true),
        status: () => {
          const raw = localStorage.getItem('forge-progress')
          let count
          try { count = raw ? JSON.parse(raw).unlocked.length : 0 } catch { count = 0 }
          console.log(`%c🏆 XP: ${count} achievements`, 'color: var(--accent)')
        },
        matrix: () => {
          import('./lib/ditherOverlay.js').then(m => {
            const isOn = m.toggleDither()
            console.log(`%c${isOn ? 'ENTERING' : 'EXITING'} THE MATRIX`, 'color: #0f0; font-size: 14px; font-weight: bold')
          })
        },
        get version() { return '4.0.0' },
        scrollTo: (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }),
      }
    })
    return () => cancelIdle(id)
  }, [])

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
              {arcadeOpen && (
                <ArcadeHub
                  open={arcadeOpen}
                  initialGame={arcadeGame}
                  onClose={() => setArcadeOpen(false)}
                />
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
                  <ExitIntent />
                </>
              )}
            </Suspense>
            <SparkCompleteToast />

            <main className="relative z-[1]">
              {/* The hero was the one part of the page outside an error
                  boundary, so a failed lazy chunk inside it took down the
                  first viewport rather than degrading. */}
              <ErrorBoundary>
                <FluidHero>
                  <ParallaxLayer speed={0.15}>
                    <Hero introDone={introDone} />
                  </ParallaxLayer>
                </FluidHero>
              </ErrorBoundary>
              <ErrorBoundary>
                <Suspense fallback={<SectionSkeleton />}>
                  <TickerMarquee />
                  <About />
                  <PlayerStats />
                  <Skills />
                  <Projects />
                  <TickerMarquee />
                  <Timeline />
                  <HowIBuild />
                  <Contact />
                </Suspense>
              </ErrorBoundary>
            </main>
            <ErrorBoundary>
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

import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { SmoothScrollProvider } from './contexts/SmoothScrollContext.jsx'
import { SoundProvider } from './contexts/SoundContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { GameProvider } from './contexts/GameContext.jsx'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import CustomCursor from './components/ui/CustomCursor.jsx'
import Navbar from './components/ui/Navbar.jsx'
import CommandPalette from './components/ui/CommandPalette.jsx'
import NowStatus from './components/ui/NowStatus.jsx'
import XPBar from './components/ui/XPBar.jsx'
import LevelMap from './components/ui/LevelMap.jsx'
import AchievementToast from './components/ui/AchievementToast.jsx'
import MiniGame from './components/ui/MiniGame.jsx'
import ScrollProgress from './components/ui/ScrollProgress.jsx'
import Preloader from './components/ui/Preloader.jsx'
import TimeSuggestionToast from './components/ui/TimeSuggestionToast.jsx'
import { useKonamiCode } from './hooks/useKonamiCode.js'
import FluidHero from './components/ui/FluidHero.jsx'
import AmbientParticles from './components/ui/AmbientParticles.jsx'
// FisheyeLens removed — its cursor-following glow created an ugly white blob
import ParallaxLayer from './components/ui/ParallaxLayer.jsx'
import IdleEasterEgg from './components/ui/IdleEasterEgg.jsx'
import ParticleUniverse from './components/ui/ParticleUniverse.jsx'
import WelcomeBackToast from './components/ui/WelcomeBackToast.jsx'
import { SparkProvider, SparkCompleteToast } from './components/ui/SparkHunt.jsx'
import LevelRibbon from './components/ui/LevelRibbon.jsx'
import RunComplete from './components/ui/RunComplete.jsx'
import ExitIntent from './components/ui/ExitIntent.jsx'
import Hero from './components/sections/Hero.jsx'
import TickerMarquee from './components/ui/TickerMarquee.jsx'

const About = lazy(() => import('./components/sections/About.jsx'))
const PlayerStats = lazy(() => import('./components/sections/PlayerStats.jsx'))
const Skills = lazy(() => import('./components/sections/Skills.jsx'))
const Projects = lazy(() => import('./components/sections/Projects.jsx'))
const Timeline = lazy(() => import('./components/sections/Timeline.jsx'))
const HowIBuild = lazy(() => import('./components/sections/HowIBuild.jsx'))
const Contact = lazy(() => import('./components/sections/Contact.jsx'))
const Footer = lazy(() => import('./components/sections/Footer.jsx'))
const ArcadeHub = lazy(() => import('./components/arcade/ArcadeHub.jsx'))

function SectionSkeleton() {
  return (
    <div className="section-rhythm container-px" aria-hidden="true">
      <div className="section-shell space-y-6 animate-pulse">
        <div className="h-4 w-32 rounded-full bg-[var(--void-2)]" />
        <div className="h-10 w-2/3 rounded-lg bg-[var(--void-2)]" />
        <div className="h-4 w-1/2 rounded bg-[var(--void-2)]" />
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[var(--void-1)]" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [gameOpen, setGameOpen] = useState(false)
  const [arcadeOpen, setArcadeOpen] = useState(false)
  // Cinematic entry runs once per session; Hero delays its type reveal until
  // the curtain starts lifting so the animation is actually seen.
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem('forge-intro') === '1')
  const [showPreloader] = useState(() => sessionStorage.getItem('forge-intro') !== '1')

  const openGame = useCallback(() => {
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'secret-found' }))
    setGameOpen(true)
  }, [])

  const openArcade = useCallback(() => setArcadeOpen(true), [])

  useKonamiCode(openGame)

  // Listen for arcade open from navbar
  useEffect(() => {
    const handler = () => setArcadeOpen(true)
    window.addEventListener('forge:open-arcade', handler)
    return () => window.removeEventListener('forge:open-arcade', handler)
  }, [])

  // Console easter egg (4.33)
  useEffect(() => {
    const style = [
      'color: var(--plasma-bright)',
      'font-size: 14px',
      'font-weight: bold',
      'font-family: monospace',
    ].join(';')
    const sub = [
      'color: var(--ink-dim)',
      'font-size: 11px',
      'font-family: monospace',
    ].join(';')
    console.log('%c🔧 FORGE v3 — Gaurav Barhate', style)
    console.log('%cType %cforge.help() %cfor available commands', sub, 'color: var(--plasma)', sub)

    window.forge = {
      help() {
        const cmds = [
          'forge.theme("obsidian")   — Switch theme',
          'forge.arcade()            — Open arcade hub',
          'forge.matrix()            — Toggle ASCII dither mode',
          'forge.status()            — Show player stats',
          'forge.hire()              — Mini resume + email',
          'forge.version             — Show version',
          'forge.scrollTo("about")   — Navigate to section',
        ]
        console.log('%cAvailable commands:', 'color: var(--cyan); font-weight: bold')
        cmds.forEach((c) => console.log(`  %c${c}`, 'color: var(--ink-dim)'))
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
        console.log('%c' + art.join('\n'), 'color: var(--plasma-bright); font-family: monospace; font-size: 11px; line-height: 1.5')
        console.log('%c→ mailto:gauravbarhate55@gmail.com', 'color: var(--cyan); font-size: 12px')
        window.open('mailto:gauravbarhate55@gmail.com')
      },
      theme: (id) => {
        window.dispatchEvent(new CustomEvent('forge:set-theme', { detail: id }))
        window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'shapeshifter' }))
        console.log(`%cTheme switched to ${id}`, 'color: var(--plasma-bright)')
      },
      arcade: () => setArcadeOpen(true),
      status: () => {
        console.log(`%c🏆 XP: ${localStorage.getItem('forge-progress') ? JSON.parse(localStorage.getItem('forge-progress')).unlocked.length : 0} achievements`, 'color: var(--plasma)')
      },
      matrix: () => {
        import('./lib/ditherOverlay.js').then(m => {
          const isOn = m.toggleDither()
          console.log(`%c${isOn ? 'ENTERING' : 'EXITING'} THE MATRIX`, 'color: #0f0; font-size: 14px; font-weight: bold')
        })
      },
      get version() { return '3.0.0' },
      scrollTo: (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }),
    }
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
            <ParticleUniverse />
            <AmbientParticles />
            <ScrollProgress />
            <CustomCursor />
            <CommandPalette onPlayGame={openGame} onOpenArcade={openArcade} />
            <MiniGame
              open={gameOpen}
              onClose={() => setGameOpen(false)}
              onHighScore={() => window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'high-scorer' }))}
            />
            <Navbar />
            <XPBar />
            <LevelMap />
            <AchievementToast />
            <NowStatus />
            <TimeSuggestionToast />
            <IdleEasterEgg />
            <WelcomeBackToast />
            <SparkCompleteToast />
            <LevelRibbon />
            <RunComplete />
            <ExitIntent />
            <main className="relative z-[1]">
              <FluidHero>
                <ParallaxLayer speed={0.15}>
                  <Hero introDone={introDone} />
                </ParallaxLayer>
              </FluidHero>
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
            <Suspense fallback={null}>
              <ArcadeHub open={arcadeOpen} onClose={() => setArcadeOpen(false)} />
            </Suspense>
          </SmoothScrollProvider>
        </GameProvider>
        </SparkProvider>
      </SoundProvider>
    </ThemeProvider>
  )
}

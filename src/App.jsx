import { useCallback, useState, lazy, Suspense } from 'react'
import { SmoothScrollProvider } from './contexts/SmoothScrollContext.jsx'
import { SoundProvider } from './contexts/SoundContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { GameProvider } from './contexts/GameContext.jsx'
import CustomCursor from './components/ui/CustomCursor.jsx'
import Navbar from './components/ui/Navbar.jsx'
import CommandPalette from './components/ui/CommandPalette.jsx'
import NowStatus from './components/ui/NowStatus.jsx'
import XPBar from './components/ui/XPBar.jsx'
import LevelMap from './components/ui/LevelMap.jsx'
import AchievementToast from './components/ui/AchievementToast.jsx'
import MiniGame from './components/ui/MiniGame.jsx'
import ScrollProgress from './components/ui/ScrollProgress.jsx'
import { useKonamiCode } from './hooks/useKonamiCode.js'
import Hero from './components/sections/Hero.jsx'

const About = lazy(() => import('./components/sections/About.jsx'))
const PlayerStats = lazy(() => import('./components/sections/PlayerStats.jsx'))
const Skills = lazy(() => import('./components/sections/Skills.jsx'))
const Projects = lazy(() => import('./components/sections/Projects.jsx'))
const Timeline = lazy(() => import('./components/sections/Timeline.jsx'))
const Contact = lazy(() => import('./components/sections/Contact.jsx'))
const Footer = lazy(() => import('./components/sections/Footer.jsx'))

export default function App() {
  const [gameOpen, setGameOpen] = useState(false)

  const openGame = useCallback(() => {
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'secret-found' }))
    setGameOpen(true)
  }, [])

  useKonamiCode(openGame)

  return (
    <ThemeProvider>
      <SoundProvider>
        <GameProvider>
          <SmoothScrollProvider>
            <div className="grade-wash" aria-hidden="true" />
            <div className="film-grain" aria-hidden="true" />
            <ScrollProgress />
            <CustomCursor />
            <CommandPalette onPlayGame={openGame} />
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
            <main className="relative z-[1]">
              <Hero />
              <Suspense fallback={null}>
                <div className="section-divider" />
                <About />
                <div className="section-divider" />
                <PlayerStats />
                <div className="section-divider" />
                <Skills />
                <div className="section-divider" />
                <Projects />
                <div className="section-divider" />
                <Timeline />
                <div className="section-divider" />
                <Contact />
              </Suspense>
            </main>
            <Suspense fallback={null}>
              <Footer />
            </Suspense>
          </SmoothScrollProvider>
        </GameProvider>
      </SoundProvider>
    </ThemeProvider>
  )
}

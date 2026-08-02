import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initTier } from './lib/raf.js'
import { markScrollDrivenSupport } from './lib/scrollDriven.js'
import './styles/index.css'

// Establish the graphics tier and the scroll-driven-animation capability
// before the first render, so CSS gated on [data-gfx-tier] / [data-sda] never
// paints a frame in the wrong mode.
initTier()
markScrollDrivenSupport()

ReactDOM.createRoot(document.getElementById('root')).render(<App />)

// Core Web Vitals in the console during development only (P5 §7.3). The
// dynamic import sits inside a statically-false branch in production, so
// Rollup drops both the branch and the dependency from the bundle.
if (import.meta.env.DEV) {
  import('web-vitals').then(({ onLCP, onINP, onCLS, onTTFB }) => {
    const log = ({ name, value, rating }) =>
      console.log(`%c${name}%c ${Math.round(value)} %c${rating}`,
        'font-weight:bold', '', `color:${rating === 'good' ? '#3ac6c9' : '#f5a524'}`)
    ;[onLCP, onINP, onCLS, onTTFB].forEach((f) => f(log))
  })
}

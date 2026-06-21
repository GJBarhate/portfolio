# Gaurav Barhate — Portfolio

Personal portfolio website. Built with React and Vite.

**Live:** _add deployment URL here_

## Stack

- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS, custom CSS with OKLCH color space
- **Animation:** Framer Motion, GSAP, Lenis (smooth scroll)
- **Forms:** EmailJS (contact form delivery)
- **Sound:** Howler.js (optional UI sound effects)
- **Type:** Self-hosted Clash Display, Space Grotesk, JetBrains Mono

## Features

- Four full theme palettes (Deep Forest, Serene Ocean, Golden Hour, Dawn) with live CSS variable swapping
- Custom 3D-style avatar turntable that responds to scroll and drag
- Cursor-tracked aurora hero with animated grid overlay
- Working contact form wired to EmailJS for direct inbox delivery
- Command palette (⌘K / Ctrl+K)
- Hidden Snake mini-game (Konami code: ↑↑↓↓←→←→BA)
- Achievement / XP tracking system
- Fully responsive, reduced-motion aware, WCAG-focused

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build to ./dist
npm run preview      # preview the production build
```

## Environment

EmailJS credentials live in `src/lib/emailConfig.js`. The service/template/public-key
trio is intended to be client-side; EmailJS rate-limits and domain-restricts requests
from its dashboard.

## License

© Gaurav Barhate. All rights reserved.

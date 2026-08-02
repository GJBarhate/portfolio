/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // These map onto the CSS custom properties rather than restating hex
      // values. The old config hardcoded a violet/cyan palette that matched
      // none of the five themes, so any Tailwind colour utility rendered
      // off-palette and ignored the theme switcher entirely.
      colors: {
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          dim: 'var(--accent-dim)',
          bright: 'var(--accent-bright)',
          ghost: 'var(--accent-ghost)',
        },
        violet: {
          DEFAULT: 'var(--violet)',
          dim: 'var(--violet-dim)',
        },
        warm: {
          DEFAULT: 'var(--warm)',
          dim: 'var(--warm-dim)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          hi: 'var(--ink-hi)',
          mid: 'var(--ink-mid)',
          low: 'var(--ink-low)',
        },
        success: 'var(--success)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        // 'Clash Fallback' is a metric-matched local face (§8.5) so the
        // font-display: swap handoff does not reflow headlines.
        display: ['"Clash Display"', '"Clash Fallback"', '"Space Grotesk"', 'sans-serif'],
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      // §2.4 — the frozen motion vocabulary, exposed to Tailwind so a JSX
      // class can reference a token instead of inventing a number. After M2,
      // `duration-300` is a lint smell: use duration-fast / base / cinema.
      transitionTimingFunction: {
        forge: 'var(--ease-forge)',
        cinema: 'var(--ease-cinema)',
        snap: 'var(--ease-cinema)',
        anticipate: 'var(--ease-anticipate)',
        spring: 'var(--ease-spring)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        cinema: 'var(--dur-cinema)',
      },
      animationDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        cinema: 'var(--dur-cinema)',
      },
    },
  },
  plugins: [],
}

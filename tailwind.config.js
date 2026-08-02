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
        display: ['"Clash Display"', '"Space Grotesk"', 'sans-serif'],
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      transitionTimingFunction: {
        forge: 'cubic-bezier(0.16, 1, 0.3, 1)',
        snap: 'cubic-bezier(0.65, 0, 0.35, 1)',
        anticipate: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
        spring: 'var(--ease-spring)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          0: 'oklch(13% 0.01 280)',
          1: 'oklch(16% 0.015 280)',
          2: 'oklch(20% 0.02 280)',
          3: 'oklch(25% 0.025 280)',
        },
        plasma: {
          DEFAULT: 'oklch(65% 0.25 290)',
          dim: 'oklch(45% 0.18 290)',
          bright: 'oklch(78% 0.22 290)',
        },
        cyan: {
          DEFAULT: 'oklch(75% 0.15 200)',
          dim: 'oklch(55% 0.12 200)',
        },
        ink: {
          DEFAULT: 'oklch(92% 0.005 280)',
          dim: 'oklch(65% 0.01 280)',
          faint: 'oklch(45% 0.01 280)',
        },
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
      },
    },
  },
  plugins: [],
}

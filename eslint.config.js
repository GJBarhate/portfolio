import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'stats.html', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // __BUILD_DATE__ is a Vite `define` — a real global at build time.
      globals: { ...globals.browser, ...globals.es2021, __BUILD_DATE__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // JSX transform means React need not be in scope, and prop-types is not
      // used in this codebase.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],

      // ── Guardrails from PLAN.md §7.4 ──────────────────────────────────
      // The whole point of src/lib/raf.js and src/lib/glStage.js is that
      // there is exactly ONE frame loop and a single owner for GPU contexts.
      // Enforce it rather than relying on everyone remembering.
      // §11 — the two heaviest dependencies on the site may only be reached
      // from the gated islands listed in the override block below. Without
      // this, one convenience import silently puts 131 KB (or 42 KB) back on
      // the critical path and nothing fails until someone reruns Lighthouse.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three',
              message:
                'three may only be imported from lib/glStage.js, lib/threeUtils.js and the tier-gated islands (HeroForgeObject, ThreeDScene, FluidCanvas). See plan §8.2.',
            },
            {
              name: 'framer-motion',
              message:
                'framer-motion must stay out of the eager graph (§8.3). Use CSS transitions, WAAPI, or lib/raf.js; it is allowed only in lazily-mounted chunks.',
            },
          ],
        },
      ],

      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='requestAnimationFrame']",
          message:
            'Do not start a bare requestAnimationFrame loop. Subscribe to the shared scheduler: import { onFrame } from "src/lib/raf.js".',
        },
        {
          selector: "CallExpression[callee.property.name='requestAnimationFrame']",
          message:
            'Do not start a bare requestAnimationFrame loop. Use onFrame() from src/lib/raf.js.',
        },
        {
          selector: "NewExpression[callee.name='WebGLRenderer']",
          message:
            'Do not construct a WebGLRenderer directly. Register with the shared stage: src/lib/glStage.js.',
        },
        {
          selector: "NewExpression[callee.property.name='WebGLRenderer']",
          message:
            'Do not construct a WebGLRenderer directly. Register with the shared stage: src/lib/glStage.js.',
        },
      ],
    },
  },
  {
    // The scheduler and the GL stage are the two modules allowed to do the
    // things the rules above forbid — they are the implementation of them.
    files: ['src/lib/raf.js', 'src/lib/glStage.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // §11 whitelist — the only places `three` may be reached from. Every one
    // of them is behind a tier gate, a lazy() boundary, or both.
    files: [
      'src/lib/glStage.js',
      'src/lib/threeUtils.js',
      'src/components/ui/HeroForgeObject.jsx',
      'src/components/ui/ThreeDScene.jsx',
      'src/components/ui/FluidCanvas.jsx',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // framer-motion is fine inside chunks that are already lazily mounted —
    // the rule exists to keep it out of the FIRST-PAINT graph, not to ban it.
    files: [
      'src/components/sections/{About,Contact,Footer,PlayerStats,Projects,Skills,Timeline}.jsx',
      'src/components/arcade/**/*.jsx',
      'src/components/ui/{AchievementToast,ArcadeFAB,AvatarScrub,AvatarShowcase,CommandPalette,ContributionHeatmap,CountUp,Dice3D,ExitIntent,HorizontalScroll,IdleEasterEgg,LevelMap,LevelRibbon,NotFound,NowStatus,RatingGraph,Reveal,RunComplete,ScrollInkFill,SkillLanes,SplitText,TextScramble,TimeSuggestionToast,WelcomeBackToast,XPBar}.jsx',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Build-time config runs in Node, not the browser.
    files: ['*.config.js', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Build/CI scripts run in Node.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-imports': 'off' },
  },
  {
    // Playwright specs and its config run in Node too.
    files: ['tests/**/*.js', 'playwright.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-imports': 'off' },
  },
]

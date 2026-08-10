import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactCompiler from 'eslint-plugin-react-compiler'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'stats.html', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      // 'latest', not 2022: `src/lib/content.js` uses an import attribute
      // (`with { type: 'json' }`), which is ES2025 and which the loader in
      // `scripts/gen-structured-data.mjs` requires in order to import that
      // module at build time. Pinning to 2022 made ESLint fail to PARSE the
      // file, which reads like a syntax error in the source and is not.
      ecmaVersion: 'latest',
      sourceType: 'module',
      // __BUILD_DATE__ is a Vite `define` — a real global at build time.
      globals: { ...globals.browser, ...globals.es2021, __BUILD_DATE__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '19.2' } },
    plugins: { react, 'react-hooks': reactHooks, 'react-compiler': reactCompiler },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // JSX transform means React need not be in scope, and prop-types is not
      // used in this codebase.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react-compiler/react-compiler': 'warn',

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
                'three may only be imported from lib/glStage.js, lib/threeUtils.js and the tier-gated islands (HeroForgeObject, MoonForestClock, ThreeDScene, FluidCanvas). See plan §8.2.',
            },
            {
              name: 'framer-motion',
              message:
                'framer-motion must stay out of the eager graph (§8.3). Use CSS transitions, WAAPI, or lib/raf.js; it is allowed only in lazily-mounted chunks.',
            },
          ],
        },
      ],

      /*
       * Two temporal-dead-zone crashes shipped during this pass and neither
       * lint nor the type-free build said a word:
       *
       *   App.jsx            an effect read `recruiter` above its useState
       *   AppearanceConsole  an effect read `close` above its useCallback
       *
       * Both threw "Cannot access 'X' before initialization" on EVERY page
       * load in the production bundle — a white screen — and both were found
       * by an e2e gate rather than by anything that could have stopped them
       * being written. In a component body, hooks run top-to-bottom on the
       * first render, so an effect that closes over a later `const` is not a
       * hoisting subtlety, it is a crash.
       *
       * `variables: true` is the part that matters here; functions stay
       * exempt because a hoisted function declaration used earlier in a file
       * is a normal and readable pattern.
       */
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true, allowNamedExports: true }],
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
      // The tone curve and the shared environment. It is reached only from
      // glStage and the islands below, so it lands in the same lazy chunk they
      // do — the rule is about keeping `three` out of the first-paint graph,
      // and one more file inside that graph's boundary does not widen it.
      'src/lib/filmGrade.js',
      'src/components/ui/HeroForgeObject.jsx',
      'src/components/ui/MoonForestClock.jsx',
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
    files: ['*.config.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Build/CI scripts run in Node — but several of them (check-overflow)
    // carry functions that are SERIALISED into a browser via
    // `page.evaluate`, so browser globals are legitimate there too.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-imports': 'off' },
  },
  {
    // Playwright specs and its config run in Node, and their `evaluate`
    // callbacks run in the page. Vitest specs get its globals.
    files: ['tests/**/*.{js,jsx}', 'playwright.config.js', 'vitest.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        describe: 'readonly', it: 'readonly', test: 'readonly',
        expect: 'readonly', vi: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly',
        beforeAll: 'readonly', afterAll: 'readonly',
      },
    },
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-imports': 'off' },
  },
  {
    // The service worker has its own global scope — no window, no document,
    // and a `self` that is a ServiceWorkerGlobalScope.
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
    rules: { 'no-restricted-syntax': 'off' },
  },
]

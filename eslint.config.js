import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'stats.html'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
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
    // Build-time config runs in Node, not the browser.
    files: ['*.config.js', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]

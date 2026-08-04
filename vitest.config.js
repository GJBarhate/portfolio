import { defineConfig } from 'vitest/config'

/**
 * T-047 — the bottom of the test pyramid.
 *
 * One Playwright spec is not a test suite. The pure logic in `src/lib` —
 * the store and its migration chain, the tier resolver, the CLI registry, the
 * breakpoint maths, the motion scalars — is trivially unit-testable and was
 * entirely untested, which is why a change to the shape of `forge-progress`
 * could have broken every returning visitor with nothing to catch it.
 *
 * Playwright owns anything that needs a real browser; this owns everything
 * that does not, because a unit test that runs in 4 ms is a test people
 * actually run.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js', 'tests/unit/**/*.test.jsx'],
    /*
     * A run that collects nothing must FAIL, not pass quietly.
     *
     * Observed twice on this machine: `vitest run` alongside a parallel
     * Playwright matrix printed "Test Files no tests / Tests no tests" and
     * exited 0. Whatever the cause — file locking under load, a glob that
     * momentarily resolved to nothing — the outcome is a green suite that
     * asserted nothing, and green-with-zero-assertions is the single most
     * expensive way for a test suite to lie.
     */
    passWithNoTests: false,
    setupFiles: ['./tests/unit/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      /*
       * Scoped to the modules that are genuinely unit-testable — pure logic
       * with no DOM, no GL context and no frame loop.
       *
       * The alternative was a threshold over all of `src/lib`, which includes
       * `bgEngine`, `glStage`, `rawGL`, `tilt` and `raf` — modules whose real
       * failure modes are "the shader did not compile on this driver" and
       * "the governor oscillated under sustained load". Those are not
       * jsdom-testable, and a coverage number that counts them measures how
       * much untestable code exists rather than how well the testable code is
       * tested. Playwright covers them where their failures actually happen:
       * `resilience.spec.js` kills a WebGL context and asserts recovery.
       *
       * The list grows as modules become testable. It is not lowered.
       */
      include: [
        'src/lib/store.js',
        'src/lib/forgeCli.js',
        'src/lib/breakpoints.js',
        'src/lib/motion.js',
        'src/lib/formGuard.js',
        'src/lib/deviceProfile.js',
        'src/lib/effects/registry.js',
        'src/lib/siteConfig.js',
      ],
      // Set to what the suite actually holds today, so a drop is a real
      // signal rather than a number that has been red since it was written.
      // Raise them when tests are added; never lower them to make a run pass.
      thresholds: {
        lines: 55,
        functions: 52,
        statements: 55,
        branches: 56,
      },
    },
  },
})

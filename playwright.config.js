import { defineConfig, devices } from '@playwright/test'

/**
 * T-006. The visual/behavioural gate, installed properly.
 *
 * The CI job this replaces ran `npx --yes playwright@1.49.0 test`. That
 * package is not the test runner — the runner is `@playwright/test`, which
 * was not a dependency — so the one gate that would have caught the mobile
 * layout breakage had never run green in its life. It is a real dependency
 * now, pinned, with the same version installed in CI.
 *
 * The projects below are the §3.2 device matrix, one per entry, because a
 * matrix that lives inside a `for` loop in one spec file cannot be run
 * selectively, cannot be sharded, and cannot carry per-device preferences
 * like `reducedMotion`. Four extra projects cover the orthogonal preference
 * axes that have to be tested independently of viewport.
 */

/** The device matrix from §3.2. Width x height, and why each one is here. */
const VIEWPORTS = {
  'small-phone': { width: 320, height: 568 },     // the floor; nothing may overflow
  'modern-phone': { width: 390, height: 844 },    // iPhone 15/16 baseline
  'large-phone': { width: 430, height: 932 },     // Pro Max
  landscape: { width: 844, height: 390 },         // the case that breaks 100vh heroes
  'fold-closed': { width: 344, height: 882 },     // Galaxy Z Fold cover screen
  'fold-open': { width: 673, height: 841 },       // mid-breakpoint hell
  'tablet-portrait': { width: 768, height: 1024 },
  'tablet-landscape': { width: 1024, height: 768 },
  laptop: { width: 1440, height: 900 },
  desktop: { width: 1920, height: 1080 },
  ultrawide: { width: 2560, height: 1080 },
}

const chromium = devices['Desktop Chrome']

const viewportProjects = Object.entries(VIEWPORTS).map(([name, viewport]) => ({
  name,
  use: {
    ...chromium,
    viewport,
    // Everything below phone-tablet width is tested as a touch device,
    // because that is what those widths overwhelmingly are — and because the
    // 44px hit-area rules only apply under `(pointer: coarse)`.
    hasTouch: viewport.width <= 844,
    isMobile: viewport.width <= 844,
    deviceScaleFactor: viewport.width <= 844 ? 3 : 1,
  },
}))

export default defineConfig({
  testDir: './tests',
  // Playwright's default pattern also matches `*.test.js`, which is Vitest's
  // half of the pyramid (tests/unit). Two runners in one directory is fine;
  // two runners trying to run each other's files is not.
  testMatch: '**/*.spec.js',
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Deliberately not "as many workers as cores". Every worker loads a page
  // that compiles shaders and runs canvases; eight of them on one machine
  // make each page slow enough to trip its own timeout, which reads as
  // flakiness and is really contention.
  workers: process.env.CI ? 2 : 4,
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4173',
    trace: process.env.CI ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    ...viewportProjects,

    // ── the orthogonal preference axes ───────────────────────────────────
    // Each of these must be verifiable on its own: a site can be perfect at
    // every width and still be unusable with reduced motion, in forced
    // colours, or with scripting off.
    {
      name: 'reduced-motion',
      use: { ...chromium, viewport: VIEWPORTS['modern-phone'], hasTouch: true, isMobile: true, reducedMotion: 'reduce' },
    },
    {
      name: 'light-scheme',
      use: { ...chromium, viewport: VIEWPORTS.laptop, colorScheme: 'light' },
    },
    {
      name: 'forced-colors',
      use: { ...chromium, viewport: VIEWPORTS.laptop, forcedColors: 'active' },
    },
    {
      name: 'no-js',
      use: { ...chromium, viewport: VIEWPORTS.laptop, javaScriptEnabled: false },
    },
    // WebKit is the one engine where `dvh`, `<dialog>` and the safe-area
    // insets behave differently enough to matter, and it is what every iPhone
    // visitor is using.
    {
      name: 'webkit-phone',
      use: { ...devices['iPhone 15'] },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

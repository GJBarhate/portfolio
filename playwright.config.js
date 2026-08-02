import { defineConfig, devices } from '@playwright/test'

/**
 * §11 visual regression.
 *
 * Six widths × three themes on Hero / About / Projects. Machines are simply
 * better than humans at noticing that a grid collapsed into a 380px strip at
 * one breakpoint — which is the exact class of defect (L1) this matrix exists
 * to catch.
 */
export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { imagetools } from 'vite-imagetools'
import { visualizer } from 'rollup-plugin-visualizer'
import compression from 'vite-plugin-compression'
import sharp from 'sharp'
import { SITE_URL } from './src/lib/siteConfig.js'

// `vite-imagetools` may schedule several WebP → AVIF/WebP conversions at
// once. On constrained machines libvips then fails on a perfectly valid image
// with an out-of-memory/header error. Keep the responsive-image pipeline, but
// make its memory use predictable for local and CI builds.
sharp.concurrency(1)
sharp.cache({ memory: 32, files: 0, items: 16 })

/**
 * T-005 — the origin exists once, in src/lib/siteConfig.js, and is substituted
 * into index.html here. Before this, `sitemap.xml` and the canonical link
 * disagreed about what this site's URL was, and search engines believed the
 * wrong one. A token that fails loudly (the check-canonical gate) is better
 * than three copies of a string that drift quietly.
 */
function siteMeta() {
  return {
    name: 'site-meta',
    enforce: 'pre',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', SITE_URL)
    },
  }
}

/**
 * Inlines src/styles/critical.css into <head> and makes the real stylesheet
 * load without blocking render. The full sheet is ~19 KB gzipped; the first
 * viewport needs about 2 KB of it, and until it arrives the browser paints
 * nothing at all.
 */
function inlineCriticalCss() {
  return {
    name: 'inline-critical-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      const css = readFileSync(
        fileURLToPath(new URL('./src/styles/critical.css', import.meta.url)),
        'utf8'
      )
        // Strip comments and collapse whitespace — this goes into every
        // response, so every byte is paid for on each cold load.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim()

      let out = html.replace('</title>', `</title>\n    <style>${css}</style>`)

      // Swap the render-blocking <link> for a non-blocking one, keeping a
      // <noscript> copy so the page is still styled without JS.
      out = out.replace(
        /<link rel="stylesheet"([^>]*?)href="([^"]+)"([^>]*)>/g,
        (_m, pre, href, post) =>
          `<link rel="stylesheet"${pre}href="${href}"${post} media="print" onload="this.media='all';this.onload=null">` +
          `<noscript><link rel="stylesheet"${pre}href="${href}"${post}></noscript>`
      )
      return out
    },
  }
}

/**
 * Chunking. Vendor boundaries only — deliberately.
 *
 * These splits are the §8.2/§8.3 budget boundaries: `three` and
 * `framer-motion` must be reachable only from gated islands, and
 * check-budgets.mjs fails the build if either appears in the eager graph.
 *
 * A first-party `hud` group was tried here and removed, and the reason is
 * worth keeping. On a Slow-4G measurement the eleven idle-time chrome
 * components — about 1 KB each — appeared to arrive in a ten-second
 * waterfall, and grouping them into one chunk seemed an obvious win. It was
 * not, for two reasons:
 *
 *   1. Rolldown pulled `framer-motion` into the group, because the group
 *      became its principal consumer. That silently emptied the `motion`
 *      chunk the budget gate watches, and it welded 42 KB of vendor code to a
 *      chunk that changes whenever any HUD component changes — so every
 *      deploy re-downloaded a library that had not moved in a year.
 *   2. The waterfall was mostly an artifact of the measurement. `vite preview`
 *      speaks HTTP/1.1, so eleven requests queue behind six connections;
 *      production is HTTP/2 on Vercel, where they multiplex on one.
 *
 * Optimising against the harness rather than the deployment is the classic
 * version of this mistake, and the vendor split is worth more than the
 * artifact it would have fixed.
 */
function manualChunks(id) {
  if (!id.includes('node_modules')) return
  const normalised = id.split('\\').join('/')
  if (normalised.includes('node_modules/three')) return 'three'
  if (normalised.includes('framer-motion') || normalised.includes('motion-dom') || normalised.includes('motion-utils')) return 'motion'
  if (normalised.includes('react-dom') || normalised.includes('/react/')) return 'react'
  if (normalised.includes('matter-js')) return 'physics'
}

export default defineConfig({
  define: {
    // §10 trust signal — a visible last-deployed date. Freshness is a real
    // screening heuristic, and a build-time constant costs nothing at runtime.
    __BUILD_DATE__: JSON.stringify(
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    ),
  },
  plugins: [
    siteMeta(),
    react({
      babel: { plugins: [['babel-plugin-react-compiler', { target: '19' }]] },
    }),
    tailwindcss(),
    imagetools(),
    inlineCriticalCss(),
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    visualizer({ filename: 'stats.html', gzipSize: true, brotliSize: true }),
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: Boolean(process.env.PORT),
  },
  build: {
    // esnext can emit syntax that older Safari chokes on.
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    // 1600 hid exactly the problem this rebuild exists to fix.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
    rolldownOptions: {
      output: {
        manualChunks,
      },
    },
  },
})

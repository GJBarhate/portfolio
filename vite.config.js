import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { imagetools } from 'vite-imagetools'
import { visualizer } from 'rollup-plugin-visualizer'
import compression from 'vite-plugin-compression'

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

export default defineConfig({
  define: {
    // §10 trust signal — a visible last-deployed date. Freshness is a real
    // screening heuristic, and a build-time constant costs nothing at runtime.
    __BUILD_DATE__: JSON.stringify(
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    ),
  },
  plugins: [
    react(),
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
        // The function form only assigns modules that are actually reachable.
        // The object form (`{ 'three-vendor': ['three'] }`) pulled the entire
        // three package in as a chunk entry, which defeated tree-shaking.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react'
          if (id.includes('matter-js')) return 'physics'
        },
      },
    },
  },
})

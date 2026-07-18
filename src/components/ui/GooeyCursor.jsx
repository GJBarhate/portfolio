import { useEffect, useRef } from 'react'
import { useIsMobile } from '../../lib/useIsMobile.js'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

const BLOB_COUNT = 6
const EASE = 0.08

const THEME_COLORS = {
  forest: [106, 153, 85],
  ocean: [143, 184, 217],
  golden: [224, 179, 92],
  dawn: [217, 168, 94],
  obsidian: [212, 184, 118],
}

export default function GooeyCursor() {
  const canvasRef = useRef(null)
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()

  useEffect(() => {
    if (isMobile || reduced) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let w, h, dpr
    let raf
    let mouseX = -100, mouseY = -100

    const blobs = Array.from({ length: BLOB_COUNT }, (_, i) => ({
      x: -100, y: -100,
      targetX: -100, targetY: -100,
      radius: 8 - i * 0.8,
      ease: EASE - i * 0.008,
    }))

    const getColor = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'obsidian'
      return THEME_COLORS[theme] || THEME_COLORS.obsidian
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const tick = () => {
      ctx.clearRect(0, 0, w, h)

      blobs[0].targetX = mouseX
      blobs[0].targetY = mouseY
      for (let i = 0; i < BLOB_COUNT; i++) {
        if (i > 0) {
          blobs[i].targetX = blobs[i - 1].x
          blobs[i].targetY = blobs[i - 1].y
        }
        blobs[i].x += (blobs[i].targetX - blobs[i].x) * blobs[i].ease
        blobs[i].y += (blobs[i].targetY - blobs[i].y) * blobs[i].ease
      }

      const [r, g, b] = getColor()

      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = w * dpr
      tempCanvas.height = h * dpr
      const tCtx = tempCanvas.getContext('2d')
      tCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

      blobs.forEach((blob, i) => {
        const alpha = 0.7 - i * 0.08
        tCtx.beginPath()
        tCtx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2)
        tCtx.fillStyle = `rgba(${r},${g},${b},${alpha})`
        tCtx.fill()
      })

      tCtx.globalCompositeOperation = 'source-in'
      tCtx.filter = 'blur(6px) contrast(8)'
      tCtx.drawImage(tempCanvas, 0, 0)

      ctx.filter = 'blur(2px) contrast(5)'
      ctx.drawImage(tempCanvas, 0, 0, w * dpr, h * dpr, 0, 0, w, h)
      ctx.filter = 'none'

      raf = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [isMobile, reduced])

  if (isMobile || reduced) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 'var(--z-cursor)', mixBlendMode: 'screen', opacity: 0.5 }}
      aria-hidden="true"
    />
  )
}

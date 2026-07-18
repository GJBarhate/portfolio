import { useEffect, useRef } from 'react'
import { useIsMobile } from '../../lib/useIsMobile.js'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

const TRAIL_COUNT = 8
const INTERVAL_MS = 60

export default function ImageTrail({ images = [], containerRef }) {
  const canvasRef = useRef(null)
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()

  useEffect(() => {
    if (isMobile || reduced || !images.length) return
    const container = containerRef?.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext('2d')
    let raf
    let w, h, dpr
    let lastX = 0, lastY = 0, lastTime = 0
    let isHovering = false

    const trails = []
    const loadedImages = []
    let imagesReady = false

    const loadImages = async () => {
      for (const src of images.slice(0, 5)) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = src
        await new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve
        })
        if (img.naturalWidth) loadedImages.push(img)
      }
      imagesReady = loadedImages.length > 0
    }
    loadImages()

    const resize = () => {
      const rect = container.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width
      h = rect.height
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let imgIndex = 0

    const onMove = (e) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const now = Date.now()

      if (now - lastTime > INTERVAL_MS && imagesReady) {
        const dx = x - lastX
        const dy = y - lastY
        const speed = Math.sqrt(dx * dx + dy * dy)
        if (speed > 5) {
          const img = loadedImages[imgIndex % loadedImages.length]
          imgIndex++
          trails.push({
            x, y, img,
            alpha: 0.85,
            scale: 0.3 + Math.min(speed / 300, 0.4),
            rotation: (Math.random() - 0.5) * 0.3,
            born: now,
          })
          if (trails.length > TRAIL_COUNT) trails.shift()
          lastTime = now
        }
      }
      lastX = x
      lastY = y
    }

    const onEnter = () => { isHovering = true }
    const onLeave = () => { isHovering = false }

    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseenter', onEnter)
    container.addEventListener('mouseleave', onLeave)

    const tick = () => {
      ctx.clearRect(0, 0, w, h)

      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i]
        t.alpha *= 0.96

        if (t.alpha < 0.02) {
          trails.splice(i, 1)
          continue
        }

        const imgW = 120 * t.scale
        const imgH = (imgW / t.img.naturalWidth) * t.img.naturalHeight

        ctx.save()
        ctx.globalAlpha = t.alpha
        ctx.translate(t.x, t.y)
        ctx.rotate(t.rotation)

        ctx.shadowColor = 'rgba(0,0,0,0.3)'
        ctx.shadowBlur = 12
        ctx.shadowOffsetY = 4

        const radius = 8
        ctx.beginPath()
        ctx.roundRect(-imgW / 2, -imgH / 2, imgW, imgH, radius)
        ctx.clip()
        ctx.drawImage(t.img, -imgW / 2, -imgH / 2, imgW, imgH)

        ctx.restore()
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseenter', onEnter)
      container.removeEventListener('mouseleave', onLeave)
    }
  }, [images, containerRef, isMobile, reduced])

  if (isMobile || reduced) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[5]"
      aria-hidden="true"
    />
  )
}

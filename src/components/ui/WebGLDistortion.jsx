import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame, getTier } from '../../lib/raf.js'
import { getDistortionGL, createTexture } from '../../lib/rawGL.js'
import Picture from './Picture.jsx'

// Hover does not exist on touch, so the whole effect — context, shader,
// texture upload — is skipped there and the plain <picture> is all that ships.
function canHover() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/** Frame-rate independent damping (plan Research #19): k ≈ 8. */
function damp(current, target, dt, k = 8) {
  return current + (target - current) * (1 - Math.exp(-(dt / 1000) * k))
}

export default function WebGLDistortion({ picture, src, alt = '', className = '', sizes, ...props }) {
  const slotRef = useRef(null)
  const wrapperRef = useRef(null)
  const reduced = useReducedMotion()
  const [hoverCapable, setHoverCapable] = useState(false)
  // The GL texture always uses the single fallback URL; the <picture> below
  // handles responsive delivery for the visible image.
  const textureSrc = picture?.img?.src || src

  useEffect(() => {
    setHoverCapable(canHover())
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const onChange = (e) => setHoverCapable(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reduced || !hoverCapable || !textureSrc) return
    const slot = slotRef.current
    if (!slot) return

    let texture = null
    let imageAspect = 16 / 10
    let stopFrame = null
    let progress = 0
    let target = 0
    let hovering = false
    let disposed = false
    let ready = false
    const mouse = { x: 0.5, y: 0.5 }
    const smooth = { x: 0.5, y: 0.5 }

    const ctx = getDistortionGL()

    const attach = () => {
      if (ctx.canvas.parentNode !== slot) {
        ctx.canvas.className = 'absolute inset-0 w-full h-full'
        slot.appendChild(ctx.canvas)
      }
    }
    const detach = () => {
      if (ctx.canvas.parentNode === slot) slot.removeChild(ctx.canvas)
    }

    const init = () => {
      if (ready || disposed || !ctx.gl) return
      ready = true
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.src = textureSrc
      const upload = () => {
        if (disposed) return
        imageAspect = (img.naturalWidth || 16) / (img.naturalHeight || 10)
        texture = createTexture(img)
        /* `start` is declared below, and this callback only runs on the
           image's `load` event — by which time it is assigned.
           `no-use-before-define` is enabled for the shape that actually
           crashed twice in this repo (an effect body reading a later `const`
           on mount); this is the deferred-callback shape, and hoisting `start`
           to here would move it into the wrong closure. */
        // eslint-disable-next-line no-use-before-define
        start()
      }
      if (img.complete && img.naturalWidth) upload()
      else img.addEventListener('load', upload, { once: true })
    }

    const draw = (_t, dt) => {
      const { gl, uniforms } = ctx
      if (disposed || !gl || !texture) { stopFrame?.(); stopFrame = null; return }

      progress = damp(progress, target, dt, hovering ? 9 : 7)
      smooth.x = damp(smooth.x, mouse.x, dt, 10)
      smooth.y = damp(smooth.y, mouse.y, dt, 10)

      const rect = slot.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const dpr = Math.min(window.devicePixelRatio || 1, getTier() >= 3 ? 1.75 : 1.25)
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (ctx.canvas.width !== w || ctx.canvas.height !== h) {
        ctx.canvas.width = w
        ctx.canvas.height = h
      }
      gl.viewport(0, 0, w, h)

      // eslint-disable-next-line react-compiler/react-compiler -- WebGL API method, not a React hook
      gl.useProgram(ctx.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1f(uniforms.uProgress, progress)
      gl.uniform2f(uniforms.uMouse, smooth.x, smooth.y)
      gl.uniform1f(uniforms.uImageAspect, imageAspect)
      gl.uniform1f(uniforms.uBoxAspect, rect.width / rect.height)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      // Once the effect has decayed the loop unsubscribes and the canvas is
      // taken back out of the DOM, so a resting grid costs exactly nothing.
      if (!hovering && progress <= 0.002) {
        stopFrame?.()
        stopFrame = null
        progress = 0
        detach()
      }
    }

    const start = () => {
      if (!stopFrame && !disposed && texture) stopFrame = onFrame(draw, { band: 'ambient' })
    }

    const onMove = (e) => {
      const rect = slot.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      mouse.x = (e.clientX - rect.left) / rect.width
      mouse.y = 1 - (e.clientY - rect.top) / rect.height
    }
    const onEnter = (e) => {
      hovering = true
      target = 1
      onMove(e)
      smooth.x = mouse.x
      smooth.y = mouse.y
      init()
      attach()
      start()
    }
    const onLeave = () => {
      hovering = false
      target = 0
      start()
    }

    const host = wrapperRef.current || slot
    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('pointermove', onMove, { passive: true })

    // The shared scheduler already skips every subscriber while the tab is
    // hidden, so no per-component visibility handling is needed here.

    return () => {
      disposed = true
      stopFrame?.()
      detach()
      host.removeEventListener('pointerenter', onEnter)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('pointermove', onMove)
      if (texture && ctx.gl) ctx.gl.deleteTexture(texture)
      texture = null
    }
  }, [reduced, textureSrc, hoverCapable])

  return (
    <div ref={wrapperRef} className="absolute inset-0 w-full h-full overflow-hidden">
      {picture ? (
        <Picture
          picture={picture}
          alt={alt}
          sizes={sizes}
          className={'w-full h-full object-cover object-top ' + className}
          {...props}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          width="1600"
          height="900"
          className={'w-full h-full object-cover object-top ' + className}
          {...props}
        />
      )}
      {!reduced && hoverCapable && (
        // A plain slot; the shared canvas is moved in and out of it on hover.
        <div ref={slotRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      )}
    </div>
  )
}

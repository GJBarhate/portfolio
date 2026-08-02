import { useEffect, useRef, useState } from 'react'
import {
  Scene,
  OrthographicCamera,
  TextureLoader,
  LinearFilter,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Vector2,
} from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL } from '../../lib/threeUtils.js'
import { onFrame } from '../../lib/raf.js'
import { getOverlayRenderer } from '../../lib/glStage.js'
import Picture from './Picture.jsx'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uProgress;
  uniform vec2 uMouse;
  uniform vec2 uResolution;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 res = uResolution;
    float aspect = res.x / res.y;
    vec2 centered = uv * 2.0 - 1.0;
    centered.x *= aspect;
    vec2 mouse = uMouse * 2.0 - 1.0;
    mouse.x *= aspect;
    float dist = distance(centered, mouse);
    float influence = smoothstep(0.6, 0.0, dist) * uProgress;
    vec2 offset = (centered - mouse) * influence * 0.08;
    vec2 distorted = uv + offset;
    float r = texture2D(uTexture, distorted + vec2(influence * 0.02, 0.0)).r;
    float g = texture2D(uTexture, distorted).g;
    float b = texture2D(uTexture, distorted - vec2(influence * 0.02, 0.0)).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }
`

// Hover does not exist on touch, so the whole effect — renderer, shader,
// texture upload — is skipped there and the plain <img> is all that ships.
function canHover() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export default function WebGLDistortion({ picture, src, alt = '', className = '', sizes, ...props }) {
  const canvasRef = useRef(null)
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
    if (reduced || !hoverCapable) return
    const slot = canvasRef.current
    if (!slot) return

    // Scene resources are created on the first pointerenter, never on mount,
    // and the RENDERER is a single module-level singleton shared by every
    // card — only one can be hovered at a time, so one context is enough.
    // This is where five of the original nine WebGL contexts came from.
    let gl = null
    let stopFrame = null
    let progress = 0
    let targetProgress = 0
    let hovering = false
    let disposed = false
    const pendingMouse = new Vector2(0.5, 0.5)

    const sizeToCanvas = () => {
      if (!gl) return
      const rect = slot.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      gl.renderer.setSize(rect.width, rect.height, false)
      gl.material.uniforms.uResolution.value.set(rect.width, rect.height)
    }

    // Move the one shared canvas into this card, and take it back out again
    // when the effect has faded.
    const attach = () => {
      const { canvas } = getOverlayRenderer()
      canvas.className = 'absolute inset-0 w-full h-full transition-opacity duration-500'
      canvas.style.opacity = '1'
      if (canvas.parentNode !== slot) slot.appendChild(canvas)
    }
    const detach = () => {
      const { canvas } = getOverlayRenderer()
      if (canvas.parentNode === slot) {
        canvas.style.opacity = '0'
        slot.removeChild(canvas)
      }
    }

    const init = () => {
      if (gl || disposed) return
      if (!checkWebGL().supported) return

      const { renderer } = getOverlayRenderer()

      const scene = new Scene()
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
      camera.position.z = 1

      const texture = new TextureLoader().load(textureSrc, () => {
        // First frame can only be meaningful once the texture has decoded.
        if (!disposed) start()
      })
      texture.minFilter = LinearFilter
      texture.magFilter = LinearFilter

      const geometry = new PlaneGeometry(2, 2)
      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTexture: { value: texture },
          uProgress: { value: 0 },
          uMouse: { value: pendingMouse.clone() },
          uResolution: { value: new Vector2(1, 1) },
        },
      })
      const mesh = new Mesh(geometry, material)
      scene.add(mesh)

      gl = { renderer, scene, camera, texture, geometry, material, mesh }
      sizeToCanvas()
    }

    // The loop runs only while the effect is settling or the pointer is inside.
    // Once progress decays to ~0 it unsubscribes and the canvas costs nothing.
    const loop = () => {
      if (disposed || !gl) { stopFrame?.(); stopFrame = null; return }
      progress += (targetProgress - progress) * (hovering ? 0.08 : 0.06)
      gl.material.uniforms.uProgress.value = progress
      gl.material.uniforms.uMouse.value.copy(pendingMouse)
      gl.renderer.render(gl.scene, gl.camera)
      if (!hovering && progress <= 0.001) {
        stopFrame?.()
        stopFrame = null
        progress = 0
        detach()
      }
    }

    const start = () => {
      if (!stopFrame && !disposed && gl) stopFrame = onFrame(loop)
    }

    const onEnter = (e) => {
      hovering = true
      targetProgress = 1
      init()
      if (!gl) return
      onMove(e)
      attach()
      sizeToCanvas()
      start()
    }
    const onLeave = () => {
      hovering = false
      targetProgress = 0
      start()
    }
    const onMove = (e) => {
      const rect = slot.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pendingMouse.set(
        (e.clientX - rect.left) / rect.width,
        1 - (e.clientY - rect.top) / rect.height
      )
    }

    const host = wrapperRef.current || slot
    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('pointermove', onMove)

    const ro = new ResizeObserver(() => sizeToCanvas())
    ro.observe(slot)

    // The shared scheduler already skips every subscriber while the tab is
    // hidden, so no per-component visibility handling is needed here.

    return () => {
      disposed = true
      stopFrame?.()
      detach()
      ro.disconnect()
      host.removeEventListener('pointerenter', onEnter)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('pointermove', onMove)
      if (gl) {
        // The renderer is shared and outlives this component; only the
        // per-card scene resources are disposed here.
        gl.geometry.dispose()
        gl.material.dispose()
        gl.texture.dispose()
        gl = null
      }
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
        <div ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      )}
    </div>
  )
}

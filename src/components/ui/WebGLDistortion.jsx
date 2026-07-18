import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'

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

export default function WebGLDistortion({ src, alt = '', className = '', ...props }) {
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const webgl = checkWebGL()
    if (!webgl.supported) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 1

    const loader = new THREE.TextureLoader()
    const texture = loader.load(src)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uProgress: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(1, 1) },
      },
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    let progress = 0
    let targetProgress = 0
    let hovering = false
    let canvasVisible = false

    const onEnter = () => {
      hovering = true
      targetProgress = 1
      canvasVisible = true
      canvas.style.opacity = '1'
    }
    const onLeave = () => {
      hovering = false
      targetProgress = 0
      setTimeout(() => {
        if (!hovering) {
          canvasVisible = false
          canvas.style.opacity = '0'
        }
      }, 600)
    }
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      material.uniforms.uMouse.value.set(
        (e.clientX - rect.left) / rect.width,
        1 - (e.clientY - rect.top) / rect.height
      )
    }

    canvas.addEventListener('mouseenter', onEnter)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('mousemove', onMove)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height)
      material.uniforms.uResolution.value.set(rect.width, rect.height)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement || canvas)
    resize()

    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      progress += (targetProgress - progress) * (hovering ? 0.08 : 0.04)
      material.uniforms.uProgress.value = progress
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mouseenter', onEnter)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('mousemove', onMove)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [reduced, src])

  return (
    <div ref={wrapperRef} className="absolute inset-0 w-full h-full overflow-hidden">
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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full transition-opacity duration-500"
        aria-hidden="true"
        style={{ opacity: 0 }}
      />
    </div>
  )
}

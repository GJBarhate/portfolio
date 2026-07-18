import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'

const COUNT = 250

export default function ParticleUniverse() {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const container = containerRef.current
    if (!container) return
    const webgl = checkWebGL()
    if (!webgl.supported) return

    const colors = getThemeColors()
    const accent = new THREE.Color(colors.plasma)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    camera.position.z = 300

    const positions = new Float32Array(COUNT * 3)
    const sizes = new Float32Array(COUNT)
    const opacities = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 100 + Math.random() * 150
      positions[i3] = Math.sin(phi) * Math.cos(theta) * r
      positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * r
      positions[i3 + 2] = Math.cos(phi) * r
      sizes[i] = 0.5 + Math.random() * 1.0
      opacities[i] = 0.1 + Math.random() * 0.25
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: accent },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;
        uniform vec3 uColor;
        uniform float uPixelRatio;
        varying float vOpacity;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = length(mvPosition.xyz);
          vOpacity = opacity * clamp(1.0 - dist / 350.0, 0.0, 0.6);
          gl_PointSize = size * uPixelRatio * (80.0 / dist);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d) * vOpacity;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const points = new THREE.Points(geo, mat)
    scene.add(points)

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', resize)
    resize()

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      accent.set(c.plasma)
      mat.uniforms.uColor.value = accent
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let visible = !document.hidden
    let inView = true
    document.addEventListener('visibilitychange', () => { visible = !document.hidden })
    const ivObserver = new IntersectionObserver(([e]) => { inView = e.isIntersecting }, { threshold: 0 })
    ivObserver.observe(container)

    let raf
    let time = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible || !inView) return
      time += 0.002
      points.rotation.y = time * 0.02
      points.rotation.x = Math.sin(time * 0.01) * 0.02
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      ivObserver.disconnect()
      window.removeEventListener('resize', resize)
      geo.dispose()
      mat.dispose()
      scene.remove(points)
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [reduced])

  return <div ref={containerRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true" />
}

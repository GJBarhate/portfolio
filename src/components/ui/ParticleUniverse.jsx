import { useEffect, useRef } from 'react'
import {
  Color,
  Scene,
  PerspectiveCamera,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  Points,
} from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'
import { getTier, onTierChange } from '../../lib/raf.js'
import { register } from '../../lib/glStage.js'

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
    const accent = new Color(colors.accent)

    // Drawn by the shared stage — this used to hold one of the nine live
    // WebGL contexts all by itself.
    const scene = new Scene()
    const camera = new PerspectiveCamera(60, 1, 0.1, 1000)
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

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('size', new BufferAttribute(sizes, 1))
    geo.setAttribute('opacity', new BufferAttribute(opacities, 1))
    // Tier 2 halves the visible particle count without reallocating buffers.
    geo.setDrawRange(0, getTier() >= 3 ? COUNT : Math.floor(COUNT / 2))

    const mat = new ShaderMaterial({
      uniforms: {
        uColor: { value: accent },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
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
      blending: AdditiveBlending,
    })

    const points = new Points(geo, mat)
    scene.add(points)

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      accent.set(c.accent)
      mat.uniforms.uColor.value = accent
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const offTier = onTierChange((t) => {
      geo.setDrawRange(0, t >= 3 ? COUNT : Math.floor(COUNT / 2))
      mat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, t >= 3 ? 2 : 1.5)
    })

    // This layer is `fixed inset-0`, so it is always intersecting — an
    // IntersectionObserver here would never gate anything. The shared
    // scheduler's document.hidden check plus the tier governor are the real
    // guards; below tier 2 the layer does not render at all.
    let time = 0
    const stage = register({
      element: container,
      scene,
      camera,
      onFrame: (_, dt) => {
        if (getTier() < 2) return
        time += 0.002 * (dt / 16.7)
        points.rotation.y = time * 0.02
        points.rotation.x = Math.sin(time * 0.01) * 0.02
      },
    })

    return () => {
      stage.dispose()
      offTier()
      observer.disconnect()
      geo.dispose()
      mat.dispose()
      scene.remove(points)
    }
  }, [reduced])

  return <div ref={containerRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true" />
}

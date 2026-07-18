import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'

// §3.2 — a floating, slowly rotating low-poly "forge" monolith with emissive
// edges. Reacts to cursor (magnetic tilt) and mouse-down (spark burst).
export default function HeroForgeObject({ className = '' }) {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const webgl = checkWebGL()
    if (!webgl.supported) return

    const colors = getThemeColors()
    const accent = new THREE.Color(colors.plasma)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0, 5)

    const ambient = new THREE.AmbientLight(0x404060, 0.6)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 1)
    key.position.set(3, 4, 5)
    scene.add(key)

    // Low-poly monolith: an elongated octahedron reads as an "anvil/shard."
    const geo = new THREE.OctahedronGeometry(1.15, 0)
    geo.scale(0.62, 1.35, 0.62)
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#161616'),
      emissive: accent,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.55,
      flatShading: true,
    })
    const monolith = new THREE.Mesh(geo, mat)
    scene.add(monolith)

    // Emissive wireframe edges — the "glowing seams" look.
    const edgesGeo = new THREE.EdgesGeometry(geo)
    const edgesMat = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.9 })
    const edges = new THREE.LineSegments(edgesGeo, edgesMat)
    monolith.add(edges)

    // Spark burst particles (mouse-down) — pooled, reused.
    const SPARK_COUNT = 40
    const sparkGeo = new THREE.BufferGeometry()
    const sparkPositions = new Float32Array(SPARK_COUNT * 3)
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3))
    const sparkMat = new THREE.PointsMaterial({ color: accent, size: 0.05, transparent: true, opacity: 0 })
    const sparks = new THREE.Points(sparkGeo, sparkMat)
    scene.add(sparks)
    const sparkVel = Array.from({ length: SPARK_COUNT }, () => new THREE.Vector3())
    let sparkLife = 0 // 0 = dormant, >0 = counting down

    const burstSparks = () => {
      if (reduced) return
      sparkLife = 1
      for (let i = 0; i < SPARK_COUNT; i++) {
        const dir = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(0.02 + Math.random() * 0.03)
        sparkVel[i].copy(dir)
        sparkPositions[i * 3] = 0
        sparkPositions[i * 3 + 1] = 0
        sparkPositions[i * 3 + 2] = 0
      }
    }
    container.addEventListener('mousedown', burstSparks)

    let clickTimes = []
    const pokeHandler = () => {
      const now = Date.now()
      clickTimes = clickTimes.filter((t) => now - t < 2000)
      clickTimes.push(now)
      if (clickTimes.length >= 5) {
        clickTimes = []
        monolith.rotation.z = 0.5
        monolith.rotation.x = -0.3
        setTimeout(() => {
          monolith.rotation.z = -0.4
          monolith.rotation.x = 0.2
        }, 100)
        setTimeout(() => {
          monolith.rotation.z = 0
          monolith.rotation.x = 0
        }, 300)
        window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'poke-master' }))
      }
    }
    container.addEventListener('click', pokeHandler)

    // Magnetic tilt toward cursor (eased, GPU-cheap — plain rotation lerp).
    let targetTiltX = 0
    let targetTiltY = 0
    const onMove = (e) => {
      const rect = container.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      targetTiltY = nx * 0.5
      targetTiltX = -ny * 0.35
    }
    if (!reduced) window.addEventListener('pointermove', onMove)

    let visible = !document.hidden
    let inView = true
    const onVisibility = () => { visible = !document.hidden }
    document.addEventListener('visibilitychange', onVisibility)
    const ivObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting }, { threshold: 0 })
    ivObserver.observe(container)

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      const next = new THREE.Color(c.plasma)
      mat.emissive.set(next)
      edgesMat.color.set(next)
      sparkMat.color.set(next)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let raf
    let time = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible || !inView) return
      time += 0.01

      if (!reduced) {
        monolith.rotation.y += 0.004
        monolith.rotation.x += (targetTiltX - monolith.rotation.x) * 0.05
        monolith.rotation.z += (targetTiltY * 0.6 - monolith.rotation.z) * 0.05
        monolith.position.y = Math.sin(time * 0.6) * 0.12
      }

      if (sparkLife > 0) {
        sparkLife -= 0.018
        sparkMat.opacity = Math.max(0, sparkLife)
        for (let i = 0; i < SPARK_COUNT; i++) {
          sparkPositions[i * 3] += sparkVel[i].x
          sparkPositions[i * 3 + 1] += sparkVel[i].y - 0.0015
          sparkPositions[i * 3 + 2] += sparkVel[i].z
        }
        sparkGeo.attributes.position.needsUpdate = true
      }

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      ivObserver.disconnect()
      window.removeEventListener('pointermove', onMove)
      container.removeEventListener('mousedown', burstSparks)
      container.removeEventListener('click', pokeHandler)
      ro.disconnect()
      observer.disconnect()
      geo.dispose()
      edgesGeo.dispose()
      sparkGeo.dispose()
      mat.dispose()
      edgesMat.dispose()
      sparkMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [reduced])

  return (
    <div
      ref={containerRef}
      className={'w-full h-full ' + className}
      data-cursor="crosshair"
      aria-hidden="true"
    />
  )
}

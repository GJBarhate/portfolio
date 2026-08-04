import { useEffect, useRef } from 'react'
import {
  Color,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Mesh,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  Vector3,
  DataTexture,
  RGBAFormat,
  UnsignedByteType,
  LinearFilter,
  EquirectangularReflectionMapping,
} from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'
import { onFrame, getTier } from '../../lib/raf.js'
import { createAnchoredRenderer } from '../../lib/glStage.js'
import { onTilt } from '../../lib/tilt.js'

/**
 * A tiny procedural environment map. Two kilobytes of gradient is enough to
 * give the metal specular variation across its faces, which is what stops a
 * low-poly solid from reading as flat shaded cardboard.
 */
function makeEnvTexture(accent) {
  const W = 16
  const H = 32
  const data = new Uint8Array(W * H * 4)
  const top = new Color('#7d90b8')
  const bottom = new Color('#08090c')
  const tmp = new Color()
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    // Sky at the top, ground at the bottom, a band of accent near the horizon
    // so the rim of the object picks up the theme colour.
    tmp.copy(bottom).lerp(top, Math.pow(1 - t, 1.6))
    const horizon = Math.exp(-Math.pow((t - 0.55) * 6, 2))
    tmp.lerp(accent, horizon * 0.5)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      data[i] = Math.round(tmp.r * 255)
      data[i + 1] = Math.round(tmp.g * 255)
      data[i + 2] = Math.round(tmp.b * 255)
      data[i + 3] = 255
    }
  }
  const tex = new DataTexture(data, W, H, RGBAFormat, UnsignedByteType)
  tex.mapping = EquirectangularReflectionMapping
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

// §3.2 — a floating, rotating low-poly "forge" gem with emissive edges.
// Reacts to cursor (magnetic tilt), scroll, and mouse-down (spark burst).
export default function HeroForgeObject({ className = '' }) {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const webgl = checkWebGL()
    if (!webgl.supported) return
    if (getTier() < 2) return

    const colors = getThemeColors()
    const accent = new Color(colors.accent)

    // Anchored canvas: this scene sits on top of the hero's opaque backdrop,
    // so it cannot be drawn by the behind-content scissor stage.
    const { renderer, dispose: disposeRenderer } = createAnchoredRenderer(container)

    const scene = new Scene()
    const camera = new PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0, 5)

    let envTex = makeEnvTexture(accent)

    scene.add(new AmbientLight(0x404060, 0.35))

    const key = new DirectionalLight(0xffffff, 1.6)
    key.position.set(3, 4, 5)
    scene.add(key)

    // The rim/back light in the accent colour is the single change that turns
    // a flat silhouette into a solid object.
    const rim = new DirectionalLight(accent.getHex(), 2.2)
    rim.position.set(-4, 1, -3)
    scene.add(rim)

    const fill = new HemisphereLight(0x223044, 0x0a0a0c, 0.5)
    scene.add(fill)

    // 80 faces reads as a cut gem rather than the 8-triangle slab it was.
    const geo = new IcosahedronGeometry(1.05, 1)
    geo.scale(0.78, 1.18, 0.78)
    const mat = new MeshStandardMaterial({
      color: new Color('#161616'),
      emissive: accent,
      emissiveIntensity: 0.28,
      roughness: 0.28,
      metalness: 0.7,
      envMap: envTex,
      envMapIntensity: 1.1,
      flatShading: true,
    })
    const monolith = new Mesh(geo, mat)
    scene.add(monolith)

    // Emissive wireframe edges — the "glowing seams" look.
    const edgesGeo = new EdgesGeometry(geo)
    const edgesMat = new LineBasicMaterial({ color: accent, transparent: true, opacity: 0.55 })
    const edges = new LineSegments(edgesGeo, edgesMat)
    monolith.add(edges)

    // Spark burst particles (mouse-down) — pooled, reused.
    const SPARK_COUNT = 40
    const sparkGeo = new BufferGeometry()
    const sparkPositions = new Float32Array(SPARK_COUNT * 3)
    sparkGeo.setAttribute('position', new BufferAttribute(sparkPositions, 3))
    const sparkMat = new PointsMaterial({ color: accent, size: 0.05, transparent: true, opacity: 0 })
    const sparks = new Points(sparkGeo, sparkMat)
    scene.add(sparks)
    const sparkVel = Array.from({ length: SPARK_COUNT }, () => new Vector3())
    let sparkLife = 0 // 0 = dormant, >0 = counting down

    const burstSparks = () => {
      if (reduced) return
      sparkLife = 1
      for (let i = 0; i < SPARK_COUNT; i++) {
        const dir = new Vector3(
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
    // Fired from the pointerdown handler below rather than a `mousedown`
    // listener: touch only synthesises `mousedown` after the gesture resolves
    // as a tap, so a drag — the thing most worth rewarding with sparks — never
    // produced any on a phone.

    // Rotation state is composed each frame from tilt + scroll + spin, so a
    // poke has to add an impulse rather than assign rotation directly.
    let tiltX = 0
    let tiltZ = 0
    let targetTiltX = 0
    let targetTiltZ = 0
    let scrollRot = 0
    let spin = 0

    let clickTimes = []
    const pokeHandler = () => {
      const now = Date.now()
      clickTimes = clickTimes.filter((t) => now - t < 2000)
      clickTimes.push(now)
      if (clickTimes.length >= 5) {
        clickTimes = []
        tiltZ += 0.6
        tiltX -= 0.35
        window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'poke-master' }))
      }
    }
    container.addEventListener('click', pokeHandler)

    /*
     * Magnetic lean.
     *
     * This used to read the cursor directly, which meant it did nothing at all
     * on a phone — the object sat perfectly upright, spinning, ignoring the
     * viewer. It now reads the shared lean signal, which is the cursor on a
     * desktop and the gyroscope on a handset. Tilting the phone leans the gem,
     * and it is the same code path either way.
     */
    let offTilt = null
    if (!reduced) {
      offTilt = onTilt(({ x, y }) => {
        targetTiltZ = x * 0.30
        targetTiltX = -y * 0.26
      })
    }

    /*
     * Drag to spin. `touch-action: pan-y` on the container is what makes this
     * safe: the browser keeps ownership of vertical scrolling, so a drag down
     * the page still scrolls the page even when it starts on the gem, and only
     * the horizontal component reaches us. Taking the whole gesture would have
     * turned a 300px-wide region of the hero into a scroll dead zone.
     */
    let dragging = false
    let dragId = null
    let lastX = 0
    let lastMoveT = 0
    /* Angular velocity in radians per SECOND, so the throw that survives a
       release does not depend on how often the device happened to sample the
       finger. Storing a per-event delta instead would make the same gesture
       spin twice as far on a 120 Hz screen. */
    let dragMomentum = 0
    const MAX_MOMENTUM = 12

    const onDragStart = (e) => {
      if (reduced) return
      dragging = true
      dragId = e.pointerId
      lastX = e.clientX
      lastMoveT = e.timeStamp || performance.now()
      dragMomentum = 0
      burstSparks()
      container.setPointerCapture?.(e.pointerId)
    }
    const onDragMove = (e) => {
      if (!dragging || e.pointerId !== dragId) return
      const now = e.timeStamp || performance.now()
      const elapsed = Math.max(8, now - lastMoveT)
      lastMoveT = now
      const dx = e.clientX - lastX
      lastX = e.clientX
      // Radians per pixel — a full drag across a phone spins it roughly twice.
      const delta = dx * 0.012
      spin += delta
      dragMomentum = Math.max(-MAX_MOMENTUM, Math.min(MAX_MOMENTUM, (delta / elapsed) * 1000))
    }
    const onDragEnd = (e) => {
      if (!dragging || (dragId !== null && e.pointerId !== dragId)) return
      dragging = false
      dragId = null
      container.releasePointerCapture?.(e.pointerId)
    }

    container.addEventListener('pointerdown', onDragStart, { passive: true })
    container.addEventListener('pointermove', onDragMove, { passive: true })
    container.addEventListener('pointerup', onDragEnd, { passive: true })
    container.addEventListener('pointercancel', onDragEnd, { passive: true })

    // Scroll-linked rotation makes the hero feel authored rather than
    // decorative — the object does something as the visitor moves down.
    const onScroll = () => {
      const max = Math.max(1, window.innerHeight)
      scrollRot = Math.min(window.scrollY / max, 1.5) * 0.9
    }
    if (!reduced) window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      const next = new Color(c.accent)
      mat.emissive.set(next)
      edgesMat.color.set(next)
      sparkMat.color.set(next)
      rim.color.set(next)
      const prev = envTex
      envTex = makeEnvTexture(next)
      mat.envMap = envTex
      mat.needsUpdate = true
      prev.dispose()
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let inView = false
    const ivObserver = new IntersectionObserver(([e]) => { inView = e.isIntersecting }, { threshold: 0 })
    ivObserver.observe(container)

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    let time = 0
    // Whether this object exists at all is decided once, at mount, from the
    // tier. Re-asking every frame meant a tier change mid-session froze it in
    // mid-air — and a solid object stopped dead reads as a broken page, which
    // is a worse outcome than the frames it was trying to save.
    const stop = onFrame((_, rawDt) => {
      if (!inView) return
      // Radians per *second*, so the object looks identical on 60 Hz and
      // 144 Hz displays. Clamped so a stalled tab cannot spin it wildly.
      const dt = Math.min(rawDt / 1000, 0.05)
      time += dt

      if (!reduced) {
        // Idle drift is ~6 s per revolution. While a finger is down the move
        // handler owns the rotation outright — adding anything here as well
        // would double-count it, and a finger resting mid-drag would keep the
        // gem spinning on its last delta forever. The stored velocity is only
        // decayed, so letting go after holding still throws nothing.
        if (dragging) {
          dragMomentum *= Math.exp(-dt * 6)
        } else {
          spin += 1.05 * dt + dragMomentum * dt
          dragMomentum *= Math.exp(-dt * 3.2)
          if (Math.abs(dragMomentum) < 0.01) dragMomentum = 0
        }
        tiltX += (targetTiltX - tiltX) * Math.min(1, dt * 3)
        tiltZ += (targetTiltZ - tiltZ) * Math.min(1, dt * 3)
        monolith.rotation.y = spin
        monolith.rotation.x = tiltX + scrollRot
        monolith.rotation.z = tiltZ
        monolith.position.y = Math.sin(time * 1.1) * 0.16
      }

      if (sparkLife > 0) {
        sparkLife -= dt * 1.1
        sparkMat.opacity = Math.max(0, sparkLife)
        const step = dt * 60
        for (let i = 0; i < SPARK_COUNT; i++) {
          sparkPositions[i * 3] += sparkVel[i].x * step
          sparkPositions[i * 3 + 1] += (sparkVel[i].y - 0.0015) * step
          sparkPositions[i * 3 + 2] += sparkVel[i].z * step
        }
        sparkGeo.attributes.position.needsUpdate = true
      }

      renderer.render(scene, camera)
    }, { band: 'ambient', critical: true })

    return () => {
      stop()
      ivObserver.disconnect()
      ro.disconnect()
      disposeRenderer()
      offTilt?.()
      window.removeEventListener('scroll', onScroll)
      container.removeEventListener('pointerdown', onDragStart)
      container.removeEventListener('pointermove', onDragMove)
      container.removeEventListener('pointerup', onDragEnd)
      container.removeEventListener('pointercancel', onDragEnd)
      container.removeEventListener('click', pokeHandler)
      observer.disconnect()
      geo.dispose()
      edgesGeo.dispose()
      sparkGeo.dispose()
      mat.dispose()
      edgesMat.dispose()
      sparkMat.dispose()
      envTex.dispose()
    }
  }, [reduced])

  return (
    <div
      ref={containerRef}
      className={'hero-forge-object w-full h-full ' + className}
      data-cursor="crosshair"
      aria-hidden="true"
    />
  )
}

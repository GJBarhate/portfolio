import { useEffect, useRef } from 'react'
import {
  Color,
  Scene,
  PerspectiveCamera,
  DirectionalLight,
  IcosahedronGeometry,
  MeshPhysicalMaterial,
  Mesh,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  Vector3,
} from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'
import { onFrame, getTier } from '../../lib/raf.js'
import { createAnchoredRenderer } from '../../lib/glStage.js'
import { onTilt } from '../../lib/tilt.js'
import { makeEnvironment } from '../../lib/filmGrade.js'
import { armScrollVelocity, getScrollVelocity } from '../../lib/scrollVelocity.js'

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

    let envTex = makeEnvironment(accent)
    // The environment lights the whole scene, not just this material's
    // reflections. That is the difference between an object with a lit side
    // and a dead side, and an object that is *in* somewhere.
    scene.environment = envTex

    /*
     * Two lamps, not four.
     *
     * The ambient and the hemisphere fill were both doing the job the
     * environment now does properly — light arriving from every direction —
     * and leaving them in alongside it double-counted every surface. The first
     * pass of this change did exactly that and the gem came out as a flat
     * teal pebble: everything lit, nothing shaped.
     *
     * What is left is what an environment cannot give you: one hard key for
     * the facet edges, and the accent rim from behind that separates the
     * silhouette from the backdrop.
     */
    const key = new DirectionalLight(0xffffff, 1.6)
    key.position.set(3, 4, 5)
    scene.add(key)

    // 1.2, down from 2.2. The rim's job is to separate the silhouette from the
    // backdrop, and at the old strength it was doing considerably more than
    // that — painting every facet the accent colour and burying the white key
    // reflection that carries the rotation.
    const rim = new DirectionalLight(accent.getHex(), 1.2)
    rim.position.set(-4, 1, -3)
    scene.add(rim)

    // 80 faces reads as a cut gem rather than the 8-triangle slab it was.
    const geo = new IcosahedronGeometry(1.05, 1)
    geo.scale(0.78, 1.18, 0.78)
    /*
     * Thin-film interference, not a rainbow gradient.
     *
     * The "expensive glass" look everyone recognises is dispersion: white
     * light splitting into its components at a surface. Doing it by
     * refraction means a transmission pass — the scene rendered a second time
     * into a buffer — which this frame budget does not have.
     *
     * Iridescence is the other real mechanism for the same phenomenon, and it
     * is free: a film a few hundred nanometres thick makes reflections
     * interfere with themselves, and which wavelength survives depends on the
     * viewing angle. That is a per-channel effect computed in the existing
     * shading pass, with no second render. On a faceted solid that is turning,
     * every facet crosses a different part of the spectrum as it comes round.
     */
    const mat = new MeshPhysicalMaterial({
      color: new Color('#161616'),
      emissive: accent,
      /*
       * 0.28 -> 0.10.
       *
       * A metal with a near-black base colour reflects almost nothing
       * diffusely, so whatever emissive it carries is essentially the entire
       * visible surface — at 0.28 the gem was a flat teal pebble with faint
       * seams, and no amount of lighting could show through it. Emission is
       * meant to be the glow in the seams and the inner heat, not the paint.
       *
       * Dropping it is what lets the environment, the key and the thin film
       * actually reach the eye. The scroll-velocity boost below still lifts it
       * back up when the visitor moves, which now reads as the object heating
       * rather than as a lamp being switched on.
       *
       * 0.10 went too far in the other direction: on the light themes the gem
       * became a dark silhouette, and this object is the single claim the
       * whole hero makes. 0.19 is where it holds both — the facets keep the
       * light that shows their planes, and the stone is still visibly lit from
       * inside rather than merely dark.
       */
      emissiveIntensity: 0.19,
      /*
       * Polished stone under a clear lacquer — not metal.
       *
       * `metalness: 0.7` on a `#161616` base is a contradiction the renderer
       * obeys literally: for a metal, the base colour IS the reflection
       * colour, so a near-black metal reflects near-black. The room built
       * above was arriving at the surface and being multiplied away to
       * nothing, which is why the gem stayed flat however the lights moved.
       *
       * A dielectric with a clearcoat gets the look the material was reaching
       * for. The body stays dark because its albedo is dark; the reflections
       * are bright because a clear lacquer layer reflects *white*, not the
       * colour underneath. That is the same reason a black piano and a black
       * car look expensive and a black plastic box does not.
       */
      roughness: 0.55,
      metalness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMap: envTex,
      envMapIntensity: 1.25,
      // 0.45, not 1. At full strength the film covers the metal completely and
      // the object stops being dark polished stone with a spectral edge — it
      // becomes one flat colour, which is the opposite of expensive.
      iridescence: 0.6,
      iridescenceIOR: 1.5,
      // 180–420 nm across the facets: roughly one traverse of the visible
      // spectrum, so adjacent faces sit on different colours.
      iridescenceThicknessRange: [180, 420],
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
    // The shared travel signal. Scroll position already turns the gem; this is
    // scroll *speed*, which is what lets the object feel the movement rather
    // than merely track it.
    if (!reduced) armScrollVelocity()

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      const next = new Color(c.accent)
      mat.emissive.set(next)
      edgesMat.color.set(next)
      sparkMat.color.set(next)
      rim.color.set(next)
      const prev = envTex
      envTex = makeEnvironment(next)
      mat.envMap = envTex
      scene.environment = envTex
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
          // Travel speed adds to the idle spin, so a fast flick down the page
          // whips the gem and a slow read barely touches it. Same signal the
          // rest of the site reads — one machine, not ten widgets.
          const travel = getScrollVelocity()
          spin += (1.05 + travel * 2.4) * dt + dragMomentum * dt
          dragMomentum *= Math.exp(-dt * 3.2)
          if (Math.abs(dragMomentum) < 0.01) dragMomentum = 0
          // ...and the seams brighten with it. An object that only rotates
          // faster reads as sped up; one that also glows reads as excited.
          mat.emissiveIntensity = 0.19 + Math.abs(travel) * 0.45
          edgesMat.opacity = 0.55 + Math.abs(travel) * 0.35
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

import { useEffect, useRef, useState } from 'react'
import {
  Color,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  Mesh,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  DoubleSide,
  Group,
} from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'
import { onPalette } from '../../lib/palette.js'
import { onFrame, getTier } from '../../lib/raf.js'
import { createAnchoredRenderer } from '../../lib/glStage.js'
import { makeEnvironment, srgb } from '../../lib/filmGrade.js'

/**
 * A contact shadow, drawn rather than computed.
 *
 * The desk dropped its shadow map years ago because the map cost more than the
 * desk gained — and ever since, the object has been floating in a void. An
 * object that does not touch anything reads as pasted onto the page, and no
 * amount of material work fixes it; the eye wants the darkening directly under
 * the thing.
 *
 * A radial falloff on a plane costs one textured quad and gets 90 % of the
 * way there, which is the whole argument for it over a real shadow map.
 */
function makeContactShadow() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.45, 'rgba(0,0,0,0.28)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new CanvasTexture(c)
}

export default function ThreeDScene({ className = '' }) {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()
  // An empty container is a black box, and a black box after someone pressed
  // a button reads as broken. The scene reports whether it actually came up so
  // the caller can show something real instead.
  const [status, setStatus] = useState('pending')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const webgl = checkWebGL()
    if (!webgl.supported) { setStatus('unsupported'); return }

    // This scene is NEVER refused for being expensive.
    //
    // It used to bail at tier 1 with "3-D skipped — your device is busy",
    // which is the wrong answer for the one moving object in the section: an
    // empty rectangle where the desk should be reads as broken, and on a laptop
    // with a browser, an editor and a chat client open — the ordinary case —
    // that bail fired constantly.
    //
    // The tier now decides how GOOD it looks, not whether it exists. The scene
    // is mounted on scroll (About.jsx), so it costs nothing until it is near.
    const tier = getTier()

    const colors = getThemeColors()
    const accent = new Color(colors.accent)
    const violet = new Color(colors.violet)
    const warm = new Color(colors.warm)

    // Anchored canvas — this scene sits over the About section's own
    // background, so the behind-content scissor stage cannot draw it.
    // Shadows stay dropped: the shadow map cost more than the desk gained.
    const { renderer, dispose: disposeRenderer, warmUp } = createAnchoredRenderer(container)
    // Same rule as the renderer factory: tier buys resolution, not existence.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier >= 3 ? 1.75 : tier >= 2 ? 1.25 : 1))

    const scene = new Scene()
    const camera = new PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(4, 3, 6)
    camera.lookAt(0, 0, 0)

    // The same room the hero gem is lit by — one environment for the site, so
    // the two objects read as belonging to the same world.
    let envTex = makeEnvironment(accent)
    scene.environment = envTex

    const ambient = new AmbientLight(0x404060, 0.5)
    scene.add(ambient)

    const dirLight = new DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 8, 4)
    scene.add(dirLight)

    const fillLight = new DirectionalLight(0x8888ff, 0.4)
    fillLight.position.set(-3, 2, -2)
    scene.add(fillLight)

    function makeMat(baseColor, emissiveColor, emissiveIntensity = 0.15) {
      return new MeshStandardMaterial({
        color: baseColor,
        emissive: emissiveColor,
        emissiveIntensity,
        roughness: 0.6,
        metalness: 0.1,
      })
    }

    const deskMat = makeMat(srgb('#3a2a1a'), srgb('#5a3a2a'), 0.05)
    const desk = new Mesh(new BoxGeometry(3.2, 0.15, 1.6), deskMat)
    desk.position.y = -0.6
    desk.receiveShadow = true
    desk.castShadow = true
    scene.add(desk)

    const legMat = makeMat(srgb('#2a1a0a'), srgb('#3a2a1a'), 0.05)
    for (const [xz, zz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) {
      const leg = new Mesh(new BoxGeometry(0.08, 0.55, 0.08), legMat)
      leg.position.set(xz, -0.87, zz)
      leg.castShadow = true
      scene.add(leg)
    }

    const laptopBaseMat = makeMat(srgb('#2a2a2a'), srgb('#4a4a4a'), 0.1)
    const laptopBase = new Mesh(new BoxGeometry(0.8, 0.04, 0.55), laptopBaseMat)
    laptopBase.position.set(-0.3, -0.4, 0.2)
    laptopBase.castShadow = true
    scene.add(laptopBase)

    const screenMat = makeMat(srgb('#1a1a2e'), accent, 0.3)
    const screen = new Mesh(new BoxGeometry(0.75, 0.45, 0.03), screenMat)
    screen.position.set(-0.3, 0.04, 0.2)
    screen.castShadow = true
    scene.add(screen)

    const bookMat = makeMat(srgb('#8B4513'), warm, 0.1)
    const book = new Mesh(new BoxGeometry(0.4, 0.12, 0.3), bookMat)
    book.position.set(0.6, -0.44, 0.1)
    book.castShadow = true
    scene.add(book)

    const bookMat2 = makeMat(srgb('#2E8B57'), violet, 0.1)
    const book2 = new Mesh(new BoxGeometry(0.35, 0.1, 0.25), bookMat2)
    book2.position.set(0.55, -0.38, -0.2)
    book2.rotation.z = 0.08
    book2.castShadow = true
    scene.add(book2)

    const plantPotMat = makeMat(srgb('#8B4513'), srgb('#6B3410'), 0.05)
    const plantPot = new Mesh(new CylinderGeometry(0.2, 0.15, 0.25, 12), plantPotMat)
    plantPot.position.set(1.0, -0.48, -0.4)
    plantPot.castShadow = true
    scene.add(plantPot)

    const plantMat = makeMat(srgb('#2d8a4e'), srgb('#4ade80'), 0.2)
    const plantGroup = new Group()
    plantGroup.position.set(1.0, -0.25, -0.4)
    for (let i = 0; i < 5; i++) {
      const sphere = new Mesh(new SphereGeometry(0.1 + Math.random() * 0.08, 8, 8), plantMat)
      const angle = (i / 5) * Math.PI * 2
      sphere.position.set(Math.cos(angle) * 0.12, Math.sin(angle * 2) * 0.08 + 0.05, Math.sin(angle) * 0.12)
      sphere.castShadow = true
      plantGroup.add(sphere)
    }
    scene.add(plantGroup)

    // Laid flat under the desk, just above where the legs land. It rotates
    // with the group, so it stays under the object rather than sliding out
    // from beneath it as the desk turns.
    const shadowTex = makeContactShadow()
    const shadowMat = new MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })
    const contactShadow = new Mesh(new PlaneGeometry(4.6, 2.8), shadowMat)
    contactShadow.rotation.x = -Math.PI / 2
    contactShadow.position.y = -1.14
    scene.add(contactShadow)

    const mugMat = makeMat(srgb('#e0e0e0'), srgb('#ffffff'), 0.1)
    const mug = new Mesh(new CylinderGeometry(0.12, 0.1, 0.18, 12), mugMat)
    mug.position.set(-0.9, -0.42, -0.5)
    mug.castShadow = true
    scene.add(mug)

    // Lerped by lib/palette.js across the 650 ms sweep, so the desk's emissive
    // colours travel with the expanding circle instead of snapping (§6.1).
    const stopPalette = onPalette((p) => {
      screenMat.emissive.set(p.accent)
      bookMat2.emissive.set(p.violet)
      bookMat.emissive.set(p.warm)
    })

    let inView = false
    const ivObserver = new IntersectionObserver(([e]) => { inView = e.isIntersecting }, { threshold: 0 })
    ivObserver.observe(container)

    const resize = () => {
      const rect = container.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      camera.aspect = rect.width / rect.height
      camera.updateProjectionMatrix()
      renderer.setSize(rect.width, rect.height, false)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    setStatus('live')

    /*
     * Re-parent everything that is not a light into one group, so the desk
     * can be rotated as a single object.
     *
     * Building it this way — rather than adding each mesh to a group as it is
     * created — keeps the twelve `scene.add()` calls above readable as a
     * parts list, and re-parenting in three.js is a pointer move, not a copy.
     * Lights stay on the scene: rotating them with the desk would carry the
     * highlights around with it and the object would look flat.
     */
    const deskGroup = new Group()
    for (const child of [...scene.children]) {
      if (child.isLight) continue
      deskGroup.add(child)
    }
    scene.add(deskGroup)

    let time = 0
    /*
     * Link the shaders before the first frame, not during it.
     *
     * A `render()` on a scene whose programs are not yet linked compiles them
     * synchronously on the main thread, right then — a stall the visitor feels
     * as the page locking up the moment this scene first appears. It is one of
     * the few WebGL costs that is expensive on real GPUs too, because the
     * stall is in the driver's shader compiler rather than in rasterisation.
     * `compileAsync` uses KHR_parallel_shader_compile where it exists and
     * falls back to the sync path where it does not, so it is never worse.
     */
    let shadersReady = false
    warmUp(scene, camera).then(() => { shadersReady = true })

    const stop = onFrame((_, dt) => {
      if (!shadersReady) return
      if (!inView) return
      if (!reduced) {
        // Seconds, not frames. `dt / 16.7` made the orbit rate depend on the
        // display: the desk crawled on a 120 Hz screen relative to a 60 Hz
        // one, which is the dt-correctness rule `raf.js` documents.
        const step = Math.min(dt / 1000, 0.05)
        time += step

        // The desk spins on its own. The camera orbit alone reads as a slow
        // drift — it is a 33-second revolution — and on a 340px card the
        // parallax is small enough that several people have reported the
        // scene as static. A visible rotation of the group is what says the
        // card is alive without anyone having to touch it.
        deskGroup.rotation.y += step * 0.45

        camera.position.x = 4 * Math.cos(time * 0.2)
        camera.position.z = 4 * Math.sin(time * 0.2)
        camera.lookAt(0, 0, 0)
        plantGroup.children.forEach((sphere, i) => {
          sphere.position.y = 0.05 + Math.sin(time * 1.5 + i) * 0.03
        })
      }

      renderer.render(scene, camera)
    }, { band: 'ambient', critical: true })

    return () => {
      stop()
      ivObserver.disconnect()
      ro.disconnect()
      disposeRenderer()
      stopPalette()
      // Textures are not reached by the mesh walk below — that disposes
      // geometry and materials, and a material does not own its maps.
      shadowTex.dispose()
      envTex.dispose()
      scene.environment = null
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose())
          } else {
            obj.material?.dispose()
          }
        }
      })
    }
  }, [reduced])

  return (
    <>
      <div
        ref={containerRef}
        className={'three-scene w-full h-full min-h-[260px] ' + className}
        data-status={status}
        aria-hidden="true"
      />
      {status === 'unsupported' && (
        // A CSS desk: same subject, same palette, zero GPU. Better than an
        // empty rectangle on a machine that cannot run the real one.
        <div className="three-scene__fallback" aria-hidden="true">
          <span className="three-scene__fallback-desk" />
          <span className="three-scene__fallback-screen" />
          <span className="three-scene__fallback-mug" />
          <p className="three-scene__fallback-note font-mono">
            3D SKIPPED — YOUR DEVICE IS BUSY
          </p>
        </div>
      )}
    </>
  )
}

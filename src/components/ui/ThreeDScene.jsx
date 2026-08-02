import { useEffect, useRef } from 'react'
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
  Group,
} from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'
import { onFrame, getTier } from '../../lib/raf.js'
import { createAnchoredRenderer } from '../../lib/glStage.js'

export default function ThreeDScene({ className = '' }) {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const webgl = checkWebGL()
    if (!webgl.supported) return
    // Tier 1 machines get no WebGL at all.
    if (getTier() < 2) return

    const colors = getThemeColors()
    const accent = new Color(colors.accent)
    const violet = new Color(colors.violet)
    const warm = new Color(colors.warm)

    // Anchored canvas — this scene sits over the About section's own
    // background, so the behind-content scissor stage cannot draw it.
    // Shadows stay dropped: the shadow map cost more than the desk gained.
    const { renderer, dispose: disposeRenderer } = createAnchoredRenderer(container)

    const scene = new Scene()
    const camera = new PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(4, 3, 6)
    camera.lookAt(0, 0, 0)

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

    const deskMat = makeMat(new Color('#3a2a1a'), new Color('#5a3a2a'), 0.05)
    const desk = new Mesh(new BoxGeometry(3.2, 0.15, 1.6), deskMat)
    desk.position.y = -0.6
    desk.receiveShadow = true
    desk.castShadow = true
    scene.add(desk)

    const legMat = makeMat(new Color('#2a1a0a'), new Color('#3a2a1a'), 0.05)
    for (const [xz, zz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) {
      const leg = new Mesh(new BoxGeometry(0.08, 0.55, 0.08), legMat)
      leg.position.set(xz, -0.87, zz)
      leg.castShadow = true
      scene.add(leg)
    }

    const laptopBaseMat = makeMat(new Color('#2a2a2a'), new Color('#4a4a4a'), 0.1)
    const laptopBase = new Mesh(new BoxGeometry(0.8, 0.04, 0.55), laptopBaseMat)
    laptopBase.position.set(-0.3, -0.4, 0.2)
    laptopBase.castShadow = true
    scene.add(laptopBase)

    const screenMat = makeMat(new Color('#1a1a2e'), accent, 0.3)
    const screen = new Mesh(new BoxGeometry(0.75, 0.45, 0.03), screenMat)
    screen.position.set(-0.3, 0.04, 0.2)
    screen.castShadow = true
    scene.add(screen)

    const bookMat = makeMat(new Color('#8B4513'), warm, 0.1)
    const book = new Mesh(new BoxGeometry(0.4, 0.12, 0.3), bookMat)
    book.position.set(0.6, -0.44, 0.1)
    book.castShadow = true
    scene.add(book)

    const bookMat2 = makeMat(new Color('#2E8B57'), violet, 0.1)
    const book2 = new Mesh(new BoxGeometry(0.35, 0.1, 0.25), bookMat2)
    book2.position.set(0.55, -0.38, -0.2)
    book2.rotation.z = 0.08
    book2.castShadow = true
    scene.add(book2)

    const plantPotMat = makeMat(new Color('#8B4513'), new Color('#6B3410'), 0.05)
    const plantPot = new Mesh(new CylinderGeometry(0.2, 0.15, 0.25, 12), plantPotMat)
    plantPot.position.set(1.0, -0.48, -0.4)
    plantPot.castShadow = true
    scene.add(plantPot)

    const plantMat = makeMat(new Color('#2d8a4e'), new Color('#4ade80'), 0.2)
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

    const mugMat = makeMat(new Color('#e0e0e0'), new Color('#ffffff'), 0.1)
    const mug = new Mesh(new CylinderGeometry(0.12, 0.1, 0.18, 12), mugMat)
    mug.position.set(-0.9, -0.42, -0.5)
    mug.castShadow = true
    scene.add(mug)

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      screenMat.emissive.set(c.accent)
      bookMat2.emissive.set(c.violet)
      bookMat.emissive.set(c.warm)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

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

    let time = 0
    const stop = onFrame((_, dt) => {
      if (!inView) return
      if (!reduced) {
        time += 0.005 * (dt / 16.7)
        camera.position.x = 4 * Math.cos(time * 0.2)
        camera.position.z = 4 * Math.sin(time * 0.2)
        camera.lookAt(0, 0, 0)
        plantGroup.children.forEach((sphere, i) => {
          sphere.position.y = 0.05 + Math.sin(time * 1.5 + i) * 0.03
        })
      }

      renderer.render(scene, camera)
    })

    return () => {
      stop()
      ivObserver.disconnect()
      ro.disconnect()
      disposeRenderer()
      observer.disconnect()
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
    <div ref={containerRef} className={'w-full h-full min-h-[300px] ' + className} aria-hidden="true" />
  )
}

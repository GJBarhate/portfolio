import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors } from '../../lib/threeUtils.js'

export default function ThreeDScene({ className = '' }) {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const webgl = checkWebGL()
    if (!webgl.supported) return

    const colors = getThemeColors()
    const plasma = new THREE.Color(colors.plasma)
    const cyan = new THREE.Color(colors.cyan)
    const ember = new THREE.Color(colors.ember)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(4, 3, 6)
    camera.lookAt(0, 0, 0)

    const ambient = new THREE.AmbientLight(0x404060, 0.5)
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 8, 4)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 512
    dirLight.shadow.mapSize.height = 512
    scene.add(dirLight)

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4)
    fillLight.position.set(-3, 2, -2)
    scene.add(fillLight)

    function makeMat(baseColor, emissiveColor, emissiveIntensity = 0.15) {
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: emissiveColor,
        emissiveIntensity,
        roughness: 0.6,
        metalness: 0.1,
      })
    }

    const deskMat = makeMat(new THREE.Color('#3a2a1a'), new THREE.Color('#5a3a2a'), 0.05)
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 1.6), deskMat)
    desk.position.y = -0.6
    desk.receiveShadow = true
    desk.castShadow = true
    scene.add(desk)

    const legMat = makeMat(new THREE.Color('#2a1a0a'), new THREE.Color('#3a2a1a'), 0.05)
    for (const [xz, zz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), legMat)
      leg.position.set(xz, -0.87, zz)
      leg.castShadow = true
      scene.add(leg)
    }

    const laptopBaseMat = makeMat(new THREE.Color('#2a2a2a'), new THREE.Color('#4a4a4a'), 0.1)
    const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.55), laptopBaseMat)
    laptopBase.position.set(-0.3, -0.4, 0.2)
    laptopBase.castShadow = true
    scene.add(laptopBase)

    const screenMat = makeMat(new THREE.Color('#1a1a2e'), cyan, 0.3)
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.03), screenMat)
    screen.position.set(-0.3, 0.04, 0.2)
    screen.castShadow = true
    scene.add(screen)

    const bookMat = makeMat(new THREE.Color('#8B4513'), ember, 0.1)
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.3), bookMat)
    book.position.set(0.6, -0.44, 0.1)
    book.castShadow = true
    scene.add(book)

    const bookMat2 = makeMat(new THREE.Color('#2E8B57'), plasma, 0.1)
    const book2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.25), bookMat2)
    book2.position.set(0.55, -0.38, -0.2)
    book2.rotation.z = 0.08
    book2.castShadow = true
    scene.add(book2)

    const plantPotMat = makeMat(new THREE.Color('#8B4513'), new THREE.Color('#6B3410'), 0.05)
    const plantPot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.25, 12), plantPotMat)
    plantPot.position.set(1.0, -0.48, -0.4)
    plantPot.castShadow = true
    scene.add(plantPot)

    const plantMat = makeMat(new THREE.Color('#2d8a4e'), new THREE.Color('#4ade80'), 0.2)
    const plantGroup = new THREE.Group()
    plantGroup.position.set(1.0, -0.25, -0.4)
    for (let i = 0; i < 5; i++) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.1 + Math.random() * 0.08, 8, 8), plantMat)
      const angle = (i / 5) * Math.PI * 2
      sphere.position.set(Math.cos(angle) * 0.12, Math.sin(angle * 2) * 0.08 + 0.05, Math.sin(angle) * 0.12)
      sphere.castShadow = true
      plantGroup.add(sphere)
    }
    scene.add(plantGroup)

    const mugMat = makeMat(new THREE.Color('#e0e0e0'), new THREE.Color('#ffffff'), 0.1)
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 12), mugMat)
    mug.position.set(-0.9, -0.42, -0.5)
    mug.castShadow = true
    scene.add(mug)

    let visible = !document.hidden
    let inView = true
    const onVisibility = () => { visible = !document.hidden }
    document.addEventListener('visibilitychange', onVisibility)
    const ivObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting }, { threshold: 0 })
    ivObserver.observe(container)

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      screenMat.emissive.set(c.cyan)
      bookMat2.emissive.set(c.plasma)
      bookMat.emissive.set(c.ember)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let raf
    let time = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible || !inView) return
      time += 0.005
      if (!reduced) {
        camera.position.x = 4 * Math.cos(time * 0.2)
        camera.position.z = 4 * Math.sin(time * 0.2)
        camera.lookAt(0, 0, 0)
        plantGroup.children.forEach((sphere, i) => {
          sphere.position.y = 0.05 + Math.sin(time * 1.5 + i) * 0.03
        })
      }
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
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
      ro.disconnect()
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
      renderer.dispose()
    }
  }, [reduced])

  return (
    <div ref={containerRef} className={'w-full h-full min-h-[300px] ' + className} aria-hidden="true" />
  )
}

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { checkWebGL, getThemeColors, makePingPongRT } from '../../lib/threeUtils.js'
import HeroAurora from './HeroAurora.jsx'

const advectVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const advectFrag = `
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 uTexelSize;
  uniform float uDt;
  uniform float uDissipation;
  varying vec2 vUv;

  void main() {
    vec2 vel = texture2D(uVelocity, vUv).xy;
    vec2 coord = vUv - vel * uDt * uTexelSize;
    vec4 result = texture2D(uSource, coord) * uDissipation;
    gl_FragColor = result;
  }
`

const divergenceFrag = `
  precision highp float;
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    vec2 xOffset = vec2(uTexelSize.x, 0.0);
    vec2 yOffset = vec2(0.0, uTexelSize.y);
    float L = texture2D(uVelocity, vUv - xOffset).x;
    float R = texture2D(uVelocity, vUv + xOffset).x;
    float B = texture2D(uVelocity, vUv - yOffset).y;
    float T = texture2D(uVelocity, vUv + yOffset).y;
    float div = (R - L + T - B) * 0.5;
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`

const pressureFrag = `
  precision highp float;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    vec2 xOffset = vec2(uTexelSize.x, 0.0);
    vec2 yOffset = vec2(0.0, uTexelSize.y);
    float L = texture2D(uPressure, vUv - xOffset).x;
    float R = texture2D(uPressure, vUv + xOffset).x;
    float B = texture2D(uPressure, vUv - yOffset).y;
    float T = texture2D(uPressure, vUv + yOffset).y;
    float div = texture2D(uDivergence, vUv).x;
    float p = (L + R + B + T - div) * 0.25;
    gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
  }
`

const gradientSubtractFrag = `
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uPressure;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    vec2 xOffset = vec2(uTexelSize.x, 0.0);
    vec2 yOffset = vec2(0.0, uTexelSize.y);
    float L = texture2D(uPressure, vUv - xOffset).x;
    float R = texture2D(uPressure, vUv + xOffset).x;
    float B = texture2D(uPressure, vUv - yOffset).y;
    float T = texture2D(uPressure, vUv + yOffset).y;
    vec2 vel = texture2D(uVelocity, vUv).xy;
    vec2 grad = vec2(R - L, T - B) * 0.5;
    gl_FragColor = vec4(vel - grad, 0.0, 1.0);
  }
`

const displayFrag = `
  precision highp float;
  uniform sampler2D uDye;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  varying vec2 vUv;

  void main() {
    vec4 dye = texture2D(uDye, vUv);
    float luma = clamp(dot(dye.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    vec3 colored = mix(uColorA, uColorB, luma);
    colored = mix(colored, uColorC, dye.g * 0.3);
    float alpha = smoothstep(0.02, 0.25, luma) * uIntensity;
    gl_FragColor = vec4(colored, alpha);
  }
`

const clearFrag = `
  precision highp float;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(0.0);
  }
`


const SIMM_RES = 128
const JACOBI_ITERS = 20

export default function FluidHero({ children, className = '' }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    if (!canvas) return

    const webgl = checkWebGL()
    if (!webgl.supported) return

    const colors = getThemeColors()
    const colorA = new THREE.Color(colors.plasma)
    const colorB = new THREE.Color(colors.cyan)
    const colorC = new THREE.Color(colors.ember)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1))

    const quadGeo = new THREE.PlaneGeometry(2, 2)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 1

    const texSize = SIMM_RES
    const velRT = makePingPongRT(texSize, texSize, { type: THREE.HalfFloatType })
    const dyeRT = makePingPongRT(texSize, texSize, { type: THREE.HalfFloatType })
    const pressureRT = makePingPongRT(texSize, texSize, { type: THREE.HalfFloatType })
    const divergenceRT = makePingPongRT(texSize, texSize, { type: THREE.HalfFloatType })

    const texelSize = new THREE.Vector2(1 / texSize, 1 / texSize)

    const clearMat = new THREE.ShaderMaterial({ vertexShader: advectVert, fragmentShader: clearFrag })
    const clearMesh = new THREE.Mesh(quadGeo, clearMat)

    const advectMat = new THREE.ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: advectFrag,
      uniforms: {
        uVelocity: { value: null },
        uSource: { value: null },
        uTexelSize: { value: texelSize },
        uDt: { value: 0.03 },
        uDissipation: { value: 0.85 },
      },
    })
    const advectMesh = new THREE.Mesh(quadGeo, advectMat)

    const divergenceMat = new THREE.ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: divergenceFrag,
      uniforms: {
        uVelocity: { value: null },
        uTexelSize: { value: texelSize },
      },
    })
    const divergenceMesh = new THREE.Mesh(quadGeo, divergenceMat)

    const pressureMat = new THREE.ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: pressureFrag,
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexelSize: { value: texelSize },
      },
    })
    const pressureMesh = new THREE.Mesh(quadGeo, pressureMat)

    const gradSubMat = new THREE.ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: gradientSubtractFrag,
      uniforms: {
        uVelocity: { value: null },
        uPressure: { value: null },
        uTexelSize: { value: texelSize },
      },
    })
    const gradSubMesh = new THREE.Mesh(quadGeo, gradSubMat)

    const displayMat = new THREE.ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: displayFrag,
      uniforms: {
        uDye: { value: null },
        uIntensity: { value: 0.07 },
        uColorA: { value: colorA },
        uColorB: { value: colorB },
        uColorC: { value: colorC },
      },
      transparent: true,
      depthWrite: false,
    })
    const displayMesh = new THREE.Mesh(quadGeo, displayMat)

    renderer.setRenderTarget(velRT.current)
    renderer.render(clearMesh, camera)
    renderer.setRenderTarget(velRT.alternate)
    renderer.render(clearMesh, camera)
    renderer.setRenderTarget(dyeRT.current)
    renderer.render(clearMesh, camera)
    renderer.setRenderTarget(dyeRT.alternate)
    renderer.render(clearMesh, camera)
    velRT.swap()
    dyeRT.swap()

    const cursor = { x: 0.5, y: 0.5, prevX: 0.5, prevY: 0.5 }
    let visible = !document.hidden
    let inView = true
    const onVisibility = () => { visible = !document.hidden }
    document.addEventListener('visibilitychange', onVisibility)
    const ivObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting }, { threshold: 0 })
    ivObserver.observe(canvas)

    const onMove = (e) => {
      cursor.prevX = cursor.x
      cursor.prevY = cursor.y
      cursor.x = e.clientX / window.innerWidth
      cursor.y = 1 - e.clientY / window.innerHeight
    }
    window.addEventListener('pointermove', onMove)

    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    onResize()

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      displayMat.uniforms.uColorA.value.set(c.plasma)
      displayMat.uniforms.uColorB.value.set(c.cyan)
      displayMat.uniforms.uColorC.value.set(c.ember)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible || !inView) return

      const dx = cursor.x - cursor.prevX
      const dy = cursor.y - cursor.prevY
      const speed = Math.sqrt(dx * dx + dy * dy)

      // --- 1. Advect velocity ---
      advectMat.uniforms.uVelocity.value = velRT.alternate.texture
      advectMat.uniforms.uSource.value = velRT.alternate.texture
      renderer.setRenderTarget(velRT.current)
      renderer.render(advectMesh, camera)
      velRT.swap()
      // velRT.alternate now holds advected velocity

      // --- 2. Inject cursor force into the advected velocity ---
      if (speed > 0.0001) {
        const ctx = renderer.getContext()
        const px = Math.round(cursor.x * texSize)
        const py = Math.round(cursor.y * texSize)
        const force = 0.15
        const pixelData = new Float32Array([dx * force * 20, dy * force * 20, 0, 1])
        const oldRT = renderer.getRenderTarget()
        renderer.setRenderTarget(velRT.alternate)
        ctx.texSubImage2D(ctx.TEXTURE_2D, 0, px, py, 1, 1, ctx.RGBA, ctx.FLOAT, pixelData)
        renderer.setRenderTarget(oldRT)
      }

      // --- 3. Pressure solve (mass conservation) ---
      // 3a. Compute divergence of velocity
      divergenceMat.uniforms.uVelocity.value = velRT.alternate.texture
      renderer.setRenderTarget(divergenceRT.current)
      renderer.render(divergenceMesh, camera)

      // 3b. Initialise pressure to zero
      renderer.setRenderTarget(pressureRT.current)
      renderer.render(clearMesh, camera)
      pressureRT.swap()
      renderer.setRenderTarget(pressureRT.current)
      renderer.render(clearMesh, camera)
      pressureRT.swap()

      // 3c. Jacobi iterations (solve Poisson equation for pressure)
      for (let i = 0; i < JACOBI_ITERS; i++) {
        pressureMat.uniforms.uPressure.value = pressureRT.alternate.texture
        pressureMat.uniforms.uDivergence.value = divergenceRT.current.texture
        renderer.setRenderTarget(pressureRT.current)
        renderer.render(pressureMesh, camera)
        pressureRT.swap()
      }

      // 3d. Subtract pressure gradient from velocity (make it divergence-free)
      gradSubMat.uniforms.uVelocity.value = velRT.alternate.texture
      gradSubMat.uniforms.uPressure.value = pressureRT.alternate.texture
      renderer.setRenderTarget(velRT.current)
      renderer.render(gradSubMesh, camera)
      velRT.swap()

      // --- 4. Advect dye through the corrected velocity field ---
      advectMat.uniforms.uVelocity.value = velRT.alternate.texture
      advectMat.uniforms.uSource.value = dyeRT.alternate.texture
      renderer.setRenderTarget(dyeRT.current)
      renderer.render(advectMesh, camera)
      dyeRT.swap()

      // --- 5. Render to screen ---
      renderer.setRenderTarget(null)
      displayMat.uniforms.uDye.value = dyeRT.alternate.texture
      renderer.render(displayMesh, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      ivObserver.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      ;[velRT, dyeRT, pressureRT, divergenceRT].forEach(rt => {
        rt.rt1.dispose()
        rt.rt2.dispose()
      })
      clearMat.dispose()
      advectMat.dispose()
      divergenceMat.dispose()
      pressureMat.dispose()
      gradSubMat.dispose()
      displayMat.dispose()
      quadGeo.dispose()
      renderer.dispose()
    }
  }, [reduced])

  const webglOk = checkWebGL().supported

  return (
    <div className={'relative ' + className}>
      {webglOk ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0">
          <HeroAurora />
        </div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

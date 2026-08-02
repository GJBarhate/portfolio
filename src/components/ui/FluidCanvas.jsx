import { useEffect, useRef } from 'react'
import {
  Color,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Vector2,
  HalfFloatType,
} from 'three'
import { checkWebGL, getThemeColors, makePingPongRT } from '../../lib/threeUtils.js'
import { onFrame, getTier } from '../../lib/raf.js'
import { createDedicatedRenderer } from '../../lib/glStage.js'

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

// A gaussian splat is both cheaper and far more correct than poking a single
// texel with texSubImage2D — which additionally could not work here, because
// the render targets are half-float and the write used FLOAT.
const splatFrag = `
  precision highp float;
  uniform sampler2D uTarget;
  uniform float uAspect;
  uniform vec3 uColor;
  uniform vec2 uPoint;
  uniform float uRadius;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - uPoint;
    p.x *= uAspect;
    vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
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
    float B = texture2D(uPressure, vUv - yOffset).x;
    float T = texture2D(uPressure, vUv + yOffset).x;
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
    float B = texture2D(uPressure, vUv - yOffset).x;
    float T = texture2D(uPressure, vUv + yOffset).x;
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

// 96² with 12 Jacobi iterations is visually indistinguishable from 128²/20 at
// this scale — pressure converges fast on a small grid — and costs about half.
const SIMM_RES = 96
const JACOBI_ITERS = 12
const SIM_HZ = 30

export default function FluidCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!checkWebGL().supported) return

    const colors = getThemeColors()
    const colorA = new Color(colors.accent)
    const colorB = new Color(colors.violet)
    const colorC = new Color(colors.warm)

    // The only scene with its own context: a multi-pass ping-pong FBO
    // pipeline cannot be expressed as a viewport into the shared stage.
    const renderer = createDedicatedRenderer(canvas)
    renderer.setPixelRatio(1)

    const quadGeo = new PlaneGeometry(2, 2)
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 1

    const texSize = SIMM_RES
    const rtOpts = { type: HalfFloatType }
    const velRT = makePingPongRT(texSize, texSize, rtOpts)
    const dyeRT = makePingPongRT(texSize, texSize, rtOpts)
    const pressureRT = makePingPongRT(texSize, texSize, rtOpts)
    const divergenceRT = makePingPongRT(texSize, texSize, rtOpts)

    const texelSize = new Vector2(1 / texSize, 1 / texSize)

    const clearMat = new ShaderMaterial({ vertexShader: advectVert, fragmentShader: clearFrag })
    const clearMesh = new Mesh(quadGeo, clearMat)

    const advectMat = new ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: advectFrag,
      uniforms: {
        uVelocity: { value: null },
        uSource: { value: null },
        uTexelSize: { value: texelSize },
        uDt: { value: 0.9 },
        uDissipation: { value: 0.97 },
      },
    })
    const advectMesh = new Mesh(quadGeo, advectMat)

    const splatMat = new ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: splatFrag,
      uniforms: {
        uTarget: { value: null },
        uAspect: { value: 1 },
        uColor: { value: new Color(0, 0, 0) },
        uPoint: { value: new Vector2(0.5, 0.5) },
        uRadius: { value: 0.0008 },
      },
    })
    const splatMesh = new Mesh(quadGeo, splatMat)

    const divergenceMat = new ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: divergenceFrag,
      uniforms: {
        uVelocity: { value: null },
        uTexelSize: { value: texelSize },
      },
    })
    const divergenceMesh = new Mesh(quadGeo, divergenceMat)

    const pressureMat = new ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: pressureFrag,
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexelSize: { value: texelSize },
      },
    })
    const pressureMesh = new Mesh(quadGeo, pressureMat)

    const gradSubMat = new ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: gradientSubtractFrag,
      uniforms: {
        uVelocity: { value: null },
        uPressure: { value: null },
        uTexelSize: { value: texelSize },
      },
    })
    const gradSubMesh = new Mesh(quadGeo, gradSubMat)

    const displayMat = new ShaderMaterial({
      vertexShader: advectVert,
      fragmentShader: displayFrag,
      uniforms: {
        uDye: { value: null },
        uIntensity: { value: 0.5 },
        uColorA: { value: colorA },
        uColorB: { value: colorB },
        uColorC: { value: colorC },
      },
      transparent: true,
      depthWrite: false,
    })
    const displayMesh = new Mesh(quadGeo, displayMat)

    const blit = (mesh, target) => {
      renderer.setRenderTarget(target)
      renderer.render(mesh, camera)
    }

    for (const rt of [velRT, dyeRT, pressureRT, divergenceRT]) {
      blit(clearMesh, rt.rt1)
      blit(clearMesh, rt.rt2)
    }

    const cursor = { x: 0.5, y: 0.5, dx: 0, dy: 0, moved: false }
    let aspect = 1

    const onMove = (e) => {
      const nx = e.clientX / window.innerWidth
      const ny = 1 - e.clientY / window.innerHeight
      cursor.dx = nx - cursor.x
      cursor.dy = ny - cursor.y
      cursor.x = nx
      cursor.y = ny
      cursor.moved = true
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      renderer.setSize(w, h, false)
      aspect = w / Math.max(1, h)
      splatMat.uniforms.uAspect.value = aspect
    }
    window.addEventListener('resize', onResize)
    onResize()

    const observer = new MutationObserver(() => {
      const c = getThemeColors()
      displayMat.uniforms.uColorA.value.set(c.accent)
      displayMat.uniforms.uColorB.value.set(c.violet)
      displayMat.uniforms.uColorC.value.set(c.warm)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    // The sim must not keep running while the visitor is reading the Contact
    // section — neither an in-view nor a hidden guard existed before.
    let inView = false
    const ivObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting }, { threshold: 0 })
    ivObserver.observe(canvas)

    const splat = (rt, r, g, b, radius) => {
      splatMat.uniforms.uTarget.value = rt.alternate.texture
      splatMat.uniforms.uColor.value.setRGB(r, g, b)
      splatMat.uniforms.uPoint.value.set(cursor.x, cursor.y)
      splatMat.uniforms.uRadius.value = radius
      blit(splatMesh, rt.current)
      rt.swap()
    }

    const step = () => {
      // 1. Advect velocity through itself.
      advectMat.uniforms.uVelocity.value = velRT.alternate.texture
      advectMat.uniforms.uSource.value = velRT.alternate.texture
      advectMat.uniforms.uDissipation.value = 0.97
      blit(advectMesh, velRT.current)
      velRT.swap()

      // 2. Inject cursor force and dye.
      const speed = Math.hypot(cursor.dx, cursor.dy)
      if (cursor.moved && speed > 0.0005) {
        const force = 260
        splat(velRT, cursor.dx * force, cursor.dy * force, 0, 0.0008)
        splat(dyeRT, 0.9, 0.65, 1.0, 0.0011)
      }
      cursor.dx *= 0.85
      cursor.dy *= 0.85

      // 3. Pressure solve — divergence, clear, Jacobi, gradient subtract.
      divergenceMat.uniforms.uVelocity.value = velRT.alternate.texture
      blit(divergenceMesh, divergenceRT.current)

      blit(clearMesh, pressureRT.current)
      pressureRT.swap()

      for (let i = 0; i < JACOBI_ITERS; i++) {
        pressureMat.uniforms.uPressure.value = pressureRT.alternate.texture
        pressureMat.uniforms.uDivergence.value = divergenceRT.current.texture
        blit(pressureMesh, pressureRT.current)
        pressureRT.swap()
      }

      gradSubMat.uniforms.uVelocity.value = velRT.alternate.texture
      gradSubMat.uniforms.uPressure.value = pressureRT.alternate.texture
      blit(gradSubMesh, velRT.current)
      velRT.swap()

      // 4. Advect dye through the corrected, divergence-free velocity field.
      advectMat.uniforms.uVelocity.value = velRT.alternate.texture
      advectMat.uniforms.uSource.value = dyeRT.alternate.texture
      advectMat.uniforms.uDissipation.value = 0.985
      blit(advectMesh, dyeRT.current)
      dyeRT.swap()
    }

    // Fluid reads fine at 30 fps, so half the frames do no simulation at all.
    const frameBudget = 1000 / SIM_HZ
    let acc = 0
    const stop = onFrame((_, dt) => {
      if (!inView || getTier() < 3) return
      acc += dt
      if (acc < frameBudget) return
      acc = Math.min(acc - frameBudget, frameBudget)

      step()

      renderer.setRenderTarget(null)
      displayMat.uniforms.uDye.value = dyeRT.alternate.texture
      renderer.render(displayMesh, camera)
      cursor.moved = false
    })

    return () => {
      stop()
      ivObserver.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      for (const rt of [velRT, dyeRT, pressureRT, divergenceRT]) {
        rt.rt1.dispose()
        rt.rt2.dispose()
      }
      clearMat.dispose()
      advectMat.dispose()
      splatMat.dispose()
      divergenceMat.dispose()
      pressureMat.dispose()
      gradSubMat.dispose()
      displayMat.dispose()
      quadGeo.dispose()
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
}

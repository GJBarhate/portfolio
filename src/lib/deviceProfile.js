/**
 * deviceProfile.js — T-007. The tier probe.
 *
 * What this replaces: `useHeavyAmbientAllowed()` in App.jsx used to allow a
 * fullscreen fragment shader whenever `navigator.hardwareConcurrency >= 4`.
 * Every phone sold since about 2019 reports four or more cores, including
 * thermally-throttled budget Androids, so the gate was open for everyone. The
 * `min-width: 768px` clause it replaced was wrong in a different direction —
 * viewport width is not a GPU benchmark — but at least it excluded something.
 * Neither of them *measured* anything.
 *
 * The frame governor in `raf.js` is a **recovery** mechanism: it notices a
 * struggling machine after ~3 seconds of sustained slowness and takes a layer
 * away. By then the visitor has already watched the jank, during LCP, which is
 * the exact window that decides whether the site feels fast. This module is
 * the **prevention** half: decide before mounting, from evidence.
 *
 * Five proxies and one measurement:
 *
 *   proxies      cores · deviceMemory · effectiveType/saveData ·
 *                prefers-reduced-motion · the WebGL renderer string
 *   measurement  render the real background shader off-screen at 1/8 scale
 *                for 15 frames and take the median frame cost
 *
 * Only the last one is not a guess, which is why it is the one allowed to
 * demote a device that passed every proxy.
 *
 * **Nothing heavy on the critical path — including the measurement of what is
 * heavy.** The probe waits for the LCP entry and then for an idle callback. A
 * benchmark that delays the paint it is trying to protect is a bug, not a
 * safeguard.
 */
import { setTier } from './raf.js'
import { safeSession } from './store.js'

/** @typedef {{ tier: 0|1|2|3, reasons: string[], measuredMs: number|null }} Profile */

const CACHE_KEY = 'forge:tier'

/**
 * GPUs that report fine on paper and cannot sustain a fullscreen fragment
 * shader in practice. Deliberately short: a deny-list that tries to be
 * exhaustive is a deny-list that is wrong. The micro-benchmark is the general
 * case; this only front-runs it for parts we already know about.
 */
const WEAK_GPU = /Mali-G5\d|Mali-4\d\d|Adreno \(TM\) (5[0-9]{2}|60[0-9])|PowerVR (GE8|Rogue GE)|Vivante|Videocore/i

/** The probe shader: the same domain-warp core the background engine runs. */
const PROBE_FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 warp = vec2(fbm(uv * 3.0 + uTime), fbm(uv * 3.0 - uTime));
  float v = fbm(uv * 4.0 + warp * 1.5);
  gl_FragColor = vec4(vec3(v), 1.0);
}`

const PROBE_VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

/**
 * Render the probe shader for `frames` frames at 1/8 scale and return the
 * median frame cost in milliseconds. Returns null when WebGL is unavailable —
 * a device with no WebGL has already answered the question.
 */
export async function benchmarkShader({ frames = 15, scale = 0.125 } = {}) {
  if (typeof document === 'undefined') return null
  let canvas, gl
  try {
    canvas = document.createElement('canvas')
    canvas.width = Math.max(32, Math.round((window.innerWidth || 360) * scale))
    canvas.height = Math.max(32, Math.round((window.innerHeight || 640) * scale))
    gl = canvas.getContext('webgl', { antialias: false, depth: false, powerPreference: 'low-power' })
    if (!gl) return null

    const compile = (type, src) => {
      const sh = gl.createShader(type)
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'compile')
      return sh
    }
    const program = gl.createProgram()
    gl.attachShader(program, compile(gl.VERTEX_SHADER, PROBE_VERT))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, PROBE_FRAG))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link')
    gl.useProgram(program)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(gl.getUniformLocation(program, 'uRes'), canvas.width, canvas.height)
    const uTime = gl.getUniformLocation(program, 'uTime')

    const samples = []
    for (let i = 0; i < frames; i++) {
      const t0 = performance.now()
      gl.uniform1f(uTime, i * 0.1)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      // A single pixel read forces the pipeline to actually finish, which is
      // the only way to time GPU work from JS without a timer query.
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
      samples.push(performance.now() - t0)
      // Yield so the probe cannot itself become a long task.
      if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0))
    }
    samples.sort((a, b) => a - b)
    return samples[Math.floor(samples.length / 2)]
  } catch {
    return null
  } finally {
    try { gl?.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* nothing to release */ }
    if (canvas) { canvas.width = 0; canvas.height = 0 }
  }
}

/** The renderer string, where the browser is willing to say. */
export function rendererString() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    if (!gl) return null
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const value = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

/**
 * Resolve a tier from evidence. Exported separately from `probeDevice` so the
 * unit tests can feed it synthetic inputs instead of a browser.
 *
 * @param {{cores:number, memory:number, effectiveType:string, saveData:boolean,
 *          reducedMotion:boolean, renderer:string|null, measuredMs:number|null}} signals
 * @returns {Profile}
 */
/**
 * 1/8-scale ms/frame above which the GPU is not contended, it is incapable.
 * ~8× for full resolution puts this at ~32 ms of GPU for the ambient layer
 * alone — six times its tier-3 budget. No amount of measurement noise
 * accounts for that.
 */
const HOPELESS_MS = 4.0

export function resolveTier(signals) {
  const reasons = []
  let tier = 3

  const demote = (to, why) => {
    if (to < tier) tier = to
    reasons.push(why)
  }

  if (signals.reducedMotion) demote(0, 'prefers-reduced-motion: reduce')
  if (signals.saveData) demote(0, 'Save-Data requested')
  if (signals.effectiveType && /^(slow-)?2g$/.test(signals.effectiveType)) {
    demote(1, `effectiveType ${signals.effectiveType}`)
  }
  if (signals.memory && signals.memory < 4) demote(1, `deviceMemory ${signals.memory} GB`)
  if (signals.cores && signals.cores <= 2) demote(1, `${signals.cores} cores`)
  else if (signals.cores && signals.cores <= 4) demote(2, `${signals.cores} cores`)
  if (signals.renderer && WEAK_GPU.test(signals.renderer)) {
    demote(1, `known-weak GPU: ${signals.renderer}`)
  }

  // The measurement. Budget for the ambient layer is ~2 ms of GPU at tier 2
  // and ~5 ms at tier 3 (Appendix B), measured here at 1/64 of the pixels —
  // so a full-resolution frame costs roughly 8× what this probe reports on a
  // fill-rate-bound part. The thresholds below are that arithmetic, not taste.
  //
  // How far a *timing sample* is allowed to demote is a separate question
  // from how far a structural signal is. The probe runs after LCP, on a page
  // that is by then already driving the hero gem, the fluid canvas, the
  // aurora and the background field — it is measuring GPU throughput under
  // contention it created itself, so it over-reports cost precisely when the
  // page is at its busiest. Letting one such sample reach tier 1 is what made
  // the hero gem spin for a few seconds and then freeze mid-air for good:
  // tier 1 means "no WebGL", both 3-D scenes hard-gate on it, and the tier
  // floor moves down with the verdict so nothing climbs back.
  //
  // So an ordinary slow reading demotes to 2 — fewer particles, lower DPR,
  // the object still turning. Only a reading that is slow beyond any
  // plausible measurement error reaches 1, alongside the structural signals
  // above (no WebGL at all, a known-weak GPU, too little memory) which are
  // facts about the device rather than a stopwatch held at a bad moment.
  if (signals.measuredMs != null) {
    if (signals.measuredMs > HOPELESS_MS) {
      demote(1, `probe ${signals.measuredMs.toFixed(2)} ms/frame at 1/8 scale`)
    } else if (signals.measuredMs > 2.0) {
      demote(2, `probe ${signals.measuredMs.toFixed(2)} ms/frame at 1/8 scale`)
    } else if (signals.measuredMs > 0.9) {
      demote(2, `probe ${signals.measuredMs.toFixed(2)} ms/frame at 1/8 scale`)
    } else {
      reasons.push(`probe ${signals.measuredMs.toFixed(2)} ms/frame — fast`)
    }
  } else {
    demote(1, 'no WebGL — probe could not run')
  }

  if (!reasons.length) reasons.push('all signals nominal')
  return { tier, reasons, measuredMs: signals.measuredMs ?? null }
}

let inflight = null
let resolved = null
const listeners = new Set()

/** The resolved profile, or null while the probe has not finished. */
export const getProfile = () => resolved

export function onProfile(fn) {
  if (resolved) { try { fn(resolved) } catch { /* ignore */ } }
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function publish(profile) {
  resolved = profile
  // The governor already owns `data-gfx-tier`; extend it, never duplicate it.
  setTier(Math.max(1, profile.tier))
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.gfxProbe = profile.measuredMs == null
      ? 'none' : profile.measuredMs.toFixed(2)
  }
  for (const fn of listeners) {
    try { fn(profile) } catch { /* one bad listener must not stop the rest */ }
  }
  return profile
}

/** Resolve once per session; the answer cannot change without a reload. */
export function probeDevice() {
  if (resolved) return Promise.resolve(resolved)
  if (inflight) return inflight

  const cached = safeSession.get(CACHE_KEY)
  if (cached) {
    try {
      const profile = JSON.parse(cached)
      if (profile && Number.isFinite(profile.tier)) return Promise.resolve(publish(profile))
    } catch { /* fall through and re-probe */ }
  }

  inflight = (async () => {
    const measuredMs = await benchmarkShader()
    const profile = resolveTier({
      cores: navigator.hardwareConcurrency || 4,
      memory: navigator.deviceMemory || 4,
      effectiveType: navigator.connection?.effectiveType || '',
      saveData: navigator.connection?.saveData === true,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      renderer: rendererString(),
      measuredMs,
    })
    safeSession.set(CACHE_KEY, JSON.stringify(profile))
    return publish(profile)
  })()

  return inflight
}

/**
 * Schedule the probe for after LCP, then after the next idle moment.
 *
 * `largest-contentful-paint` fires repeatedly as bigger candidates appear; the
 * timeout is the backstop for pages where it never fires at all (a fully
 * cached repeat visit, or a browser without the entry type).
 */
export function scheduleProbe({ timeout = 4000 } = {}) {
  if (typeof window === 'undefined') return
  let done = false
  const run = () => {
    if (done) return
    done = true
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200))
    idle(() => probeDevice(), { timeout: 2000 })
  }

  try {
    const po = new PerformanceObserver(() => { po.disconnect(); run() })
    po.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* no LCP entries here — the timer is the whole schedule */ }

  setTimeout(run, timeout)
}

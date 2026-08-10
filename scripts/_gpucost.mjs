import { chromium } from '@playwright/test'
const seed = () => { try { localStorage.setItem('forge', JSON.stringify({version:1,theme:null,motion:'system',progress:{unlocked:[]},sparks:[],scores:{},seen:{intro:Date.now()},prefs:{recruiter:false,sound:false,tier:null}})) } catch { void 0 } }
const run = async () => {
  const b = await chromium.launch()
  for (const scene of ['calm','motifs','forest']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(seed)
    const page = await ctx.newPage()
    await page.goto('http://localhost:4183', { waitUntil: 'load' })
    await page.waitForTimeout(5000)
    await page.evaluate((s) => window.dispatchEvent(new CustomEvent('forge:set-bg-scene', { detail: s })), scene)
    await page.waitForTimeout(2000)
    await page.evaluate(() => {
      window.__f = []; window.__lt = []
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)) }).observe({ type:'longtask', buffered:true })
      let last = performance.now()
      const tick = t => { window.__f.push(Math.round(t-last)); last=t; requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
    })
    await page.waitForTimeout(4000)
    const r = await page.evaluate(() => {
      const f=[...window.__f].sort((a,b)=>a-b)
      return { frames:f.length, median:f[Math.floor(f.length/2)], p95:f[Math.floor(f.length*0.95)],
               ltCount:window.__lt.length, ltSum:window.__lt.reduce((a,b)=>a+b,0) }
    })
    console.log(scene.padEnd(8), JSON.stringify(r))
    await ctx.close()
  }
  await b.close()
}
run().catch(e=>{console.error(e);process.exit(1)})

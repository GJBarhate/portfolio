/**
 * forgeCli.js — T-003. One command registry, two front-ends.
 *
 * `window.forge` was a genuinely charming command surface — `forge.help()`,
 * `forge.hire()`, `forge.matrix()`, `forge.theme()`, `forge.status()`,
 * `forge.scrollTo()` — built inside a `useEffect` in App.jsx and reachable
 * only from a devtools console. A phone has no devtools console. **The
 * feature was real; the door was missing.** That is half of the "I can't see
 * the CLI" report (D-02); the other half is D-01, the palette having no
 * opening affordance on touch.
 *
 * The fix is not to duplicate the commands into the UI. It is to make the
 * commands a *registry* that neither front-end owns:
 *
 *   registry → console shim   (`window.forge`, unchanged for the visitor)
 *   registry → palette `>` mode (the same commands, on a phone, by touch)
 *
 * Every `run` receives a context object rather than reaching for globals, so
 * the same function can print to a console or to a transcript without knowing
 * which one it is talking to. That is the whole reason both front-ends can
 * stay in step: there is nothing to keep in step.
 */
import { SOCIALS } from './content.js'
import { getStore, resetStore } from './store.js'
import { getProfile } from './deviceProfile.js'
import { getTier, setTier } from './raf.js'
import {
  THEME_IDS,
  BACKDROP_IDS,
  BACKDROPS,
  MOTION_IDS,
  MOTIONS,
  getAppearance,
  setBackdrop,
  setMotion,
  openAppearanceConsole,
} from './appearance.js'

export const CLI_VERSION = '5.0.0'

/*
 * The vocabularies are IMPORTED, not restated.
 *
 * This file used to declare `THEMES = ['eclipse','ember','paper']` and
 * `MOTION_MODES = [...]` of its own — a fifth and sixth copy of lists that
 * also existed in ThemeContext, motion.js, the palette and the drawer. They
 * are re-exported under the old names so nothing that imports them breaks,
 * but there is one definition now and `check-appearance-parity.mjs` holds it
 * level with the pre-paint script in index.html.
 */
export const THEMES = THEME_IDS
export const MOTION_MODES = MOTION_IDS
export const BG_SCENES = BACKDROP_IDS

/**
 * The résumé card. Kept as data so the console renders it as one styled
 * block and the palette renders it as transcript lines, from one source.
 */
const HIRE_CARD = [
  '╔══════════════════════════════════╗',
  '║     GAURAV BARHATE               ║',
  '║     Full-Stack Developer         ║',
  '║     B.Tech CSE · IIIT Vadodara   ║',
  '╠══════════════════════════════════╣',
  '║  LeetCode Knight · 1972 max      ║',
  '║  800+ problems solved            ║',
  '║  5+ production apps shipped      ║',
  '╠══════════════════════════════════╣',
  '║  Stack: MERN · Socket.IO · Redis ║',
  '║  WebRTC · Yjs CRDT · Gemini AI   ║',
  '╚══════════════════════════════════╝',
]

const SECTIONS = ['hero', 'about', 'stats', 'skills', 'projects', 'timeline', 'how-i-build', 'contact']

/**
 * @typedef {object} CliContext
 * @property {(text: string, kind?: 'out'|'ok'|'err'|'art') => void} log
 * @property {(theme: string) => void} setTheme
 * @property {() => void} openArcade
 * @property {(id: string) => void} scrollTo
 * @property {() => void} [close]
 */

export const COMMANDS = [
  {
    name: 'help',
    args: [],
    describe: 'List every command',
    run: (ctx) => {
      ctx.log('Available commands:', 'ok')
      for (const c of COMMANDS) {
        const sig = c.args.length ? `${c.name}(${c.args.join(', ')})` : `${c.name}()`
        ctx.log(`  ${sig.padEnd(24)} — ${c.describe}`)
      }
      ctx.log('In the palette, drop the parentheses: type `theme ember`.', 'out')
    },
  },
  {
    name: 'hire',
    args: [],
    describe: 'Mini résumé, then open an email draft',
    run: (ctx) => {
      for (const line of HIRE_CARD) ctx.log(line, 'art')
      ctx.log(`📧 ${SOCIALS.email}`, 'ok')
      ctx.log(`📱 ${SOCIALS.phone}`, 'ok')
      ctx.log(`→ mailto:${SOCIALS.email}`)
      try { window.open(`mailto:${SOCIALS.email}`) } catch { /* popup blocked — the address is above */ }
    },
  },
  {
    // The console and the palette are two front-ends over this registry, so
    // "open the panel" has to be a command here too — otherwise the terminal
    // is the one surface that cannot reach the site's main settings UI.
    name: 'appearance',
    args: [],
    describe: 'Open the appearance panel (theme, backdrop, motion)',
    run: (ctx) => {
      openAppearanceConsole({ source: 'cli' })
      ctx.log('Appearance panel opened — or press Shift+A.', 'ok')
    },
  },
  {
    name: 'theme',
    args: ['eclipse|ember|paper|system'],
    describe: 'Switch the palette',
    complete: () => [...THEMES, 'system'],
    run: (ctx, [id]) => {
      if (!id) return ctx.log(`Usage: theme ${[...THEMES, 'system'].join('|')}`, 'err')
      if (id !== 'system' && !THEMES.includes(id)) return ctx.log(`Unknown theme "${id}". Try: ${THEMES.join(', ')}`, 'err')
      ctx.setTheme(id)
      window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'shapeshifter' }))
      ctx.log(`Theme switched to ${id}`, 'ok')
    },
  },
  {
    name: 'motion',
    args: ['full|reduced|off|system'],
    describe: 'Set the motion level',
    complete: () => MOTION_MODES,
    run: (ctx, [mode]) => {
      const current = getAppearance().motion
      if (!mode) return ctx.log(`Motion is "${current}". Usage: motion ${MOTION_MODES.join('|')}`, 'out')
      if (!MOTION_MODES.includes(mode)) return ctx.log(`Unknown mode "${mode}". Try: ${MOTION_MODES.join(', ')}`, 'err')
      // One writer. This used to `setStore` AND dispatch an event, which is
      // two half-writes that happened to add up.
      setMotion(mode)
      const label = MOTIONS.find((m) => m.id === mode)?.label ?? mode
      ctx.log(`Motion set to ${label}`, 'ok')
    },
  },
  {
    // §14.5 — parity with the header toggle, the drawer row and the palette.
    name: 'scene',
    args: ['calm|motifs|forest'],
    describe: 'Choose the backdrop',
    complete: () => BG_SCENES,
    run: (ctx, [id]) => {
      const current = getAppearance().backdrop
      if (!id) return ctx.log(`Background is "${current}". Usage: scene ${BG_SCENES.join('|')}`, 'out')
      if (!BG_SCENES.includes(id)) return ctx.log(`Unknown scene "${id}". Try: ${BG_SCENES.join(', ')}`, 'err')
      setBackdrop(id)
      const b = BACKDROPS.find((x) => x.id === id)
      ctx.log(`Background set to ${b.label} — ${b.meaning.toLowerCase()}, ${b.cost.toLowerCase()}`, 'ok')
    },
  },
  {
    name: 'arcade',
    args: [],
    describe: 'Open the arcade hub',
    run: (ctx) => {
      ctx.openArcade()
      ctx.log('Arcade open — 5 games.', 'ok')
      ctx.close?.()
    },
  },
  {
    name: 'matrix',
    args: [],
    describe: 'Toggle the ASCII dither overlay',
    run: (ctx) => {
      import('./ditherOverlay.js').then((m) => {
        const on = m.toggleDither()
        ctx.log(on ? 'ENTERING THE MATRIX' : 'EXITING THE MATRIX', 'ok')
      })
    },
  },
  {
    name: 'status',
    args: [],
    describe: 'Achievements, sparks and the resolved graphics tier',
    run: (ctx) => {
      const store = getStore()
      const profile = getProfile()
      ctx.log(`🏆 ${store.progress.unlocked.length} achievements unlocked`, 'ok')
      ctx.log(`✦  ${store.sparks.length} sparks found`)
      ctx.log(`▮  graphics tier ${getTier()}${profile ? ` (probed ${profile.tier})` : ' (probe pending)'}`)
      if (profile?.reasons?.length) for (const r of profile.reasons) ctx.log(`   · ${r}`)
    },
  },
  {
    name: 'tier',
    args: ['0|1|2|3'],
    describe: 'Pin the graphics tier for this session',
    complete: () => ['0', '1', '2', '3'],
    run: (ctx, [value]) => {
      if (value == null) return ctx.log(`Graphics tier is ${getTier()}. Usage: tier 0|1|2|3`, 'out')
      const n = Number(value)
      if (!Number.isInteger(n) || n < 0 || n > 3) return ctx.log('Tier must be 0, 1, 2 or 3.', 'err')
      setTier(Math.max(1, n), { lock: true })
      ctx.log(`Graphics tier pinned to ${n}${n === 0 ? ' (floor is 1 — effects off is a motion setting)' : ''}`, 'ok')
    },
  },
  {
    name: 'scrollTo',
    args: ['section'],
    describe: `Navigate: ${SECTIONS.join(', ')}`,
    complete: () => SECTIONS,
    run: (ctx, [id]) => {
      if (!id) return ctx.log(`Usage: scrollTo ${SECTIONS.join('|')}`, 'err')
      const el = document.getElementById(id)
      if (!el) return ctx.log(`No section "${id}".`, 'err')
      ctx.scrollTo(id)
      ctx.log(`→ ${id}`, 'ok')
      ctx.close?.()
    },
  },
  {
    name: 'reset',
    args: [],
    describe: 'Clear saved progress, sparks and preferences',
    run: (ctx) => {
      resetStore()
      ctx.log('Store cleared. Reload for a first-visit experience.', 'ok')
    },
  },
  {
    name: 'sw',
    args: ['kill'],
    describe: 'Clear the service worker and every cache it holds',
    complete: () => ['kill'],
    run: (ctx, [action]) => {
      if (action !== 'kill') return ctx.log('Usage: sw kill', 'out')
      // T-057 — the escape hatch, reachable from a phone. A bad service
      // worker can serve a broken build to a returning visitor forever, and
      // the visitor has no way to know and no reason to try clearing it. This
      // is why the kill switch was written before the caching logic.
      const kill = window.forgeSwKill
      if (typeof kill !== 'function') return ctx.log('No service worker is registered.', 'out')
      kill().then((ok) => ctx.log(
        ok ? 'Service worker unregistered and caches cleared. Reload.' : 'Nothing to clear.',
        ok ? 'ok' : 'out'
      ))
    },
  },
  {
    name: 'version',
    args: [],
    describe: 'Show the build version',
    run: (ctx) => ctx.log(`FORGE ${CLI_VERSION}`, 'ok'),
  },
  {
    name: 'clear',
    args: [],
    describe: 'Clear the transcript',
    run: (ctx) => ctx.log('', 'clear'),
  },
]

/** Case-insensitive on both sides: `scrollTo` and `scrollto` are one command. */
export const findCommand = (name) =>
  COMMANDS.find((c) => c.name.toLowerCase() === String(name).toLowerCase())

/**
 * Split a typed line into `[name, ...args]`. Quoted arguments survive, so
 * `theme "paper"` behaves the same as `theme paper` — the console form used
 * quotes and muscle memory carries.
 */
export function parseLine(line) {
  let trimmed = String(line).replace(/^>\s*/, '').trim()
  if (!trimmed) return { name: '', args: [] }

  // The console form — `theme("ember")` — and the terminal form —
  // `theme ember` — are the same command. Muscle memory from the devtools
  // console is worth honouring, so the call syntax is rewritten into the
  // spaced form before tokenising rather than being a second parser.
  const call = trimmed.match(/^([A-Za-z]+)\s*\((.*)\)\s*$/)
  if (call) trimmed = `${call[1]} ${call[2].replace(/,/g, ' ')}`.trim()

  const tokens = trimmed.match(/"[^"]*"|'[^']*'|\S+/g) || []
  const clean = tokens.map((t) => t.replace(/^["']|["']$/g, '').trim()).filter(Boolean)
  if (!clean.length) return { name: '', args: [] }
  return { name: clean[0].toLowerCase(), args: clean.slice(1) }
}

/** Run one typed line against the registry. */
export function runLine(line, ctx) {
  const { name, args } = parseLine(line)
  if (!name) return
  const command = findCommand(name)
  if (!command) {
    ctx.log(`Unknown command "${name}". Type help.`, 'err')
    return
  }
  try {
    command.run(ctx, args)
  } catch (error) {
    ctx.log(`${name} failed: ${error?.message || error}`, 'err')
  }
}

/** Tab-completion candidates for a partially typed line. */
export function completions(line) {
  const raw = line.replace(/^>\s*/, '')
  const parts = raw.split(/\s+/)
  if (parts.length <= 1) {
    return COMMANDS.map((c) => c.name).filter((n) => n.startsWith((parts[0] || '').toLowerCase()))
  }
  const command = findCommand(parts[0])
  if (!command?.complete) return []
  const prefix = parts[parts.length - 1].toLowerCase()
  return command.complete().filter((v) => v.startsWith(prefix))
}

/**
 * Build the `window.forge` console shim from the same registry.
 *
 * Behaviour is unchanged from the visitor's point of view — `forge.help()`
 * still prints a styled list, `forge.version` is still a getter — but there is
 * no second copy of any command to drift.
 */
export function installConsoleShim(ctx) {
  const styles = {
    ok: 'color: #7dd3fc; font-weight: bold',
    err: 'color: #fb7185',
    art: 'color: #a5b4fc; font-family: monospace; font-size: 11px; line-height: 1.4',
    out: 'color: #94a3b8',
  }
  const consoleCtx = {
    ...ctx,
    log: (text, kind = 'out') => {
      if (kind === 'clear') { console.clear(); return }
      console.log(`%c${text}`, styles[kind] || styles.out)
    },
  }

  const forge = {}
  for (const command of COMMANDS) {
    // `version` is the one command that was a PROPERTY in the original API —
    // `forge.version`, not `forge.version()`. The getter below preserves that,
    // so this loop must not install a function over it.
    if (command.name === 'version') continue
    forge[command.name] = (...args) => {
      command.run(consoleCtx, args.map(String))
      // Returning undefined keeps the console from echoing a value under the
      // output the command just printed.
      return undefined
    }
  }
  Object.defineProperty(forge, 'version', { get: () => CLI_VERSION, enumerable: true })
  return forge
}

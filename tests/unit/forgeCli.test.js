import { describe, it, expect, beforeEach, vi } from 'vitest'
import { COMMANDS, parseLine, completions, runLine, findCommand, installConsoleShim } from '../../src/lib/forgeCli.js'

/**
 * forgeCli.test.js — T-003.
 *
 * The registry exists so the console shim and the palette terminal cannot
 * drift apart. These tests hold that: every command is well-formed, the
 * parser accepts both the console spelling (`theme("ember")`) and the
 * terminal spelling (`theme ember`), and an unknown command fails politely
 * rather than silently.
 */

function context() {
  const lines = []
  return {
    lines,
    log: (text, kind = 'out') => lines.push({ text, kind }),
    setTheme: vi.fn(),
    openArcade: vi.fn(),
    scrollTo: vi.fn(),
    close: vi.fn(),
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('the registry', () => {
  it('is well-formed: every entry has a name, a description and a runner', () => {
    for (const command of COMMANDS) {
      expect(typeof command.name, `${command.name} name`).toBe('string')
      expect(command.name).toMatch(/^[a-zA-Z]+$/)
      expect(typeof command.describe, `${command.name} describe`).toBe('string')
      expect(command.describe.length).toBeGreaterThan(4)
      expect(typeof command.run, `${command.name} run`).toBe('function')
      expect(Array.isArray(command.args)).toBe(true)
    }
  })

  it('has no duplicate names', () => {
    const names = COMMANDS.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('carries every command the console version had', () => {
    for (const name of ['help', 'hire', 'theme', 'arcade', 'matrix', 'status', 'scrollTo', 'version']) {
      expect(findCommand(name), name).toBeTruthy()
    }
  })
})

describe('parseLine', () => {
  it('accepts the terminal spelling', () => {
    expect(parseLine('theme ember')).toEqual({ name: 'theme', args: ['ember'] })
  })

  it('accepts the console spelling, quotes and all', () => {
    expect(parseLine('theme("ember")')).toEqual({ name: 'theme', args: ['ember'] })
  })

  it('strips the terminal prompt', () => {
    expect(parseLine('> help')).toEqual({ name: 'help', args: [] })
  })

  it('is case-insensitive on the command but not the argument', () => {
    expect(parseLine('ScrollTo Projects')).toEqual({ name: 'scrollto', args: ['Projects'] })
  })

  it('returns an empty name for an empty line', () => {
    expect(parseLine('   ').name).toBe('')
  })
})

describe('completions', () => {
  it('completes a command name', () => {
    expect(completions('ver')).toContain('version')
  })

  it('completes an argument once the command is known', () => {
    expect(completions('theme em')).toEqual(['ember'])
  })

  it('returns nothing for a command with no argument list', () => {
    expect(completions('help ')).toEqual([])
  })
})

describe('runLine', () => {
  it('runs help and lists every command', () => {
    const ctx = context()
    runLine('help', ctx)
    const text = ctx.lines.map((l) => l.text).join('\n')
    for (const command of COMMANDS) expect(text).toContain(command.name)
  })

  it('reports an unknown command instead of failing silently', () => {
    const ctx = context()
    runLine('nonsense', ctx)
    expect(ctx.lines.some((l) => l.kind === 'err' && /Unknown command/.test(l.text))).toBe(true)
  })

  it('validates its arguments', () => {
    const ctx = context()
    runLine('theme neon', ctx)
    expect(ctx.setTheme).not.toHaveBeenCalled()
    expect(ctx.lines.some((l) => l.kind === 'err')).toBe(true)
  })

  it('applies a valid theme through the context, not a global', () => {
    const ctx = context()
    runLine('theme ember', ctx)
    expect(ctx.setTheme).toHaveBeenCalledWith('ember')
  })

  it('persists the motion mode', () => {
    const ctx = context()
    runLine('motion off', ctx)
    expect(JSON.parse(localStorage.getItem('forge:v1')).motion).toBe('off')
  })

  it('turns a throwing command into a message rather than an exception', () => {
    const ctx = context()
    ctx.scrollTo = () => { throw new Error('boom') }
    document.body.innerHTML = '<div id="projects"></div>'
    expect(() => runLine('scrollTo projects', ctx)).not.toThrow()
    expect(ctx.lines.some((l) => l.kind === 'err')).toBe(true)
  })

  it('does nothing at all for an empty line', () => {
    const ctx = context()
    runLine('   ', ctx)
    expect(ctx.lines).toEqual([])
  })
})

describe('the console shim', () => {
  it('exposes one function per command plus a version getter', () => {
    const forge = installConsoleShim(context())
    for (const command of COMMANDS) {
      // `version` is a property in the console API, not a call — see the shim.
      if (command.name === 'version') continue
      expect(typeof forge[command.name], command.name).toBe('function')
    }
    expect(typeof forge.version).toBe('string')
  })

  it('returns undefined so the console does not echo over the output', () => {
    const forge = installConsoleShim(context())
    expect(forge.help()).toBeUndefined()
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  HONEYPOT_FIELD, MIN_FILL_MS, RATE_LIMIT,
  checkSubmission, recordSubmission,
  saveDraft, loadDraft, clearDraft, mailtoFallback,
} from '../../src/lib/formGuard.js'

/**
 * formGuard.test.js — T-044.
 *
 * D-15: the contact form posted to EmailJS with no honeypot, no timing check
 * and no rate limit. The failure mode is not "spam arrives" — it is "the free
 * tier's quota is exhausted and the form stops working for real visitors".
 */

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

const good = () => ({ honeypot: '', startedAt: Date.now() - MIN_FILL_MS - 500 })

describe('checkSubmission', () => {
  it('accepts a human-shaped submission', () => {
    expect(checkSubmission(good()).ok).toBe(true)
  })

  it('rejects a filled honeypot', () => {
    const result = checkSubmission({ ...good(), honeypot: 'https://spam.example' })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('honeypot')
  })

  it('rejects a submission faster than a human can type', () => {
    const result = checkSubmission({ honeypot: '', startedAt: Date.now() - 50 })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('too-fast')
  })

  it('gives the honeypot and the timing check the SAME message', () => {
    // Telling a bot which check it failed is telling it how to pass next time.
    const a = checkSubmission({ ...good(), honeypot: 'x' })
    const b = checkSubmission({ honeypot: '', startedAt: Date.now() })
    expect(a.message).toBe(b.message)
  })

  it('rate-limits after the allowance', () => {
    for (let i = 0; i < RATE_LIMIT.max; i++) recordSubmission()
    const result = checkSubmission(good())
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('rate-limited')
    // This one DOES explain itself: it is a real visitor who has sent three
    // messages, not a bot, and they deserve to know why.
    expect(result.message).toMatch(/email/i)
  })

  it('forgets submissions older than the window', async () => {
    // The store caches its payload in module state, so seeding localStorage
    // after it has been read changes nothing — the module graph has to be
    // rebuilt for the seed to be the thing that is read.
    const old = Date.now() - RATE_LIMIT.windowMs - 1000
    localStorage.setItem('forge:v1', JSON.stringify({
      version: 1, prefs: { sendHistory: [old, old, old] },
    }))
    vi.resetModules()
    const guard = await import('../../src/lib/formGuard.js')
    expect(guard.checkSubmission(good()).ok).toBe(true)
  })
})

describe('the draft', () => {
  it('round-trips', () => {
    saveDraft({ from_name: 'Ada', from_email: 'a@b.c', from_message: 'hello' })
    expect(loadDraft()).toEqual({ from_name: 'Ada', from_email: 'a@b.c', from_message: 'hello' })
  })

  it('is not saved when every field is empty', () => {
    saveDraft({ from_name: '', from_email: '', from_message: '   ' })
    expect(loadDraft()).toBeNull()
  })

  it('clears', () => {
    saveDraft({ from_name: 'Ada', from_email: '', from_message: '' })
    clearDraft()
    expect(loadDraft()).toBeNull()
  })
})

describe('mailtoFallback', () => {
  it('carries the visitor’s own text into their mail client', () => {
    const href = mailtoFallback({ email: 'me@example.com', name: 'Ada', message: 'Hello there' })
    expect(href).toMatch(/^mailto:me@example\.com\?/)
    expect(decodeURIComponent(href)).toContain('Portfolio inquiry from Ada')
    expect(decodeURIComponent(href)).toContain('Hello there')
  })

  it('survives an empty message', () => {
    expect(() => mailtoFallback({ email: 'me@example.com' })).not.toThrow()
  })

  it('escapes characters that would break the URL', () => {
    const href = mailtoFallback({ email: 'me@example.com', name: 'A&B', message: 'a=1&b=2' })
    // `&body=` is the legitimate separator; what must not appear is a raw `&`
    // or `=` inside either VALUE, which would truncate the message.
    const [, query] = href.split('?')
    const [subject, body] = query.split('&')
    expect(subject.slice('subject='.length)).not.toMatch(/[&=]/)
    expect(body.slice('body='.length)).not.toMatch(/[&=]/)
    expect(decodeURIComponent(href)).toContain('a=1&b=2')
    expect(decodeURIComponent(href)).toContain('A&B')
  })
})

describe('the honeypot field name', () => {
  it('is plausible enough that a bot will fill it', () => {
    // A field called `honeypot` is a field every bot skips.
    expect(HONEYPOT_FIELD).not.toMatch(/honey|trap|bot|spam/i)
  })
})

/**
 * formGuard.js — T-044.3.
 *
 * D-15: the contact form posts to EmailJS from the client with a public key,
 * with no honeypot, no timing check and no rate limit of any kind. It will be
 * found by a scraper and it will be abused — and every abusive submission
 * costs the owner quota on a free tier, so the failure mode is "the form
 * stops working for real visitors".
 *
 * Client-side defences cannot stop a determined attacker; nothing that ships
 * in the browser can. What they do stop is the overwhelming majority of what
 * actually hits a small site: unattended form-filling bots. Three layers,
 * each cheap and each catching something different:
 *
 *  1. **A honeypot.** A field that is invisible to people and irresistible to
 *     a bot that fills every input it finds. Hidden with CSS rather than
 *     `type="hidden"` (which a bot skips) and marked `aria-hidden` +
 *     `tabindex="-1"` so a screen-reader user never meets it.
 *  2. **A minimum time to submit.** A human cannot read three labels and
 *     write a message in under two seconds. A script can do it in twenty
 *     milliseconds.
 *  3. **A rate limit** in the unified store: three submissions an hour from
 *     one browser. This is the one that protects the quota when someone
 *     leans on the send button.
 *
 * Turnstile belongs in front of a server route (P6); until there is one, this
 * is what is honestly available.
 */
import { getStore, setStore } from './store.js'

export const HONEYPOT_FIELD = 'company_website'
export const MIN_FILL_MS = 2000
export const RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 }

/**
 * @param {{ honeypot: string, startedAt: number }} submission
 * @returns {{ ok: true } | { ok: false, reason: string, message: string }}
 */
export function checkSubmission({ honeypot, startedAt }) {
  if (honeypot) {
    return {
      ok: false,
      reason: 'honeypot',
      // Deliberately the same message a genuine failure gets: telling a bot
      // which check it failed is telling it how to pass next time.
      message: 'That didn’t send. Please email me directly.',
    }
  }

  const elapsed = Date.now() - startedAt
  if (elapsed < MIN_FILL_MS) {
    return {
      ok: false,
      reason: 'too-fast',
      message: 'That didn’t send. Please email me directly.',
    }
  }

  const history = (getStore().prefs.sendHistory || []).filter(
    (at) => Date.now() - at < RATE_LIMIT.windowMs
  )
  if (history.length >= RATE_LIMIT.max) {
    return {
      ok: false,
      reason: 'rate-limited',
      message: `That is ${RATE_LIMIT.max} messages in an hour — the rest is quicker by email.`,
    }
  }

  return { ok: true }
}

/** Record a successful send against the rate limit. */
export function recordSubmission() {
  const history = (getStore().prefs.sendHistory || []).filter(
    (at) => Date.now() - at < RATE_LIMIT.windowMs
  )
  setStore({ prefs: { sendHistory: [...history, Date.now()] } })
}

/** The draft, so an accidental navigation does not lose what was typed. */
const DRAFT_KEY = 'contactDraft'

export function saveDraft(values) {
  const hasContent = Object.values(values).some((v) => String(v).trim())
  setStore({ prefs: { [DRAFT_KEY]: hasContent ? values : null } })
}

export function loadDraft() {
  const draft = getStore().prefs[DRAFT_KEY]
  if (!draft || typeof draft !== 'object') return null
  return draft
}

export function clearDraft() {
  setStore({ prefs: { [DRAFT_KEY]: null } })
}

/**
 * The failure path. If the third-party send fails there is still a working
 * way to reach a human, and the visitor's typing is carried into it rather
 * than lost — which is the difference between "the form is broken" and "the
 * form used a different door".
 */
export function mailtoFallback({ email, name, message }) {
  const subject = encodeURIComponent(name ? `Portfolio inquiry from ${name}` : 'Portfolio inquiry')
  const body = encodeURIComponent(message || '')
  return `mailto:${email}?subject=${subject}&body=${body}`
}

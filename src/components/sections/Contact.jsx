import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import emailjs from '@emailjs/browser'
import Reveal from '../ui/Reveal.jsx'
import MagneticButton from '../ui/MagneticButton.jsx'
import MagneticTilt from '../ui/MagneticTilt.jsx'
import { SOCIALS } from '../../lib/content.js'
import { useSound } from '../../contexts/SoundContext.jsx'
import { useSpotlight } from '../../hooks/useSpotlight.js'
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from '../../lib/emailConfig.js'
import {
  HONEYPOT_FIELD, checkSubmission, recordSubmission,
  saveDraft, loadDraft, clearDraft, mailtoFallback,
} from '../../lib/formGuard.js'
import SplitText from '../ui/SplitText.jsx'
// Spark moved to footer wordmark per plan §3.3
// AVIF-first, two widths. These previews render at ~420px wide but shipped at
// up to 1919px; resume-preview alone was 286 KB.
import leetcodeShot from '../../assets/social/leetcode-profile.webp?w=480;960&format=avif;webp&as=picture'
import codechefShot from '../../assets/social/codechef-profile.webp?w=480;960&format=avif;webp&as=picture'
import linkedinShot from '../../assets/social/linkedin-profile.webp?w=480;960&format=avif;webp&as=picture'
import githubShot from '../../assets/social/github-profile.webp?w=480;960&format=avif;webp&as=picture'
// The resume source is only 762px wide, so asking for 960 would upscale it.
import resumeShot from '../../assets/social/resume-preview.webp?w=480;762&format=avif;webp&as=picture'
import Picture from '../ui/Picture.jsx'

const PLATFORMS = [
  { label: 'GitHub', value: '18+ Repos', href: SOCIALS.github, color: '#9aa5b1', shot: githubShot, tag: 'OPEN SOURCE' },
  { label: 'LeetCode', value: 'Knight Rank · 1972 Max Rating', href: SOCIALS.leetcode, color: '#ffa116', shot: leetcodeShot, tag: '800+ SOLVED' },
  { label: 'CodeChef', value: '4★ Coder · gaurav_jb', href: SOCIALS.codechef, color: '#d68f4c', shot: codechefShot, tag: 'RATING 1830' },
  { label: 'LinkedIn', value: 'IIIT Vadodara · CSE Graduate \'26', href: SOCIALS.linkedin, color: '#3b9eef', shot: linkedinShot, tag: 'CONNECT' },
  { label: 'Resume', value: 'Full Build Log · PDF', href: '/Gaurav_Resume.pdf', color: 'var(--accent)', shot: resumeShot, tag: 'DOWNLOAD' },
]

// Field names match the variables already wired into the EmailJS template
// ({{from_name}}, {{from_email}}, {{from_message}}, {{to_name}}, {{title}}).
const FIELDS = [
  // T-044.1 — native constraint validation FIRST. `required`, `type="email"`
  // and `minLength` work before a single byte of JavaScript has run, and the
  // browser's own messages are localised, announced and familiar. The custom
  // layer below adds context; it does not replace this.
  { name: 'from_name', label: 'Your Name', type: 'text', autoComplete: 'name', minLength: 2, hint: 'So I know who I am replying to.' },
  { name: 'from_email', label: 'Your Email', type: 'email', autoComplete: 'email', hint: 'Where the reply goes. Nothing else is sent here.' },
]

function PlatformCard({ platform, index }) {
  const ref = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const spotlight = useSpotlight()

  const onMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: py * -6, y: px * 6 })
    spotlight.onMouseMove(e)
  }
  const onMouseLeave = () => setTilt({ x: 0, y: 0 })

  return (
    <Reveal delay={index * 0.08} className="w-full [perspective:1200px]">
      <motion.a
        ref={ref}
        href={platform.href}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor="view"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ type: 'spring', stiffness: 180, damping: 18, mass: 0.6 }}
        whileHover={{ y: -6 }}
        className="group relative rounded-[26px] overflow-hidden block p-[1.5px]"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Rotating gradient ring border — revealed on hover */}
        <span
          className="absolute -inset-[40%] opacity-0 group-hover:opacity-100 transition-opacity duration-base animate-[spin_4s_linear_infinite]"
          style={{
            background: `conic-gradient(from 0deg, ${platform.color}, transparent 30%, transparent 70%, ${platform.color})`,
          }}
          aria-hidden="true"
        />
        <span className="absolute inset-[1.5px] rounded-[24.5px] bg-[var(--surface-0)]" aria-hidden="true" />

        <div
          className="relative rounded-[24.5px] glass spotlight sheen overflow-hidden h-full"
          {...spotlight}
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <Picture
              picture={platform.shot}
              alt={`${platform.label} preview`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
              className="w-full h-full object-cover object-top transition-transform duration-cinema ease-[cubic-bezier(0.16,1,0.3,1)] scale-105 group-hover:scale-[1.12]"
              style={{ filter: 'saturate(0.9)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-[var(--surface-0)]/30 to-transparent opacity-95" />
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-base mix-blend-overlay"
              style={{ background: `linear-gradient(140deg, ${platform.color}60, transparent 65%)` }}
            />
            <span
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full font-mono text-[12px] tracking-[0.2em]"
              style={{
                color: platform.color,
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${platform.color}50`,
              }}
            >
              {platform.tag}
            </span>
            <span className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-transform duration-fast group-hover:scale-110 group-hover:rotate-45" style={{ background: 'rgba(0,0,0,0.45)', border: `1px solid ${platform.color}60`, color: platform.color }}>
              ↗
            </span>
          </div>

          <div className="relative z-10 p-5">
            <p className="font-mono text-[12px] tracking-widest text-[var(--ink-low)] mb-1">{platform.label.toUpperCase()}</p>
            <p className="font-display text-lg md:text-xl text-[var(--ink)] truncate">{platform.value}</p>
          </div>

          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-base origin-left"
            style={{ background: platform.color, boxShadow: `0 0 12px ${platform.color}` }}
          />
        </div>
      </motion.a>
    </Reveal>
  )
}

export default function Contact() {
  const formRef = useRef(null)
  const [values, setValues] = useState(() => loadDraft() || { from_name: '', from_email: '', from_message: '' })
  /*
   * T-044.4 — five explicit states, each with visible copy:
   *   idle → validating → sending → sent → failed
   * The version this replaces had three, and "failed" said only that
   * something went wrong. A visitor who has typed a paragraph and been told
   * "error" has lost their paragraph; here the message survives and the
   * mailto fallback carries it.
   */
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  // T-044.3 — a human cannot fill this in under two seconds. The clock starts
  // when the section mounts, not when the first key is pressed, because a bot
  // does not focus fields before filling them.
  const startedAt = useRef(Date.now())

  // T-044.5 — the draft survives an accidental navigation.
  useEffect(() => {
    const id = setTimeout(() => saveDraft(values), 400)
    return () => clearTimeout(id)
  }, [values])

  /*
   * Typing again after a send starts a NEW message.
   *
   * The state machine had no edge out of `sent`, so the button kept reading
   * "Sent — thank you!" and the success line kept sitting under a form the
   * visitor had already begun refilling — which reads as "it did not take my
   * second message". The first keystroke after a success is unambiguous
   * intent to send another one, so it returns the form to `idle` and restarts
   * the anti-bot clock, since this is genuinely a new submission.
   */
  const beginNewMessage = () => {
    if (status !== 'sent' && status !== 'failed') return
    setStatus('idle')
    setError('')
    startedAt.current = Date.now()
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const form = formRef.current

    // Let the browser speak first.
    setStatus('validating')
    if (!form.checkValidity()) {
      form.reportValidity()
      setStatus('idle')
      return
    }

    const guard = checkSubmission({
      honeypot: form.elements[HONEYPOT_FIELD]?.value || '',
      startedAt: startedAt.current,
    })
    if (!guard.ok) {
      setError(guard.message)
      setStatus('failed')
      return
    }

    setStatus('sending')
    setError('')
    try {
      await emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, form, {
        publicKey: EMAILJS_PUBLIC_KEY,
      })
      recordSubmission()
      clearDraft()
      setStatus('sent')
      setValues({ from_name: '', from_email: '', from_message: '' })
    } catch (err) {
      // The message is NOT cleared: it is the visitor's work, and the mailto
      // fallback below is about to need it.
      console.error('EmailJS send failed:', err)
      setError('The send failed. Your message is still here — this link opens it in your mail app.')
      setStatus('failed')
    }
  }

  const sending = status === 'sending' || status === 'validating'

  return (
    <section id="contact" aria-labelledby="contact-heading" data-field="7" data-loop className="relative section-rhythm container-px overflow-hidden">
      <span className="ghost-numeral" aria-hidden="true">07</span>
      {/* Spark moved to footer wordmark */}

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">07 — CONTACT</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 id="contact-heading" className="font-display text-[var(--step-5)] leading-[0.95] mb-12 max-w-4xl">
            <SplitText>Get in </SplitText>
            <SplitText className="text-gradient" delay={0.1}>touch.</SplitText>
          </h2>
        </Reveal>

        {/* Platform Hub Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {PLATFORMS.map((p, i) => (
            <PlatformCard key={p.label} platform={p} index={i} />
          ))}
        </div>

        <div className="grid md:grid-cols-[1fr_1.1fr] gap-16">
          <Reveal delay={0.15}>
            <div className="flex flex-col gap-6">
              <ContactLink label="Email" value={SOCIALS.email} href={`mailto:${SOCIALS.email}`} />
              <CopyEmail />
              <ContactLink label="Phone" value={SOCIALS.phone} href={`tel:${SOCIALS.phone.replace(/\s/g, '')}`} />
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <form ref={formRef} onSubmit={onSubmit} noValidate={false} className="contact-form p-8 rounded-3xl glass glass-glow sheen">
              <input type="hidden" name="to_name" value="Gaurav" />

              {/*
                T-044.3 — the honeypot. Hidden with CSS rather than
                `type="hidden"`, because a bot skips hidden inputs and fills
                visible ones; `aria-hidden` and `tabIndex={-1}` keep it out of
                the reach of anyone using the keyboard or a screen reader, and
                `autoComplete="off"` stops a browser filling it in helpfully.
              */}
              <div className="form-honeypot" aria-hidden="true">
                <label htmlFor={HONEYPOT_FIELD}>Company website (leave this empty)</label>
                <input
                  id={HONEYPOT_FIELD}
                  name={HONEYPOT_FIELD}
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  defaultValue=""
                />
              </div>
              <input
                type="hidden"
                name="title"
                value={values.from_name ? `Portfolio inquiry from ${values.from_name}` : 'New portfolio inquiry'}
                readOnly
              />
              {FIELDS.map((f) => (
                <div key={f.name} className="relative mb-6 group">
                  <input
                    id={f.name}
                    name={f.name}
                    type={f.type}
                    required
                    minLength={f.minLength}
                    autoComplete={f.autoComplete}
                    disabled={sending}
                    value={values[f.name]}
                    onChange={(e) => { beginNewMessage(); setValues((v) => ({ ...v, [f.name]: e.target.value })) }}
                    placeholder=" "
                    /* T-044.2 — the hint is tied to the field, so it is read
                       out with it rather than being decoration a screen reader
                       never encounters. */
                    aria-describedby={f.name + "-hint"}
                    className="w-full bg-transparent border-b border-[var(--glass-border)] py-3 outline-none focus:border-[var(--accent)] transition-colors duration-fast peer disabled:opacity-50"
                  />
                  <label
                    htmlFor={f.name}
                    className="absolute left-0 top-3 text-[var(--ink-low)] text-sm pointer-events-none transition-all duration-fast peer-focus:-translate-y-5 peer-focus:text-xs peer-focus:text-[var(--accent-bright)] peer-[&:not(:placeholder-shown)]:-translate-y-5 peer-[&:not(:placeholder-shown)]:text-xs"
                  >
                    {f.label}
                  </label>
                  <p id={f.name + "-hint"} className="form-hint">{f.hint}</p>
                </div>
              ))}
              <div className="relative mb-8 group">
                <textarea
                  id="from_message"
                  name="from_message"
                  required
                  minLength={10}
                  rows={3}
                  disabled={sending}
                  value={values.from_message}
                  onChange={(e) => { beginNewMessage(); setValues((v) => ({ ...v, from_message: e.target.value })) }}
                  placeholder=" "
                  aria-describedby="from_message-hint"
                  className="w-full bg-transparent border-b border-[var(--glass-border)] py-3 outline-none focus:border-[var(--accent)] transition-colors duration-fast resize-none peer disabled:opacity-50"
                />
                <label
                  htmlFor="from_message"
                  className="absolute left-0 top-3 text-[var(--ink-low)] text-sm pointer-events-none transition-all duration-fast peer-focus:-translate-y-5 peer-focus:text-xs peer-focus:text-[var(--accent-bright)] peer-[&:not(:placeholder-shown)]:-translate-y-5 peer-[&:not(:placeholder-shown)]:text-xs"
                >
                  Message
                </label>
                <p id="from_message-hint" className="form-hint">
                  What you are building, or what you are hiring for. A few lines is plenty.
                </p>
              </div>

              <MagneticTilt>
                <MagneticButton
                  as="button"
                  type="submit"
                  data-cursor="send"
                  disabled={sending}
                  className="w-full px-7 py-4 rounded-full bg-[var(--accent)] text-[var(--surface-0)] font-medium shadow-[0_0_32px_color-mix(in_oklch,var(--accent)_40%,transparent)] hover:shadow-[0_0_56px_color-mix(in_oklch,var(--accent)_50%,transparent)] transition-shadow duration-base disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending && (
                    <span className="w-4 h-4 rounded-full border-2 border-[var(--surface-0)]/30 border-t-[var(--surface-0)] animate-spin" aria-hidden="true" />
                  )}
                  {sending ? 'Sending…' : status === 'sent' ? 'Sent — thank you!' : 'Send Message'}
                </MagneticButton>
              </MagneticTilt>

              {/*
                T-044.2 — one live region for the outcome. `polite` rather
                than `assertive`: the visitor has just pressed a button and is
                already looking at it, so interrupting them is unnecessary.
                Errors get role="alert" on their own paragraph below.
              */}
              <p className="sr-only" aria-live="polite">
                {status === 'sending' ? 'Sending your message' : status === 'sent' ? 'Message sent' : ''}
              </p>

              <AnimatePresence mode="wait">
                {status === 'sent' && (
                  <motion.p
                    key="ok"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 text-sm text-emerald-400 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
                    Your message has been sent. I&rsquo;ll get back to you soon.
                  </motion.p>
                )}
                {status === 'failed' && (
                  <motion.p
                    key="err"
                    role="alert"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 text-sm text-[var(--warm)]"
                  >
                    {error || 'Something went wrong sending that.'}{' '}
                    {/* T-044.4 — the fallback carries the visitor's own text
                        into their mail client, so nothing they wrote is lost
                        to a third-party outage. */}
                    <a
                      href={mailtoFallback({
                        email: SOCIALS.email,
                        name: values.from_name,
                        message: values.from_message,
                      })}
                      className="underline hover:text-[var(--warm-dim)]"
                    >
                      Email it to {SOCIALS.email} instead
                    </a>
                    .
                  </motion.p>
                )}
              </AnimatePresence>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/**
 * W5 — one-click copy. A `mailto:` link opens whatever the OS thinks the mail
 * client is, which for a recruiter on a work machine is often nothing at all;
 * the address on the clipboard always works.
 */
function CopyEmail() {
  const [copied, setCopied] = useState(false)
  const sound = useSound()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SOCIALS.email)
    } catch {
      // Clipboard API needs a secure context; fall back to a selection copy.
      const ta = document.createElement('textarea')
      ta.value = SOCIALS.email
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* nothing else to try */ }
      document.body.removeChild(ta)
    }
    sound?.play('click')
    setCopied(true)
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'reached-out' }))
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="copy-email">
      <button
        type="button"
        onClick={copy}
        data-cursor="view"
        className="project-btn project-btn--ghost px-4 py-2 rounded-full text-[12px] font-mono"
      >
        COPY EMAIL
      </button>
      <span className="copy-email__flash" data-on={copied} role="status" aria-live="polite">
        {copied ? 'COPIED ✓' : ''}
      </span>
    </div>
  )
}

function ContactLink({ label, value, href }) {
  const external = typeof href === 'string' && !href.startsWith('mailto:') && !href.startsWith('tel:')
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      data-cursor="view"
      className="group flex items-center justify-between border-b border-[var(--glass-border)] pb-4 hover:border-[var(--accent-dim)] transition-colors duration-fast"
    >
      <span className="font-mono text-xs tracking-widest text-[var(--ink-low)]">{label}</span>
      <motion.span
        className="font-display text-lg md:text-xl text-[var(--ink-mid)] group-hover:text-[var(--accent-bright)] transition-colors duration-fast"
        whileHover={{ x: 6 }}
      >
        {value}
      </motion.span>
    </a>
  )
}

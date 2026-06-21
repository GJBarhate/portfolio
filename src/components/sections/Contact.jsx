import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import emailjs from '@emailjs/browser'
import Reveal from '../ui/Reveal.jsx'
import MagneticButton from '../ui/MagneticButton.jsx'
import { SOCIALS } from '../../lib/content.js'
import { useSpotlight } from '../../hooks/useSpotlight.js'
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from '../../lib/emailConfig.js'
import leetcodeShot from '../../assets/social/leetcode-profile.webp'
import codechefShot from '../../assets/social/codechef-profile.webp'
import linkedinShot from '../../assets/social/linkedin-profile.webp'
import githubShot from '../../assets/social/github-profile.webp'
import resumeShot from '../../assets/social/resume-preview.webp'

const PLATFORMS = [
  { label: 'GitHub', value: '50+ Repos · 100+ Contributions', href: SOCIALS.github, color: '#9aa5b1', shot: githubShot, tag: 'OPEN SOURCE' },
  { label: 'LeetCode', value: 'Knight Rank · 1909 Rated', href: SOCIALS.leetcode, color: '#ffa116', shot: leetcodeShot, tag: '600+ SOLVED' },
  { label: 'CodeChef', value: '4★ Coder · gaurav_jb', href: SOCIALS.codechef, color: '#d68f4c', shot: codechefShot, tag: 'RATING 1830' },
  { label: 'LinkedIn', value: 'IIIT Vadodara · CSE Graduate \'26', href: SOCIALS.linkedin, color: '#3b9eef', shot: linkedinShot, tag: 'CONNECT' },
  { label: 'Resume', value: 'Full Build Log · PDF', href: '/Gaurav_Resume.pdf', color: 'var(--plasma)', shot: resumeShot, tag: 'DOWNLOAD' },
]

// Field names match the variables already wired into the EmailJS template
// ({{from_name}}, {{from_email}}, {{from_message}}, {{to_name}}, {{title}}).
const FIELDS = [
  { name: 'from_name', label: 'Your Name', type: 'text' },
  { name: 'from_email', label: 'Your Email', type: 'email' },
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
          className="absolute -inset-[40%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-[spin_4s_linear_infinite]"
          style={{
            background: `conic-gradient(from 0deg, ${platform.color}, transparent 30%, transparent 70%, ${platform.color})`,
          }}
          aria-hidden="true"
        />
        <span className="absolute inset-[1.5px] rounded-[24.5px] bg-[var(--void-0)]" aria-hidden="true" />

        <div
          className="relative rounded-[24.5px] glass spotlight sheen overflow-hidden h-full"
          {...spotlight}
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <motion.img
              src={platform.shot}
              alt={`${platform.label} preview`}
              loading="lazy"
              decoding="async"
              animate={{ scale: 1.05 }}
              whileHover={{ scale: 1.12 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full object-cover object-top"
              style={{ filter: 'saturate(0.9)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--void-0)] via-[var(--void-0)]/30 to-transparent opacity-95" />
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"
              style={{ background: `linear-gradient(140deg, ${platform.color}60, transparent 65%)` }}
            />
            <span
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full font-mono text-[9px] tracking-[0.2em] backdrop-blur-md"
              style={{
                color: platform.color,
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${platform.color}50`,
              }}
            >
              {platform.tag}
            </span>
            <span className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md text-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-45" style={{ background: 'rgba(0,0,0,0.45)', border: `1px solid ${platform.color}60`, color: platform.color }}>
              ↗
            </span>
          </div>

          <div className="relative z-10 p-5">
            <p className="font-mono text-[10px] tracking-widest text-[var(--ink-faint)] mb-1">{platform.label.toUpperCase()}</p>
            <p className="font-display text-lg md:text-xl text-[var(--ink)] truncate">{platform.value}</p>
          </div>

          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"
            style={{ background: platform.color, boxShadow: `0 0 12px ${platform.color}` }}
          />
        </div>
      </motion.a>
    </Reveal>
  )
}

export default function Contact() {
  const formRef = useRef(null)
  const [values, setValues] = useState({ from_name: '', from_email: '', from_message: '' })
  const [status, setStatus] = useState('idle') // idle · sending · success · error

  const onSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    try {
      await emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, formRef.current, {
        publicKey: EMAILJS_PUBLIC_KEY,
      })
      setStatus('success')
      setValues({ from_name: '', from_email: '', from_message: '' })
    } catch (err) {
      console.error('EmailJS send failed:', err)
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="relative py-32 container-px mesh-gradient-b overflow-hidden">
      <span className="ghost-numeral" aria-hidden="true">06</span>

      <div className="relative z-[1]">
        <Reveal>
          <span className="level-badge mb-4">06 — CONTACT</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.95] mb-16 max-w-4xl">
            Get in <span className="text-gradient">touch.</span>
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
              <ContactLink label="Phone" value={SOCIALS.phone} href={`tel:${SOCIALS.phone.replace(/\s/g, '')}`} />
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <form ref={formRef} onSubmit={onSubmit} className="p-8 rounded-3xl glass glass-glow sheen">
              <input type="hidden" name="to_name" value="Gaurav" />
              <input
                type="hidden"
                name="title"
                value={values.from_name ? `Portfolio inquiry from ${values.from_name}` : 'New portfolio inquiry'}
                readOnly
              />
              {FIELDS.map((f) => (
                <div key={f.name} className="relative mb-6 group">
                  <input
                    name={f.name}
                    type={f.type}
                    required
                    disabled={status === 'sending'}
                    value={values[f.name]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    placeholder=" "
                    className="w-full bg-transparent border-b border-white/15 py-3 outline-none focus:border-[var(--plasma)] transition-colors duration-300 peer disabled:opacity-50"
                  />
                  <label className="absolute left-0 top-3 text-[var(--ink-faint)] text-sm pointer-events-none transition-all duration-300 peer-focus:-translate-y-5 peer-focus:text-xs peer-focus:text-[var(--plasma-bright)] peer-[&:not(:placeholder-shown)]:-translate-y-5 peer-[&:not(:placeholder-shown)]:text-xs">
                    {f.label}
                  </label>
                </div>
              ))}
              <div className="relative mb-8 group">
                <textarea
                  name="from_message"
                  required
                  rows={3}
                  disabled={status === 'sending'}
                  value={values.from_message}
                  onChange={(e) => setValues((v) => ({ ...v, from_message: e.target.value }))}
                  placeholder=" "
                  className="w-full bg-transparent border-b border-white/15 py-3 outline-none focus:border-[var(--plasma)] transition-colors duration-300 resize-none peer disabled:opacity-50"
                />
                <label className="absolute left-0 top-3 text-[var(--ink-faint)] text-sm pointer-events-none transition-all duration-300 peer-focus:-translate-y-5 peer-focus:text-xs peer-focus:text-[var(--plasma-bright)] peer-[&:not(:placeholder-shown)]:-translate-y-5 peer-[&:not(:placeholder-shown)]:text-xs">
                  Message
                </label>
              </div>

              <MagneticButton
                as="button"
                type="submit"
                data-cursor="send"
                disabled={status === 'sending'}
                className="w-full px-7 py-4 rounded-full bg-[var(--plasma)] text-[var(--void-0)] font-medium shadow-[0_0_32px_color-mix(in_oklch,var(--plasma)_40%,transparent)] hover:shadow-[0_0_56px_color-mix(in_oklch,var(--plasma)_50%,transparent)] transition-shadow duration-500 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'sending' && (
                  <span className="w-4 h-4 rounded-full border-2 border-[var(--void-0)]/30 border-t-[var(--void-0)] animate-spin" aria-hidden="true" />
                )}
                {status === 'sending' ? 'Sending…' : status === 'success' ? 'Sent — thank you!' : 'Send Message'}
              </MagneticButton>

              <AnimatePresence mode="wait">
                {status === 'success' && (
                  <motion.p
                    key="ok"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 text-sm text-emerald-400 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
                    Your message has been sent. I'll get back to you soon.
                  </motion.p>
                )}
                {status === 'error' && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 text-sm text-[var(--ember)]"
                  >
                    Something went wrong sending that. Please email me directly at{' '}
                    <a href={`mailto:${SOCIALS.email}`} className="underline hover:text-[var(--ember-dim)]">
                      {SOCIALS.email}
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

function ContactLink({ label, value, href, external }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      data-cursor="view"
      className="group flex items-center justify-between border-b border-white/8 pb-4 hover:border-[var(--plasma-dim)] transition-colors duration-300"
    >
      <span className="font-mono text-xs tracking-widest text-[var(--ink-faint)]">{label}</span>
      <motion.span
        className="font-display text-lg md:text-xl text-[var(--ink-dim)] group-hover:text-[var(--plasma-bright)] transition-colors duration-300"
        whileHover={{ x: 6 }}
      >
        {value}
      </motion.span>
    </a>
  )
}

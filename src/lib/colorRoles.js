/**
 * Accent allocation per section (P3 §5.3).
 *
 * The old version gave every section a saturated accent, and --accent showed
 * up in glows, borders, text, particles, cursor, scrollbar and 3D emissive all
 * at once. When everything is accented, nothing is.
 *
 * The rule this encodes: one primary accent per section — never two competing —
 * and at most one saturated element per viewport-height of scroll.
 */
export const SECTION_ACCENTS = {
  // 00 Hero — signature gradient on the name only
  hero:          { primary: 'var(--accent)',        secondary: 'var(--violet)' },
  // 01 About — ink on surface; accent restricted to the avatar rim + one rule
  about:         { primary: 'var(--ink-hi)',        secondary: 'var(--accent)' },
  // 02 Player Stats — the only amber-dominant section, so achievements read as
  // rewards instead of more of the same teal
  stats:         { primary: 'var(--warm)',          secondary: 'var(--accent-dim)' },
  // 03 Skills — category dots only
  skills:        { primary: 'var(--accent-dim)',    secondary: 'var(--ink-mid)' },
  // 04 Projects — each card carries its own accent; the section stays neutral
  projects:      { primary: 'var(--ink-hi)',        secondary: 'var(--accent-dim)' },
  // 05 Timeline — the connecting line, nothing else
  timeline:      { primary: 'var(--accent)',        secondary: 'var(--ink-mid)' },
  // 06 How I Build — numerals only
  'how-i-build': { primary: 'var(--violet)',        secondary: 'var(--ink-mid)' },
  // 07 Contact — full-strength CTA, the loudest colour on the page,
  // deliberately last
  contact:       { primary: 'var(--accent-bright)', secondary: 'var(--warm)' },
}

export const SKILL_CATEGORY_COLORS = {
  frontend: 'var(--accent)',
  backend:  'var(--violet)',
  tools:    'var(--warm)',
  language: 'var(--accent-bright)',
}

export const ACHIEVEMENT_TIER_COLORS = {
  bronze: 'var(--warm-dim)',
  silver: 'var(--ink-mid)',
  gold:   'var(--warm)',
}

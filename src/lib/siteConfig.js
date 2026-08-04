/**
 * siteConfig.js — T-005. The single source of truth for identity.
 *
 * Before this file existed, `public/sitemap.xml` advertised
 * `https://gauravbarhate.dev/` while `index.html` declared
 * `https://gauravportfolio-beryl.vercel.app/` as canonical. One of those two
 * was a lie, and search engines were acting on it: a sitemap pointing at a
 * host that does not resolve is worse than no sitemap at all.
 *
 * `SITE_URL` is the origin that is *actually served today*, because a
 * canonical URL is a statement of fact, not of intent. When the custom domain
 * is registered and pointed at Vercel, this is a one-line change here plus the
 * 308 redirect already prepared in `vercel.json` — nothing else in the
 * codebase repeats the origin, so nothing else can drift out of step with it.
 *
 * Every consumer derives from these constants:
 *   index.html (canonical, og:url, og:image, JSON-LD) via the `siteMeta` Vite
 *   plugin · scripts/gen-sitemap.mjs · public/robots.txt · scripts/check-canonical.mjs
 */

/** No trailing slash. Every consumer appends its own path. */
export const SITE_URL = 'https://gauravportfolio-beryl.vercel.app'

export const SITE_NAME = 'Gaurav Barhate — Portfolio'
export const SITE_TITLE = 'Gaurav Barhate — Full-Stack Developer & Competitive Programmer'
export const SITE_DESCRIPTION =
  'Gaurav Barhate — B.Tech in Computer Science Engineering, LeetCode Knight (1972 max rating, 800+ problems solved), full-stack developer with 5+ apps in production including PeerCode, FlowShield, VoiceAns, OneCart, and a full LMS.'

export const AUTHOR = {
  name: 'Gaurav Barhate',
  email: 'gauravjbarhate554@gmail.com',
  phone: '+91 93733 27427',
  role: 'Full Stack Developer & Competitive Programmer',
  alumniOf: 'IIIT Vadodara',
}

export const SOCIAL = {
  github: 'https://github.com/GJBarhate',
  leetcode: 'https://leetcode.com/u/chgyCygKwQ/',
  codechef: 'https://www.codechef.com/users/gaurav_jb',
  linkedin: 'https://www.linkedin.com/in/gaurav-barhate-056175271/',
}

/**
 * Every route the site serves. The sitemap generator walks this; T-085 adds
 * per-project and per-note entries here rather than in the generator, so the
 * generator never needs to know what a "route" is.
 */
export const ROUTES = [
  { path: '/', changefreq: 'monthly', priority: '1.0' },
]

/** Absolute URL for a site-relative path. */
export const absolute = (path = '/') =>
  `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

export const OG_IMAGE = absolute('/og-image.png')
export const RESUME_PATH = '/Gaurav_Resume.pdf'

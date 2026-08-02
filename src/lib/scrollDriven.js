/**
 * Native CSS scroll-driven animation support.
 *
 * Where it exists (Chromium 115+, Safari 18+), reveal / progress / parallax
 * run entirely on the compositor: no IntersectionObserver, no scroll-linked
 * React re-render, and no main-thread work at all. Where it does not (Firefox
 * today), the existing Framer Motion path is used unchanged, so nobody loses
 * the effect — some visitors just get the cheaper implementation.
 */
export const supportsScrollDriven =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline: view()')

/** Publishes the capability so CSS can branch on it too. */
export function markScrollDrivenSupport() {
  if (typeof document === 'undefined') return supportsScrollDriven
  document.documentElement.dataset.sda = supportsScrollDriven ? 'on' : 'off'
  return supportsScrollDriven
}

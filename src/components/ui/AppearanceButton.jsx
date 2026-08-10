/**
 * AppearanceButton — the one visible trigger, at every width.
 *
 * The control it replaces (`ThemeToggle`'s 92×32 sliding knob) had three
 * unlabelled positions and opened a popover called "Theme Atelier"; the
 * backdrop switch beside it was `display: none` below 1,792 CSS px, which is
 * wider than a 1440 laptop, a 1600 laptop and every phone ever made. So the
 * requirements for this button are narrow and non-negotiable:
 *
 *   - it is visible at 320, 768, 1024, 1440 and 1920 (asserted in check-layout)
 *   - it is at least 44×44 (§6.6), which the 32×32 controls beside it are not
 *   - it says what it does in a word the visitor already owns
 *   - it shows the CURRENT theme, so it doubles as the state readout the
 *     three-position knob was trying to be
 *
 * The swatch is three stacked bars in the live tokens — background, accent,
 * glow — which is a status indicator rather than a picker. The picking happens
 * in the panel, where there is room to label it.
 */
import { useEffect, useState } from 'react'
import {
  THEMES,
  SYSTEM_THEME,
  getAppearance,
  onAppearanceChange,
  openAppearanceConsole,
} from '../../lib/appearance.js'

export default function AppearanceButton() {
  const [state, setState] = useState(getAppearance)
  useEffect(() => onAppearanceChange(setState), [])

  const active = THEMES.find((t) => t.id === state.theme) ?? THEMES[0]
  const following = state.themePreference === 'system'
  const name = following ? `${SYSTEM_THEME.label} (${active.label})` : active.label

  return (
    <button
      type="button"
      onClick={() => openAppearanceConsole({ source: 'header' })}
      className="appearance-btn"
      data-cursor="view"
      /* D.3.4 — an aria-label says what will HAPPEN, not what the thing is
         called. "Appearance settings" describes a noun; this describes the
         outcome and carries the current value, which a sighted visitor gets
         from the swatch. */
      aria-label={`Change appearance — theme, backdrop and motion. Currently ${name}.`}
      aria-haspopup="dialog"
      aria-keyshortcuts="Shift+A"
      title={`Appearance — theme, backdrop, motion (Shift+A). Currently ${name}.`}
    >
      <span className="appearance-btn__swatch" aria-hidden="true">
        <span style={{ background: active.bg }} />
        <span style={{ background: active.accent }} />
        <span style={{ background: active.glow }} />
      </span>
      <span className="appearance-btn__label">Appearance</span>
    </button>
  )
}

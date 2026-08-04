import { useRef } from 'react'

export default function MagneticButton({ children, className = '', strength = 0.4, as = 'button', ...props }) {
  const ref = useRef(null)
  const Tag = as

  const onMouseMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`
  }

  const onMouseLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = 'translate(0, 0)'
  }

  return (
    <Tag
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      /*
        `.magnetic-btn` carries the display and the transition, and it lives in
        `@layer components` — deliberately, because this used to hard-code the
        Tailwind utilities `inline-block transition-transform duration-fast`
        straight into the class list. A caller writing `hidden sm:inline-flex`
        then lost: two display utilities in the same layer are resolved by
        stylesheet source order, not by the order they appear in the
        attribute, so `hidden` never applied. The header's RESUME button was
        rendered at every width because of it, and at 390px it sat 69px past
        the right edge of the header — clipped by an ancestor, so neither the
        overflow gate nor the document width ever noticed.
        A `components` rule is beaten by any utility, which is the correct
        relationship between a default and an override.
      */
      className={`magnetic-btn ${className}`.trim()}
      {...props}
    >
      {children}
    </Tag>
  )
}

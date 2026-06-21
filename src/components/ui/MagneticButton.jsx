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
      className={`inline-block transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}

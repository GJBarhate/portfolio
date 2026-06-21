import { useEffect, useRef } from 'react'

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

export function useKonamiCode(onTrigger) {
  const progress = useRef(0)

  useEffect(() => {
    const handler = (e) => {
      const expected = SEQUENCE[progress.current]
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === expected) {
        progress.current += 1
        if (progress.current === SEQUENCE.length) {
          progress.current = 0
          onTrigger()
        }
      } else {
        progress.current = key === SEQUENCE[0] ? 1 : 0
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onTrigger])
}

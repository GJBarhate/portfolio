import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext.jsx'

export default function TimeSuggestionToast() {
  const { suggestion, acceptSuggestion, dismissSuggestion } = useTheme()

  return (
    <AnimatePresence>
      {suggestion && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          /*
            `left-1/2` + `translateX(-50%)` with only a MAX width is the classic
            centring trap: the box's available width is what remains to the
            right of the 50% offset — half the viewport — not the viewport. At
            390px that left ~195px, and after padding, the gap and two
            `flex-shrink-0` buttons the paragraph was handed a negative
            remainder and wrapped to one character per line. An explicit width
            is what makes the translate honest.
          */
          className="fixed bottom-8 left-1/2 z-[var(--z-cmdpal)] glass rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 shadow-2xl border border-[var(--glass-border)]"
          style={{ width: 'min(420px, calc(100vw - 2rem))' }}
        >
          <p className="text-sm text-[var(--ink-mid)] flex-1">{suggestion.toast}</p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={acceptSuggestion}
              className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-[var(--surface-0)] text-[12px] font-mono tracking-wider"
            >
              SWITCH
            </button>
            <button
              onClick={dismissSuggestion}
              className="px-3 py-1.5 rounded-full border border-[var(--glass-border)] text-[var(--ink-low)] text-[12px] font-mono hover:text-[var(--ink)] transition-colors"
            >
              DISMISS
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { Component } from 'react'

/**
 * ErrorBoundary — T-029 and T-045.
 *
 * Two changes from the version this replaces. It **reports** (D-16: the old
 * one rendered a fallback and told nobody, so production failures were
 * invisible), and it renders a *section-shaped* fallback with a working retry
 * rather than a generic block — because the common cause of a boundary
 * tripping here is a lazy chunk that failed to arrive, which is usually a
 * transient network fault, and a retry recovers it.
 *
 * The `name` prop is what makes the report useful: "a section failed" is not
 * actionable, "Projects failed" is.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, retrying: false }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    const name = this.props.name || 'unknown'
    console.error(`ErrorBoundary(${name}) caught:`, error, info)
    // The RUM module is loaded at idle and may not exist yet; a failed import
    // here must not become a second error on top of the first.
    import('../../lib/rum.js')
      .then((rum) => rum.reportError(error, {
        boundary: name,
        componentStack: String(info?.componentStack || '').split('\n').slice(0, 6).join(' | '),
      }))
      .catch(() => {})
  }

  retry = () => {
    this.setState({ retrying: true })
    // A remount is what re-triggers the lazy import. The tick of delay lets
    // the fallback paint its pressed state first, so the button does not feel
    // dead when the retry is instant.
    setTimeout(() => this.setState({ error: null, retrying: false }), 60)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      const name = this.props.name
      return (
        <div
          className="section-error l-stack"
          role="alert"
          style={{ minBlockSize: this.props.minHeight || '200px' }}
        >
          <p className="font-mono text-sm text-[var(--ink-mid)]">
            {name ? `The ${name} section didn’t load.` : 'Something went wrong rendering this section.'}
          </p>
          <p className="font-mono text-xs text-[var(--ink-low)]">
            The rest of the page is unaffected.
          </p>
          <button
            type="button"
            onClick={this.retry}
            disabled={this.state.retrying}
            className="px-4 py-2 rounded-full border border-[var(--glass-border)] text-xs font-mono text-[var(--ink-low)] hover:text-[var(--ink)] transition-colors"
          >
            {this.state.retrying ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

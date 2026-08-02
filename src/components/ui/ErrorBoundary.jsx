import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-8 text-center">
          <p className="font-mono text-sm text-[var(--ink-mid)]">Something went wrong rendering this section.</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-full border border-[var(--glass-border)] text-xs font-mono text-[var(--ink-low)] hover:text-[var(--ink)] transition-colors"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

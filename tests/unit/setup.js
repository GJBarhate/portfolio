/**
 * jsdom does not implement `matchMedia`, `ResizeObserver` or
 * `requestIdleCallback`, and several modules under test subscribe to all
 * three at import time. These are the smallest stand-ins that behave
 * correctly rather than merely existing — `matchMedia` in particular returns
 * a real `MediaQueryList`-shaped object with working listeners, because a
 * stub that never fires would let a broken subscription pass.
 */

if (!window.matchMedia) {
  window.matchMedia = (query) => {
    const listeners = new Set()
    return {
      media: query,
      matches: false,
      onchange: null,
      addEventListener: (_type, fn) => listeners.add(fn),
      removeEventListener: (_type, fn) => listeners.delete(fn),
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
      dispatchEvent: (event) => { listeners.forEach((fn) => fn(event)); return true },
    }
  }
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  }
}

if (!window.requestIdleCallback) {
  window.requestIdleCallback = (fn) => setTimeout(() => fn({ timeRemaining: () => 50 }), 0)
  window.cancelIdleCallback = (id) => clearTimeout(id)
}

if (!window.PerformanceObserver) {
  window.PerformanceObserver = class {
    observe() {}
    disconnect() {}
  }
}

/**
 * Global test setup for demo mode API tests
 * Provides mocks for browser APIs (IndexedDB, localStorage, crypto, etc.)
 */

import 'fake-indexeddb/auto'
import { vi, beforeEach, afterEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index) => Object.keys(store)[index] || null),
    _getStore: () => store,
    _setStore: (newStore) => { store = newStore }
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
})

// Mock crypto.randomUUID and crypto.subtle
let uuidCounter = 0

// crypto is read-only in jsdom, so we need to stub individual methods
const originalRandomUUID = crypto.randomUUID?.bind(crypto)
const originalSubtleDigest = crypto.subtle?.digest?.bind(crypto.subtle)

// Stub randomUUID
vi.stubGlobal('crypto', {
  ...crypto,
  randomUUID: vi.fn(() => {
    uuidCounter++
    return `test-uuid-${uuidCounter.toString().padStart(4, '0')}`
  }),
  subtle: {
    ...crypto.subtle,
    digest: vi.fn(async (algorithm, data) => {
      // Simple mock that returns a consistent hash based on input
      // In real tests, we just need consistent behavior
      const bytes = new Uint8Array(data)
      const sum = Array.from(bytes).reduce((a, b) => a + b, 0)
      const result = new Uint8Array(32)
      for (let i = 0; i < 32; i++) {
        result[i] = (sum + i) % 256
      }
      return result.buffer
    })
  }
})

// Mock URL.createObjectURL / revokeObjectURL
let blobUrlCounter = 0
const blobUrlMap = new Map()

global.URL.createObjectURL = vi.fn((blob) => {
  blobUrlCounter++
  const url = `blob:mock-${blobUrlCounter}`
  blobUrlMap.set(url, blob)
  return url
})

global.URL.revokeObjectURL = vi.fn((url) => {
  blobUrlMap.delete(url)
})

// Mock Image class for thumbnail generation
class MockImage {
  constructor() {
    this._src = ''
    this.width = 512
    this.height = 512
    this.onload = null
    this.onerror = null
  }

  set src(value) {
    this._src = value
    // Use queueMicrotask instead of setTimeout so it works with fake timers
    // This fires after the current synchronous code but doesn't require timer advancement
    queueMicrotask(() => {
      if (this.onload) this.onload()
    })
  }

  get src() {
    return this._src
  }
}

global.Image = MockImage

// Mock canvas for thumbnail generation
const mockCanvasContext = {
  drawImage: vi.fn()
}

const mockCanvas = {
  width: 256,
  height: 256,
  getContext: vi.fn(() => mockCanvasContext),
  toBlob: vi.fn((callback, type, quality) => {
    const blob = new Blob(['mock-canvas-output'], { type: type || 'image/webp' })
    callback(blob)
  })
}

// Mock document.createElement for canvas
const originalCreateElement = document.createElement.bind(document)
document.createElement = vi.fn((tagName) => {
  if (tagName === 'canvas') {
    return mockCanvas
  }
  return originalCreateElement(tagName)
})

// Mock navigator.storage for getStorageEstimate
Object.defineProperty(global.navigator, 'storage', {
  value: {
    estimate: vi.fn(async () => ({
      usage: 1024 * 1024, // 1MB
      quota: 1024 * 1024 * 100 // 100MB
    }))
  },
  writable: true
})

// Mock fetch (will be overridden in individual tests as needed)
global.fetch = vi.fn()

// Reset state before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  uuidCounter = 0
  blobUrlCounter = 0
  blobUrlMap.clear()

  // Reset indexedDB by deleting the database
  // Note: fake-indexeddb handles this per-test via isolation
})

afterEach(() => {
  // Additional cleanup if needed
})

// Export utilities for tests
export {
  localStorageMock,
  blobUrlMap,
  mockCanvas,
  mockCanvasContext
}

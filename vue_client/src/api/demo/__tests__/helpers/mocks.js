/**
 * Mock utilities for demo mode API tests
 */

import { vi } from 'vitest'
import {
  sampleHordeResponse,
  sampleHordeStatusResponse,
  sampleGeneration,
  sampleHordeUser
} from './fixtures.js'

/**
 * Create a mock fetch function that responds based on URL patterns
 * @param {Object} options - Configuration options
 * @param {Object} options.responses - Custom responses keyed by URL pattern
 * @param {Function} options.defaultHandler - Handler for unmatched URLs
 */
export function createMockFetch(options = {}) {
  const {
    responses = {},
    defaultHandler = null
  } = options

  return vi.fn(async (url, fetchOptions = {}) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    const pathname = new URL(urlStr).pathname

    // Check for custom response handlers first
    for (const [pattern, handler] of Object.entries(responses)) {
      if (pathname.includes(pattern)) {
        if (typeof handler === 'function') {
          return handler(url, fetchOptions)
        }
        return handler
      }
    }

    // Default responses for common AI Horde endpoints
    const hordeEndpoints = {
      '/generate/async': {
        ok: true,
        status: 200,
        json: async () => sampleHordeResponse()
      },
      '/generate/check/': {
        ok: true,
        status: 200,
        json: async () => sampleHordeStatusResponse()
      },
      '/generate/status/': {
        ok: true,
        status: 200,
        json: async () => sampleHordeStatusResponse({
          done: true,
          generations: [sampleGeneration()]
        })
      },
      '/find_user': {
        ok: true,
        status: 200,
        json: async () => sampleHordeUser()
      },
      '/status/models': {
        ok: true,
        status: 200,
        json: async () => [
          { name: 'stable_diffusion', count: 10, queued: 5 },
          { name: 'SDXL 1.0', count: 5, queued: 3 }
        ]
      },
      '/workers/': {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'worker-1',
          name: 'Test Worker',
          online: true
        })
      },
      '/sharedkeys': {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'shared-key-1',
          name: 'Test Key',
          kudos: 500
        })
      }
    }

    for (const [endpoint, response] of Object.entries(hordeEndpoints)) {
      if (pathname.includes(endpoint)) {
        return response
      }
    }

    // Default handler or 404
    if (defaultHandler) {
      return defaultHandler(url, fetchOptions)
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not found' }),
      text: async () => 'Not found'
    }
  })
}

/**
 * Create a mock fetch that returns an image blob
 */
export function createImageFetchMock() {
  return vi.fn(async (url) => ({
    ok: true,
    status: 200,
    blob: async () => new Blob(['fake-image-data'], { type: 'image/png' })
  }))
}

/**
 * Create a mock fetch that fails with an error
 */
export function createFailingFetch(errorMessage = 'Network error', status = 500) {
  return vi.fn(async () => ({
    ok: false,
    status,
    json: async () => ({ message: errorMessage }),
    text: async () => errorMessage
  }))
}

/**
 * Create a sequence of mock fetch responses
 * @param {Array} responses - Array of response objects
 */
export function createSequentialFetch(responses) {
  let callIndex = 0
  return vi.fn(async (url, options) => {
    const response = responses[callIndex] || responses[responses.length - 1]
    callIndex++
    if (typeof response === 'function') {
      return response(url, options)
    }
    return response
  })
}

/**
 * Mock Image class with controllable loading behavior
 */
export class MockImage {
  constructor() {
    this._src = ''
    this.width = 512
    this.height = 512
    this.onload = null
    this.onerror = null
    this._shouldFail = false
  }

  set src(value) {
    this._src = value
    // Trigger load asynchronously
    setTimeout(() => {
      if (this._shouldFail && this.onerror) {
        this.onerror(new Error('Failed to load image'))
      } else if (this.onload) {
        this.onload()
      }
    }, 0)
  }

  get src() {
    return this._src
  }

  simulateError() {
    this._shouldFail = true
  }
}

/**
 * Create a mock canvas element
 */
export function createMockCanvas(options = {}) {
  const {
    width = 256,
    height = 256,
    shouldFail = false
  } = options

  const ctx = {
    drawImage: vi.fn()
  }

  return {
    width,
    height,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((callback, type, quality) => {
      if (shouldFail) {
        callback(null)
      } else {
        const blob = new Blob(['mock-canvas-output'], { type: type || 'image/webp' })
        callback(blob)
      }
    }),
    _context: ctx
  }
}

/**
 * Setup localStorage with initial data
 */
export function setupLocalStorage(data = {}) {
  localStorage.clear()
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
}

/**
 * Get parsed localStorage data
 */
export function getLocalStorageData(key) {
  const data = localStorage.getItem(key)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

/**
 * Wait for a specific number of milliseconds (for use with fake timers)
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Flush all pending promises
 */
export async function flushPromises() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Create a deferred promise for controlled async testing
 */
export function createDeferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

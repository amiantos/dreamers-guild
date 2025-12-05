/**
 * Tests for the AI Horde API wrapper (horde.js)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createMockFetch,
  createFailingFetch,
  setupLocalStorage
} from './helpers/mocks.js'
import {
  sampleHordeResponse,
  sampleHordeStatusResponse,
  sampleGeneration,
  sampleHordeUser,
  validRequestParams
} from './helpers/fixtures.js'

describe('Horde API', () => {
  let horde

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()

    // Setup default mock fetch
    global.fetch = createMockFetch()

    // Import fresh module
    horde = await import('../horde.js')
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  describe('API Key handling', () => {
    it('should use anonymous key when no API key is stored', async () => {
      await horde.submitGenerationRequest(validRequestParams())
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: '0000000000'
          })
        })
      )
    })

    it('should use stored API key from localStorage', async () => {
      setupLocalStorage({
        demoSettings: { horde_api_key: 'my-secret-key' }
      })

      await horde.submitGenerationRequest(validRequestParams())
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: 'my-secret-key'
          })
        })
      )
    })

    it('should include correct Client-Agent header', async () => {
      await horde.submitGenerationRequest(validRequestParams())
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Client-Agent': expect.stringContaining('dreamers-guild-demo')
          })
        })
      )
    })
  })

  describe('submitGenerationRequest', () => {
    it('should POST to /generate/async endpoint', async () => {
      const params = validRequestParams()
      await horde.submitGenerationRequest(params)
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://aihorde.net/api/v2/generate/async',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(params)
        })
      )
    })

    it('should return request ID on success', async () => {
      const mockResponse = sampleHordeResponse({ id: 'test-request-123' })
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => mockResponse
          }
        }
      })

      const result = await horde.submitGenerationRequest(validRequestParams())
      await vi.runAllTimersAsync()

      expect(result.id).toBe('test-request-123')
    })

    it('should throw error on API failure', async () => {
      global.fetch = createFailingFetch('Invalid API key', 401)

      await expect(
        horde.submitGenerationRequest(validRequestParams())
      ).rejects.toThrow('Invalid API key')
    })
  })

  describe('checkGenerationStatus', () => {
    it('should GET /generate/check/:id endpoint', async () => {
      await horde.checkGenerationStatus('test-request-123')
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://aihorde.net/api/v2/generate/check/test-request-123',
        expect.objectContaining({
          headers: expect.any(Object)
        })
      )
    })

    it('should return status object', async () => {
      const mockStatus = sampleHordeStatusResponse({
        queuePosition: 5,
        waitTime: 30,
        processing: 1
      })
      global.fetch = createMockFetch({
        responses: {
          '/generate/check/': {
            ok: true,
            json: async () => mockStatus
          }
        }
      })

      const result = await horde.checkGenerationStatus('test-request-123')
      await vi.runAllTimersAsync()

      expect(result.queue_position).toBe(5)
      expect(result.wait_time).toBe(30)
      expect(result.processing).toBe(1)
    })
  })

  describe('getGenerationResult', () => {
    it('should GET /generate/status/:id endpoint', async () => {
      await horde.getGenerationResult('test-request-123')
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://aihorde.net/api/v2/generate/status/test-request-123',
        expect.objectContaining({
          headers: expect.any(Object)
        })
      )
    })

    it('should return generations array', async () => {
      const mockResult = sampleHordeStatusResponse({
        done: true,
        generations: [
          sampleGeneration({ id: 'gen-1' }),
          sampleGeneration({ id: 'gen-2' })
        ]
      })
      global.fetch = createMockFetch({
        responses: {
          '/generate/status/': {
            ok: true,
            json: async () => mockResult
          }
        }
      })

      const result = await horde.getGenerationResult('test-request-123')
      await vi.runAllTimersAsync()

      expect(result.generations).toHaveLength(2)
      expect(result.generations[0].id).toBe('gen-1')
    })
  })

  describe('cancelGeneration', () => {
    it('should DELETE /generate/status/:id endpoint', async () => {
      await horde.cancelGeneration('test-request-123')
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://aihorde.net/api/v2/generate/status/test-request-123',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })
  })

  describe('getHordeUser', () => {
    it('should GET /find_user endpoint', async () => {
      await horde.getHordeUser()
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://aihorde.net/api/v2/find_user',
        expect.any(Object)
      )
    })

    it('should return user info', async () => {
      const mockUser = sampleHordeUser({ username: 'testuser', kudos: 5000 })
      global.fetch = createMockFetch({
        responses: {
          '/find_user': {
            ok: true,
            json: async () => mockUser
          }
        }
      })

      const result = await horde.getHordeUser()
      await vi.runAllTimersAsync()

      expect(result.username).toBe('testuser')
      expect(result.kudos).toBe(5000)
    })
  })

  describe('getHordeWorkers', () => {
    it('should fetch all user workers sequentially', async () => {
      // Use real timers for this test since it makes multiple sequential rate-limited calls
      vi.useRealTimers()

      const mockUser = sampleHordeUser({
        workerIds: ['worker-1', 'worker-2']
      })
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'worker-1', name: 'Worker One' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'worker-2', name: 'Worker Two' })
        })

      const result = await horde.getHordeWorkers()

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Worker One')
      expect(result[1].name).toBe('Worker Two')

      vi.useFakeTimers() // Restore for other tests
    }, 15000) // Increase timeout for rate-limited calls

    it('should return empty array if user has no workers', async () => {
      const mockUser = sampleHordeUser({ workerIds: [] })
      global.fetch = createMockFetch({
        responses: {
          '/find_user': {
            ok: true,
            json: async () => mockUser
          }
        }
      })

      const result = await horde.getHordeWorkers()
      await vi.runAllTimersAsync()

      expect(result).toEqual([])
    })

    it('should handle worker fetch errors gracefully', async () => {
      // Use real timers for this test since it makes multiple sequential rate-limited calls
      vi.useRealTimers()

      const mockUser = sampleHordeUser({
        workerIds: ['worker-1', 'worker-2']
      })
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Worker not found' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'worker-2', name: 'Worker Two' })
        })

      const result = await horde.getHordeWorkers()

      // Should still return the successful worker
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Worker Two')

      vi.useFakeTimers() // Restore for other tests
    }, 15000) // Increase timeout for rate-limited calls
  })

  describe('downloadImage', () => {
    it('should fetch image URL and return blob', async () => {
      const mockBlob = new Blob(['fake-image'], { type: 'image/png' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => mockBlob
      })

      const result = await horde.downloadImage('https://example.com/image.png')

      expect(result).toBeInstanceOf(Blob)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/image.png',
        expect.objectContaining({
          mode: 'cors',
          credentials: 'omit'
        })
      )
    })

    it('should throw on failed download', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      await expect(
        horde.downloadImage('https://example.com/missing.png')
      ).rejects.toThrow('Failed to download image: 404')
    })
  })

  describe('base64ToBlob', () => {
    it('should convert base64 to Blob', () => {
      // Simple base64 encoded string
      const base64 = btoa('test image data')
      const result = horde.base64ToBlob(base64)

      expect(result).toBeInstanceOf(Blob)
    })

    it('should use correct MIME type', () => {
      const base64 = btoa('test')
      const result = horde.base64ToBlob(base64, 'image/png')

      expect(result.type).toBe('image/png')
    })

    it('should default to image/webp MIME type', () => {
      const base64 = btoa('test')
      const result = horde.base64ToBlob(base64)

      expect(result.type).toBe('image/webp')
    })
  })

  describe('generateThumbnail', () => {
    it('should generate a thumbnail blob', async () => {
      const inputBlob = new Blob(['fake-image'], { type: 'image/png' })

      // Start the thumbnail generation and advance timers for MockImage.onload
      const resultPromise = horde.generateThumbnail(inputBlob)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/webp')
    })

    it('should use specified max size', async () => {
      const inputBlob = new Blob(['fake-image'], { type: 'image/png' })

      // Start the thumbnail generation and advance timers for MockImage.onload
      const resultPromise = horde.generateThumbnail(inputBlob, 128)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toBeInstanceOf(Blob)
    })
  })

  describe('estimateKudos', () => {
    it('should POST with dry_run: true', async () => {
      const params = validRequestParams()
      await horde.estimateKudos(params)
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://aihorde.net/api/v2/generate/async',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"dry_run":true')
        })
      )
    })
  })

  describe('validateSharedKey', () => {
    it('should validate shared key without authentication', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'shared-key-123',
          name: 'Test Key',
          kudos: 100,
          expiry: null
        })
      })

      const result = await horde.validateSharedKey('shared-key-123')
      await vi.runAllTimersAsync()

      expect(result.valid).toBe(true)
      expect(result.id).toBe('shared-key-123')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sharedkeys/shared-key-123'),
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: '0000000000' // Anonymous key
          })
        })
      )
    })

    it('should throw for invalid shared key', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      await expect(
        horde.validateSharedKey('invalid-key')
      ).rejects.toThrow('Shared key not found or invalid')
    })
  })
})

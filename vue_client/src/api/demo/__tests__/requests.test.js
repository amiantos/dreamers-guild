/**
 * Tests for the requests API (requests.js)
 * Tests request lifecycle, polling, and image processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as db from '../db.js'
import { setDelayFn, resetDelayFn, resetThrottleState } from '../rateLimiter.js'
import { clearDatabase } from './helpers/testDb.js'
import { createMockFetch, flushPromises } from './helpers/mocks.js'
import {
  sampleRequest,
  sampleImage,
  sampleImageBlob,
  sampleHordeResponse,
  sampleHordeStatusResponse,
  sampleGeneration,
  validRequestParams,
  invalidRequestParams,
  resetFixtureCounter
} from './helpers/fixtures.js'

describe('Requests API', () => {
  let requestsApi
  let resumePolling
  let setTimerFunctions
  let resetTimerFunctions
  let stopAllPolling

  // Mock timer state
  let intervalCallbacks = []
  let intervalIdCounter = 0

  // Mock setInterval that captures callbacks instead of using real timers
  const mockSetInterval = (callback, ms) => {
    const id = ++intervalIdCounter
    intervalCallbacks.push({ id, callback, ms })
    return id
  }

  // Mock clearInterval
  const mockClearInterval = (id) => {
    intervalCallbacks = intervalCallbacks.filter(item => item.id !== id)
  }

  // Helper to trigger all pending interval callbacks
  const triggerIntervals = async () => {
    for (const item of [...intervalCallbacks]) {
      await item.callback()
    }
    await flushPromises()
  }

  beforeEach(async () => {
    resetFixtureCounter()
    localStorage.clear()
    await clearDatabase()

    // Reset interval mocks
    intervalCallbacks = []
    intervalIdCounter = 0

    // Set up instant-resolving delay for rate limiter
    setDelayFn(() => Promise.resolve())
    resetThrottleState()

    // Reset and reimport module to clear state
    vi.resetModules()

    // Default mock fetch
    global.fetch = createMockFetch()

    // Import fresh module
    const module = await import('../requests.js')
    requestsApi = module.requestsApi
    resumePolling = module.resumePolling
    setTimerFunctions = module.setTimerFunctions
    resetTimerFunctions = module.resetTimerFunctions
    stopAllPolling = module.stopAllPolling

    // Inject mock timer functions
    setTimerFunctions(mockSetInterval, mockClearInterval)
  })

  afterEach(async () => {
    stopAllPolling()
    resetTimerFunctions()
    resetDelayFn()
    resetThrottleState()
    await clearDatabase()
  })

  describe('requestsApi.create', () => {
    it('should submit request to AI Horde', async () => {
      const params = validRequestParams()
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => sampleHordeResponse({ id: 'horde-123' })
          }
        }
      })

      await requestsApi.create({ params })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate/async'),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('should store request in IndexedDB', async () => {
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => sampleHordeResponse({ id: 'horde-123' })
          }
        }
      })

      const result = await requestsApi.create({ params: validRequestParams() })

      const stored = await db.get('requests', result.data.uuid)
      expect(stored).toBeDefined()
      expect(stored.horde_request_id).toBe('horde-123')
      expect(stored.status).toBe('submitting')
    })

    it('should create failed request record on submission error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API error'))

      const result = await requestsApi.create({ params: validRequestParams() })

      expect(result.data.status).toBe('failed')
      expect(result.data.message).toContain('API error')

      const stored = await db.get('requests', result.data.uuid)
      expect(stored.status).toBe('failed')
    })

    it('should extract prompt from params', async () => {
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => sampleHordeResponse()
          }
        }
      })

      const result = await requestsApi.create({
        params: validRequestParams({ prompt: 'beautiful sunset over ocean' })
      })

      expect(result.data.prompt).toBe('beautiful sunset over ocean')
    })

    it('should handle negative prompt separator', async () => {
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => sampleHordeResponse()
          }
        }
      })

      const result = await requestsApi.create({
        params: validRequestParams({ prompt: 'beautiful sunset###ugly, bad quality' })
      })

      expect(result.data.prompt).toBe('beautiful sunset')
    })
  })

  describe('requestsApi.getAll', () => {
    beforeEach(async () => {
      const now = Date.now()
      for (let i = 0; i < 5; i++) {
        await db.put('requests', sampleRequest({
          uuid: `req-${i}`,
          dateCreated: new Date(now - i * 1000).toISOString()
        }))
      }
    })

    it('should return all requests sorted by date', async () => {
      const result = await requestsApi.getAll()

      expect(result.data).toHaveLength(5)
      expect(result.data[0].uuid).toBe('req-0') // Most recent
    })

    it('should respect limit parameter', async () => {
      const result = await requestsApi.getAll(3)

      expect(result.data).toHaveLength(3)
    })
  })

  describe('requestsApi.getById', () => {
    it('should return single request', async () => {
      await db.put('requests', sampleRequest({ uuid: 'test-req' }))

      const result = await requestsApi.getById('test-req')

      expect(result.data.uuid).toBe('test-req')
    })

    it('should return undefined for missing request', async () => {
      const result = await requestsApi.getById('nonexistent')

      expect(result.data).toBeUndefined()
    })
  })

  describe('requestsApi.delete', () => {
    beforeEach(async () => {
      await db.put('requests', sampleRequest({
        uuid: 'req-to-delete',
        hordeRequestId: 'horde-123',
        status: 'processing'
      }))
      await db.put('images', sampleImage({ uuid: 'img-1', requestId: 'req-to-delete' }))
      await db.put('images', sampleImage({ uuid: 'img-2', requestId: 'req-to-delete', isFavorite: true }))
      await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-1' }))
      await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-2' }))
    })

    it('should remove request from IndexedDB', async () => {
      await requestsApi.delete('req-to-delete')

      const stored = await db.get('requests', 'req-to-delete')
      expect(stored).toBeUndefined()
    })

    it('should cancel on AI Horde for active requests', async () => {
      global.fetch = createMockFetch()

      await requestsApi.delete('req-to-delete')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate/status/horde-123'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should handle imageAction=prune', async () => {
      await requestsApi.delete('req-to-delete', 'prune')

      // Non-favorited image should be deleted
      expect(await db.get('images', 'img-1')).toBeUndefined()
      // Favorited image should remain
      expect(await db.get('images', 'img-2')).toBeDefined()
    })

    it('should handle imageAction=hide', async () => {
      await requestsApi.delete('req-to-delete', 'hide')

      const img1 = await db.get('images', 'img-1')
      const img2 = await db.get('images', 'img-2')
      expect(img1.is_hidden).toBe(1)
      expect(img2.is_hidden).toBe(1)
    })

    it('should handle imageAction=delete', async () => {
      await requestsApi.delete('req-to-delete', 'delete')

      expect(await db.get('images', 'img-1')).toBeUndefined()
      expect(await db.get('images', 'img-2')).toBeUndefined()
      expect(await db.get('imageBlobs', 'img-1')).toBeUndefined()
      expect(await db.get('imageBlobs', 'img-2')).toBeUndefined()
    })

    it('should handle imageAction=keep (no changes to images)', async () => {
      await requestsApi.delete('req-to-delete', 'keep')

      expect(await db.get('images', 'img-1')).toBeDefined()
      expect(await db.get('images', 'img-2')).toBeDefined()
    })
  })

  describe('requestsApi.deleteAll', () => {
    beforeEach(async () => {
      await db.put('requests', sampleRequest({ uuid: 'req-1', status: 'processing', hordeRequestId: 'h1' }))
      await db.put('requests', sampleRequest({ uuid: 'req-2', status: 'completed' }))
      await db.put('images', sampleImage({ uuid: 'img-1', requestId: 'req-1' }))
      await db.put('images', sampleImage({ uuid: 'img-2', requestId: 'req-2', isFavorite: true }))
    })

    it('should clear all requests', async () => {
      await requestsApi.deleteAll()

      const requests = await db.getAll('requests')
      expect(requests).toHaveLength(0)
    })

    it('should apply imageAction to all images', async () => {
      await requestsApi.deleteAll('delete')

      const images = await db.getAll('images')
      expect(images).toHaveLength(0)
    })

    it('should cancel active requests on Horde', async () => {
      global.fetch = createMockFetch()

      await requestsApi.deleteAll()

      // Should have called delete for the processing request
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate/status/h1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('requestsApi.retry', () => {
    beforeEach(async () => {
      await db.put('requests', sampleRequest({
        uuid: 'failed-req',
        status: 'failed',
        fullRequest: JSON.stringify(validRequestParams())
      }))
      await db.put('requests', sampleRequest({
        uuid: 'completed-req',
        status: 'completed'
      }))
    })

    it('should only retry failed requests', async () => {
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => sampleHordeResponse()
          }
        }
      })

      const result = await requestsApi.retry('failed-req')

      expect(result.data.status).toBe('submitting')
    })

    it('should throw for non-failed requests', async () => {
      await expect(
        requestsApi.retry('completed-req')
      ).rejects.toThrow('Only failed requests can be retried')
    })

    it('should delete old request record', async () => {
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => sampleHordeResponse()
          }
        }
      })

      await requestsApi.retry('failed-req')

      const oldRequest = await db.get('requests', 'failed-req')
      expect(oldRequest).toBeUndefined()
    })

    it('should throw for non-existent request', async () => {
      await expect(
        requestsApi.retry('nonexistent')
      ).rejects.toThrow('Request not found')
    })
  })

  describe('requestsApi.getQueueStatus', () => {
    it('should return queue status', async () => {
      await db.put('requests', sampleRequest({ uuid: 'req-1', status: 'pending', waiting: 5, processing: 0 }))
      await db.put('requests', sampleRequest({ uuid: 'req-2', status: 'processing', waiting: 0, processing: 1 }))
      await db.put('requests', sampleRequest({ uuid: 'req-3', status: 'completed' }))

      const result = await requestsApi.getQueueStatus()

      expect(result.data.pendingRequests).toBe(2)
      expect(result.data.waiting).toBe(5)
      expect(result.data.processing).toBe(1)
    })

    it('should return zeros when no active requests', async () => {
      const result = await requestsApi.getQueueStatus()

      expect(result.data.pendingRequests).toBe(0)
      expect(result.data.waiting).toBe(0)
      expect(result.data.processing).toBe(0)
    })
  })

  describe('Polling behavior', () => {
    it('should start polling after create', async () => {
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => sampleHordeResponse({ id: 'horde-poll-test' })
          }
        }
      })

      await requestsApi.create({ params: validRequestParams() })
      await flushPromises()

      // Verify polling was set up
      expect(intervalCallbacks.length).toBe(1)
      expect(intervalCallbacks[0].ms).toBe(3000)
    })

    it('should update request status from poll', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/generate/async')) {
          return {
            ok: true,
            json: async () => sampleHordeResponse({ id: 'horde-status-test' })
          }
        }
        if (url.includes('/generate/check')) {
          return {
            ok: true,
            json: async () => sampleHordeStatusResponse({
              queuePosition: 10,
              waitTime: 60,
              processing: 1
            })
          }
        }
        return { ok: true, json: async () => ({}) }
      })

      const result = await requestsApi.create({ params: validRequestParams() })
      await flushPromises()

      // Trigger the polling callback
      await triggerIntervals()

      const updated = await db.get('requests', result.data.uuid)
      expect(updated.queue_position).toBe(10)
      expect(updated.wait_time).toBe(60)
    })

    it('should stop polling when done', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/generate/async')) {
          return {
            ok: true,
            json: async () => sampleHordeResponse({ id: 'horde-done-test' })
          }
        }
        if (url.includes('/generate/check')) {
          return {
            ok: true,
            json: async () => sampleHordeStatusResponse({ done: true })
          }
        }
        if (url.includes('/generate/status')) {
          return {
            ok: true,
            json: async () => sampleHordeStatusResponse({
              done: true,
              generations: [sampleGeneration()]
            })
          }
        }
        return { ok: true, json: async () => ({}) }
      })

      await requestsApi.create({ params: validRequestParams() })
      await flushPromises()

      const initialCallbacks = intervalCallbacks.length

      // Trigger poll - should complete and stop
      await triggerIntervals()
      await flushPromises()

      // Polling should have been cleared
      expect(intervalCallbacks.length).toBeLessThan(initialCallbacks)
    })

    it('should handle poll errors gracefully', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/generate/async')) {
          return {
            ok: true,
            json: async () => sampleHordeResponse({ id: 'horde-error-test' })
          }
        }
        if (url.includes('/generate/check')) {
          throw new Error('Network error')
        }
        return { ok: true, json: async () => ({}) }
      })

      const result = await requestsApi.create({ params: validRequestParams() })
      await flushPromises()

      // Trigger the poll which will fail
      await triggerIntervals()

      // Request should be marked as failed
      const request = await db.get('requests', result.data.uuid)
      expect(request.status).toBe('failed')
      expect(request.message).toContain('Network error')
    })
  })

  describe('resumePolling', () => {
    it('should resume polling for pending requests on page load', async () => {
      await db.put('requests', sampleRequest({
        uuid: 'pending-req',
        hordeRequestId: 'horde-pending',
        status: 'pending'
      }))

      global.fetch = createMockFetch({
        responses: {
          '/generate/check/': {
            ok: true,
            json: async () => sampleHordeStatusResponse()
          }
        }
      })

      resumePolling()
      await flushPromises()

      // Should have set up polling
      expect(intervalCallbacks.length).toBe(1)
    })

    it('should resume polling for processing requests', async () => {
      await db.put('requests', sampleRequest({
        uuid: 'processing-req',
        hordeRequestId: 'horde-processing',
        status: 'processing'
      }))

      global.fetch = createMockFetch({
        responses: {
          '/generate/check/': {
            ok: true,
            json: async () => sampleHordeStatusResponse()
          }
        }
      })

      resumePolling()
      // Multiple flushes needed for chained async operations
      await flushPromises()
      await flushPromises()

      expect(intervalCallbacks.length).toBe(1)
    })

    it('should not resume for completed requests', async () => {
      await db.put('requests', sampleRequest({
        uuid: 'completed-req',
        hordeRequestId: 'horde-completed',
        status: 'completed'
      }))

      global.fetch = createMockFetch()

      resumePolling()
      await flushPromises()

      expect(intervalCallbacks.length).toBe(0)
    })

    it('should not resume for requests without horde_request_id', async () => {
      await db.put('requests', sampleRequest({
        uuid: 'no-horde-id',
        hordeRequestId: null,
        status: 'pending'
      }))

      global.fetch = createMockFetch()

      resumePolling()
      await flushPromises()

      expect(intervalCallbacks.length).toBe(0)
    })
  })

  describe('Guard against duplicate processing', () => {
    it('should prevent duplicate polling for same request', async () => {
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/generate/async')) {
          return {
            ok: true,
            json: async () => sampleHordeResponse({ id: 'horde-dup-test' })
          }
        }
        if (url.includes('/generate/check')) {
          return {
            ok: true,
            json: async () => sampleHordeStatusResponse({ done: false })
          }
        }
        return { ok: true, json: async () => ({}) }
      })

      await requestsApi.create({ params: validRequestParams() })
      await flushPromises()

      // Try to manually resume polling for same request (simulating race condition)
      resumePolling()
      await flushPromises()

      // Should still only have one polling interval (no duplicates)
      expect(intervalCallbacks.length).toBe(1)
    })
  })

  describe('Request validation', () => {
    it('should reject missing prompt', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('missing_prompt') })
      ).rejects.toThrow('prompt is required')
    })

    it('should reject empty prompt', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('empty_prompt') })
      ).rejects.toThrow('prompt is required')
    })

    it('should reject whitespace-only prompt', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('whitespace_prompt') })
      ).rejects.toThrow('prompt is required')
    })

    it('should reject missing models', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('missing_models') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should reject empty models array', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('empty_models') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should reject missing params.params', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('missing_params') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should reject zero width', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('zero_width') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should reject negative height', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('negative_height') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should reject zero steps', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('zero_steps') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should reject negative cfg_scale', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('negative_cfg_scale') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should reject empty sampler_name', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('empty_sampler') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should reject zero n', async () => {
      await expect(
        requestsApi.create({ params: invalidRequestParams('zero_n') })
      ).rejects.toThrow('Invalid request parameters')
    })

    it('should include validation details in error', async () => {
      try {
        await requestsApi.create({ params: invalidRequestParams('empty_models') })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error.name).toBe('ValidationError')
        expect(error.details).toContain('models must be a non-empty array')
      }
    })
  })

  describe('imageAction request_id behavior', () => {
    beforeEach(async () => {
      await db.put('requests', sampleRequest({
        uuid: 'req-action-test',
        hordeRequestId: 'horde-456',
        status: 'completed'
      }))
      // Non-favorited, non-hidden image
      await db.put('images', sampleImage({
        uuid: 'img-normal',
        requestId: 'req-action-test',
        isFavorite: false,
        isHidden: false
      }))
      // Favorited image
      await db.put('images', sampleImage({
        uuid: 'img-fav',
        requestId: 'req-action-test',
        isFavorite: true,
        isHidden: false
      }))
      // Hidden image
      await db.put('images', sampleImage({
        uuid: 'img-hidden',
        requestId: 'req-action-test',
        isFavorite: false,
        isHidden: true
      }))
      await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-normal' }))
      await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-fav' }))
      await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-hidden' }))
    })

    it('prune should null request_id for kept images', async () => {
      await requestsApi.delete('req-action-test', 'prune')

      // Normal image should be deleted
      expect(await db.get('images', 'img-normal')).toBeUndefined()

      // Favorited image should remain with null request_id
      const favImg = await db.get('images', 'img-fav')
      expect(favImg).toBeDefined()
      expect(favImg.request_id).toBeNull()

      // Hidden image should remain with null request_id
      const hiddenImg = await db.get('images', 'img-hidden')
      expect(hiddenImg).toBeDefined()
      expect(hiddenImg.request_id).toBeNull()
    })

    it('keep should null request_id for all images', async () => {
      await requestsApi.delete('req-action-test', 'keep')

      const normalImg = await db.get('images', 'img-normal')
      const favImg = await db.get('images', 'img-fav')
      const hiddenImg = await db.get('images', 'img-hidden')

      expect(normalImg.request_id).toBeNull()
      expect(favImg.request_id).toBeNull()
      expect(hiddenImg.request_id).toBeNull()
    })

    it('hide should set hidden and null request_id', async () => {
      await requestsApi.delete('req-action-test', 'hide')

      const normalImg = await db.get('images', 'img-normal')
      const favImg = await db.get('images', 'img-fav')

      expect(normalImg.is_hidden).toBe(1)
      expect(normalImg.request_id).toBeNull()
      expect(favImg.is_hidden).toBe(1)
      expect(favImg.request_id).toBeNull()
    })
  })

  describe('deleteAll imageAction request_id behavior', () => {
    beforeEach(async () => {
      await db.put('requests', sampleRequest({ uuid: 'req-1', status: 'completed' }))
      await db.put('requests', sampleRequest({ uuid: 'req-2', status: 'completed' }))
      await db.put('images', sampleImage({
        uuid: 'img-a',
        requestId: 'req-1',
        isFavorite: true
      }))
      await db.put('images', sampleImage({
        uuid: 'img-b',
        requestId: 'req-2',
        isFavorite: false
      }))
    })

    it('prune should null request_id for kept images', async () => {
      await requestsApi.deleteAll('prune')

      // Normal image should be deleted
      expect(await db.get('images', 'img-b')).toBeUndefined()

      // Favorited image should remain with null request_id
      const favImg = await db.get('images', 'img-a')
      expect(favImg).toBeDefined()
      expect(favImg.request_id).toBeNull()
    })

    it('keep should null request_id for all images', async () => {
      await requestsApi.deleteAll('keep')

      const imgA = await db.get('images', 'img-a')
      const imgB = await db.get('images', 'img-b')

      expect(imgA.request_id).toBeNull()
      expect(imgB.request_id).toBeNull()
    })

    it('hide should set hidden and null request_id', async () => {
      await requestsApi.deleteAll('hide')

      const imgA = await db.get('images', 'img-a')
      const imgB = await db.get('images', 'img-b')

      expect(imgA.is_hidden).toBe(1)
      expect(imgA.request_id).toBeNull()
      expect(imgB.is_hidden).toBe(1)
      expect(imgB.request_id).toBeNull()
    })
  })
})

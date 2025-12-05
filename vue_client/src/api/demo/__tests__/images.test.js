/**
 * Tests for the images API (images.js)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { imagesApi, resolveBlobUrl, revokeBlobUrl, revokeAllBlobUrls } from '../images.js'
import * as db from '../db.js'
import { clearDatabase } from './helpers/testDb.js'
import { createMockFetch } from './helpers/mocks.js'
import { sampleImage, sampleImageBlob, resetFixtureCounter } from './helpers/fixtures.js'

describe('Images API', () => {
  beforeEach(async () => {
    resetFixtureCounter()
    localStorage.clear()
    await clearDatabase()
    global.fetch = createMockFetch()

    // Seed some test images
    const now = Date.now()
    for (let i = 0; i < 10; i++) {
      await db.put('images', sampleImage({
        uuid: `img-${i}`,
        promptSimple: `test prompt ${i}`,
        model: i % 2 === 0 ? 'stable_diffusion' : 'sdxl',
        isFavorite: i < 3,
        isHidden: i >= 8,
        dateCreated: new Date(now - i * 1000).toISOString()
      }))
    }
  })

  afterEach(async () => {
    await clearDatabase()
    revokeAllBlobUrls()
  })

  describe('imagesApi.getAll', () => {
    it('should return images with pagination', async () => {
      const result = await imagesApi.getAll(5, 0)

      expect(result.data.data).toHaveLength(5)
      expect(result.data.total).toBe(8) // 10 total - 2 hidden
    })

    it('should filter by favorites', async () => {
      const result = await imagesApi.getAll(100, 0, { showFavoritesOnly: true })

      expect(result.data.data).toHaveLength(3)
      expect(result.data.data.every(img => img.is_favorite)).toBe(true)
    })

    it('should filter by hidden status (show only hidden)', async () => {
      const result = await imagesApi.getAll(100, 0, { showHidden: true })

      expect(result.data.data).toHaveLength(2)
      expect(result.data.data.every(img => img.is_hidden)).toBe(true)
    })

    it('should filter out hidden by default', async () => {
      const result = await imagesApi.getAll(100, 0, {})

      expect(result.data.data).toHaveLength(8)
      expect(result.data.data.every(img => !img.is_hidden)).toBe(true)
    })

    it('should apply filterCriteria for keyword', async () => {
      const result = await imagesApi.getAll(100, 0, {
        filterCriteria: [{ type: 'keyword', value: 'prompt 5' }]
      })

      expect(result.data.data).toHaveLength(1)
      expect(result.data.data[0].prompt_simple).toContain('5')
    })

    it('should apply filterCriteria for model', async () => {
      // Need images with model in full_request
      await db.clear('images')
      await db.put('images', sampleImage({
        uuid: 'img-model-1',
        fullRequest: JSON.stringify({ models: ['stable_diffusion'], prompt: 'test' })
      }))
      await db.put('images', sampleImage({
        uuid: 'img-model-2',
        fullRequest: JSON.stringify({ models: ['sdxl'], prompt: 'test' })
      }))

      const result = await imagesApi.getAll(100, 0, {
        filterCriteria: [{ type: 'model', value: 'stable_diffusion' }]
      })

      expect(result.data.data).toHaveLength(1)
      expect(result.data.data[0].uuid).toBe('img-model-1')
    })

    it('should return total count', async () => {
      const result = await imagesApi.getAll(3, 0)

      expect(result.data.total).toBe(8)
    })

    it('should sort by date descending (most recent first)', async () => {
      const result = await imagesApi.getAll(5, 0)

      // img-0 has the most recent date
      expect(result.data.data[0].uuid).toBe('img-0')
    })
  })

  describe('imagesApi.getByRequestId', () => {
    beforeEach(async () => {
      await db.clear('images')
      await db.put('images', sampleImage({ uuid: 'img-a', requestId: 'req-1' }))
      await db.put('images', sampleImage({ uuid: 'img-b', requestId: 'req-1' }))
      await db.put('images', sampleImage({ uuid: 'img-c', requestId: 'req-2' }))
    })

    it('should return images for request', async () => {
      const result = await imagesApi.getByRequestId('req-1')

      expect(result.data.data).toHaveLength(2)
      expect(result.data.data.every(img => img.request_id === 'req-1')).toBe(true)
    })

    it('should return total count', async () => {
      const result = await imagesApi.getByRequestId('req-1')

      expect(result.data.total).toBe(2)
    })

    it('should return empty for non-existent request', async () => {
      const result = await imagesApi.getByRequestId('req-nonexistent')

      expect(result.data.data).toHaveLength(0)
      expect(result.data.total).toBe(0)
    })
  })

  describe('imagesApi.search', () => {
    it('should search by keywords in prompt', async () => {
      const result = await imagesApi.search('prompt 3', 100, 0, {})

      expect(result.data.data).toHaveLength(1)
      expect(result.data.data[0].prompt_simple).toContain('3')
    })

    it('should search by model name', async () => {
      const result = await imagesApi.search('stable_diffusion', 100, 0, {})

      expect(result.data.data.length).toBeGreaterThan(0)
      expect(result.data.data.every(img => img.model === 'stable_diffusion')).toBe(true)
    })

    it('should combine filters with search', async () => {
      const result = await imagesApi.search('prompt', 100, 0, {
        showFavoritesOnly: true
      })

      expect(result.data.data).toHaveLength(3)
      expect(result.data.data.every(img => img.is_favorite)).toBe(true)
    })

    it('should return total count', async () => {
      const result = await imagesApi.search('prompt', 3, 0, {})

      expect(result.data.total).toBe(8)
    })

    it('should handle multiple search terms', async () => {
      const result = await imagesApi.search('test 5', 100, 0, {})

      expect(result.data.data).toHaveLength(1)
    })
  })

  describe('imagesApi.getById', () => {
    it('should return single image', async () => {
      const result = await imagesApi.getById('img-0')

      expect(result.data.uuid).toBe('img-0')
    })

    it('should return undefined for missing image', async () => {
      const result = await imagesApi.getById('nonexistent')

      expect(result.data).toBeUndefined()
    })
  })

  describe('imagesApi.update', () => {
    it('should update favorite status', async () => {
      const result = await imagesApi.update('img-5', { isFavorite: true })

      expect(result.data.is_favorite).toBe(1)

      const stored = await db.get('images', 'img-5')
      expect(stored.is_favorite).toBe(1)
    })

    it('should update hidden status', async () => {
      const result = await imagesApi.update('img-0', { isHidden: true })

      expect(result.data.is_hidden).toBe(1)
    })

    it('should normalize camelCase keys to snake_case', async () => {
      await imagesApi.update('img-0', { isFavorite: true, isHidden: false })

      const stored = await db.get('images', 'img-0')
      expect(stored.is_favorite).toBe(1)
      expect(stored.is_hidden).toBe(0)
    })

    it('should throw for non-existent image', async () => {
      await expect(
        imagesApi.update('nonexistent', { isFavorite: true })
      ).rejects.toThrow('Image not found')
    })
  })

  describe('imagesApi.delete', () => {
    beforeEach(async () => {
      await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-0' }))
    })

    it('should remove image record', async () => {
      await imagesApi.delete('img-0')

      const stored = await db.get('images', 'img-0')
      expect(stored).toBeUndefined()
    })

    it('should remove blob data', async () => {
      await imagesApi.delete('img-0')

      const blob = await db.get('imageBlobs', 'img-0')
      expect(blob).toBeUndefined()
    })
  })

  describe('imagesApi.batchUpdate', () => {
    it('should update multiple images', async () => {
      await imagesApi.batchUpdate(['img-3', 'img-4', 'img-5'], { isFavorite: true })

      for (const uuid of ['img-3', 'img-4', 'img-5']) {
        const img = await db.get('images', uuid)
        expect(img.is_favorite).toBe(1)
      }
    })

    it('should normalize camelCase keys', async () => {
      await imagesApi.batchUpdate(['img-0', 'img-1'], { isHidden: true })

      const img0 = await db.get('images', 'img-0')
      const img1 = await db.get('images', 'img-1')
      expect(img0.is_hidden).toBe(1)
      expect(img1.is_hidden).toBe(1)
    })

    it('should skip non-existent images', async () => {
      const result = await imagesApi.batchUpdate(['img-0', 'nonexistent'], { isFavorite: true })

      expect(result.success).toBe(true)
    })
  })

  describe('imagesApi.batchDelete', () => {
    beforeEach(async () => {
      for (let i = 0; i < 3; i++) {
        await db.put('imageBlobs', sampleImageBlob({ uuid: `img-${i}` }))
      }
    })

    it('should delete multiple images', async () => {
      await imagesApi.batchDelete(['img-0', 'img-1'])

      expect(await db.get('images', 'img-0')).toBeUndefined()
      expect(await db.get('images', 'img-1')).toBeUndefined()
      expect(await db.get('images', 'img-2')).toBeDefined()
    })

    it('should delete associated blobs', async () => {
      await imagesApi.batchDelete(['img-0', 'img-1'])

      expect(await db.get('imageBlobs', 'img-0')).toBeUndefined()
      expect(await db.get('imageBlobs', 'img-1')).toBeUndefined()
    })
  })

  describe('URL methods', () => {
    it('getThumbnailUrl should return demo-blob:// URL', () => {
      const url = imagesApi.getThumbnailUrl('img-123')

      expect(url).toBe('demo-blob://thumbnail/img-123')
    })

    it('getImageUrl should return demo-blob:// URL', () => {
      const url = imagesApi.getImageUrl('img-123')

      expect(url).toBe('demo-blob://image/img-123')
    })
  })

  describe('Blob URL management', () => {
    beforeEach(async () => {
      await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-blob-test' }))
    })

    describe('resolveBlobUrl', () => {
      it('should resolve demo-blob:// thumbnail URLs', async () => {
        const resolved = await resolveBlobUrl('demo-blob://thumbnail/img-blob-test')

        expect(resolved).toMatch(/^blob:/)
      })

      it('should resolve demo-blob:// image URLs', async () => {
        const resolved = await resolveBlobUrl('demo-blob://image/img-blob-test')

        expect(resolved).toMatch(/^blob:/)
      })

      it('should return same URL for non-demo-blob URLs', async () => {
        const url = 'https://example.com/image.png'
        const resolved = await resolveBlobUrl(url)

        expect(resolved).toBe(url)
      })

      it('should return null for missing blobs', async () => {
        const resolved = await resolveBlobUrl('demo-blob://thumbnail/nonexistent')

        expect(resolved).toBeNull()
      })

      it('should cache blob URLs', async () => {
        const url1 = await resolveBlobUrl('demo-blob://thumbnail/img-blob-test')
        const url2 = await resolveBlobUrl('demo-blob://thumbnail/img-blob-test')

        expect(url1).toBe(url2)
      })

      it('should return null for invalid URL format', async () => {
        const resolved = await resolveBlobUrl('demo-blob://invalid')

        expect(resolved).toBeNull()
      })

      it('should return url unchanged for null/undefined', async () => {
        expect(await resolveBlobUrl(null)).toBe(null)
        expect(await resolveBlobUrl(undefined)).toBe(undefined)
      })
    })

    describe('revokeBlobUrl', () => {
      it('should revoke cached URL', async () => {
        // First resolve to create cache entry
        await resolveBlobUrl('demo-blob://thumbnail/img-blob-test')

        // Then revoke
        revokeBlobUrl('thumbnail-img-blob-test')

        // URL.revokeObjectURL should have been called
        expect(URL.revokeObjectURL).toHaveBeenCalled()
      })
    })

    describe('revokeAllBlobUrls', () => {
      it('should revoke all cached URLs', async () => {
        // Create multiple cache entries
        await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-1' }))
        await db.put('imageBlobs', sampleImageBlob({ uuid: 'img-2' }))

        await resolveBlobUrl('demo-blob://thumbnail/img-1')
        await resolveBlobUrl('demo-blob://thumbnail/img-2')

        // Revoke all
        revokeAllBlobUrls()

        expect(URL.revokeObjectURL).toHaveBeenCalled()
      })
    })
  })

  describe('imagesApi.estimate', () => {
    it('should return kudos estimate', async () => {
      global.fetch = createMockFetch({
        responses: {
          '/generate/async': {
            ok: true,
            json: async () => ({ kudos: 25 })
          }
        }
      })

      const result = await imagesApi.estimate({ prompt: 'test', models: ['stable_diffusion'] })

      expect(result.data.kudos).toBe(25)
    }, 15000) // Increase timeout for rate-limited calls

    it('should return 0 kudos on error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API error'))

      const result = await imagesApi.estimate({ prompt: 'test' })

      expect(result.data.kudos).toBe(0)
    }, 15000)
  })
})

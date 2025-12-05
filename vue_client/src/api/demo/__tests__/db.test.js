/**
 * Tests for the IndexedDB wrapper (db.js)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as db from '../db.js'
import { clearDatabase, deleteDatabase } from './helpers/testDb.js'
import { sampleRequest, sampleImage, sampleImageBlob, resetFixtureCounter } from './helpers/fixtures.js'

describe('IndexedDB Wrapper', () => {
  beforeEach(async () => {
    resetFixtureCounter()
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  describe('openDatabase', () => {
    it('should open the database successfully', async () => {
      const database = await db.openDatabase()
      expect(database).toBeDefined()
      expect(database.name).toBe('dreamers-guild-demo')
    })

    it('should return the same instance on subsequent calls', async () => {
      const db1 = await db.openDatabase()
      const db2 = await db.openDatabase()
      expect(db1).toBe(db2)
    })

    it('should create all required object stores', async () => {
      const database = await db.openDatabase()
      expect(database.objectStoreNames.contains('requests')).toBe(true)
      expect(database.objectStoreNames.contains('images')).toBe(true)
      expect(database.objectStoreNames.contains('imageBlobs')).toBe(true)
    })
  })

  describe('CRUD Operations', () => {
    describe('put and get', () => {
      it('should store and retrieve a request', async () => {
        const request = sampleRequest({ uuid: 'test-request-1' })
        await db.put('requests', request)

        const retrieved = await db.get('requests', 'test-request-1')
        expect(retrieved).toEqual(request)
      })

      it('should store and retrieve an image', async () => {
        const image = sampleImage({ uuid: 'test-image-1' })
        await db.put('images', image)

        const retrieved = await db.get('images', 'test-image-1')
        expect(retrieved).toEqual(image)
      })

      it('should store and retrieve blob data', async () => {
        const blob = sampleImageBlob({ uuid: 'test-blob-1' })
        await db.put('imageBlobs', blob)

        const retrieved = await db.get('imageBlobs', 'test-blob-1')
        expect(retrieved.uuid).toBe('test-blob-1')
        // Note: fake-indexeddb doesn't preserve Blob instances perfectly,
        // so we check for the expected properties rather than instanceof
        expect(retrieved.fullImage).toBeDefined()
        expect(retrieved.thumbnail).toBeDefined()
        // In a real browser, these would be Blob instances
        // The important thing is the data was stored and retrieved
      })

      it('should update existing record with put', async () => {
        const request = sampleRequest({ uuid: 'test-request-1', status: 'pending' })
        await db.put('requests', request)

        const updated = { ...request, status: 'completed' }
        await db.put('requests', updated)

        const retrieved = await db.get('requests', 'test-request-1')
        expect(retrieved.status).toBe('completed')
      })

      it('should return undefined for non-existent key', async () => {
        const result = await db.get('requests', 'non-existent')
        expect(result).toBeUndefined()
      })
    })

    describe('add', () => {
      it('should add a new record', async () => {
        const request = sampleRequest({ uuid: 'test-request-1' })
        await db.add('requests', request)

        const retrieved = await db.get('requests', 'test-request-1')
        expect(retrieved).toEqual(request)
      })

      it('should reject when adding duplicate key', async () => {
        const request = sampleRequest({ uuid: 'test-request-1' })
        await db.add('requests', request)

        await expect(db.add('requests', request)).rejects.toThrow()
      })
    })

    describe('remove', () => {
      it('should remove a record', async () => {
        const request = sampleRequest({ uuid: 'test-request-1' })
        await db.put('requests', request)

        await db.remove('requests', 'test-request-1')

        const retrieved = await db.get('requests', 'test-request-1')
        expect(retrieved).toBeUndefined()
      })

      it('should not throw when removing non-existent key', async () => {
        await expect(db.remove('requests', 'non-existent')).resolves.not.toThrow()
      })
    })

    describe('clear', () => {
      it('should remove all records from a store', async () => {
        await db.put('requests', sampleRequest({ uuid: 'req-1' }))
        await db.put('requests', sampleRequest({ uuid: 'req-2' }))
        await db.put('requests', sampleRequest({ uuid: 'req-3' }))

        await db.clear('requests')

        const all = await db.getAll('requests')
        expect(all).toHaveLength(0)
      })
    })
  })

  describe('Query Operations', () => {
    describe('getAll', () => {
      it('should return all records from a store', async () => {
        await db.put('requests', sampleRequest({ uuid: 'req-1' }))
        await db.put('requests', sampleRequest({ uuid: 'req-2' }))
        await db.put('requests', sampleRequest({ uuid: 'req-3' }))

        const all = await db.getAll('requests')
        expect(all).toHaveLength(3)
      })

      it('should return empty array for empty store', async () => {
        const all = await db.getAll('requests')
        expect(all).toHaveLength(0)
      })

      it('should query by index', async () => {
        await db.put('requests', sampleRequest({ uuid: 'req-1', status: 'pending' }))
        await db.put('requests', sampleRequest({ uuid: 'req-2', status: 'completed' }))
        await db.put('requests', sampleRequest({ uuid: 'req-3', status: 'pending' }))

        const pending = await db.getAll('requests', 'status', 'pending')
        expect(pending).toHaveLength(2)
        expect(pending.every(r => r.status === 'pending')).toBe(true)
      })
    })

    describe('count', () => {
      it('should count all records in a store', async () => {
        await db.put('requests', sampleRequest({ uuid: 'req-1' }))
        await db.put('requests', sampleRequest({ uuid: 'req-2' }))

        const count = await db.count('requests')
        expect(count).toBe(2)
      })

      it('should count by index query', async () => {
        await db.put('requests', sampleRequest({ uuid: 'req-1', status: 'pending' }))
        await db.put('requests', sampleRequest({ uuid: 'req-2', status: 'completed' }))
        await db.put('requests', sampleRequest({ uuid: 'req-3', status: 'pending' }))

        const pendingCount = await db.count('requests', 'status', 'pending')
        expect(pendingCount).toBe(2)
      })

      it('should return 0 for empty store', async () => {
        const count = await db.count('requests')
        expect(count).toBe(0)
      })
    })
  })

  describe('getAllWithCursor', () => {
    beforeEach(async () => {
      // Create images with different dates
      const now = Date.now()
      for (let i = 0; i < 10; i++) {
        await db.put('images', sampleImage({
          uuid: `img-${i}`,
          date_created: new Date(now - i * 1000).toISOString(),
          is_favorite: i % 2 === 0,
          is_hidden: i >= 8
        }))
      }
    })

    it('should return records with limit', async () => {
      const results = await db.getAllWithCursor('images', { limit: 5 })
      expect(results).toHaveLength(5)
    })

    it('should skip records with offset', async () => {
      const results = await db.getAllWithCursor('images', { offset: 3, limit: 5 })
      expect(results).toHaveLength(5)
    })

    it('should apply filter function', async () => {
      const results = await db.getAllWithCursor('images', {
        filter: img => img.is_favorite === true
      })
      expect(results).toHaveLength(5)
      expect(results.every(img => img.is_favorite === true)).toBe(true)
    })

    it('should sort by direction (prev = descending)', async () => {
      const results = await db.getAllWithCursor('images', {
        indexName: 'date_created',
        direction: 'prev',
        limit: 3
      })
      expect(results).toHaveLength(3)
      // Most recent first (img-0 has the latest date)
      expect(results[0].uuid).toBe('img-0')
    })

    it('should sort by direction (next = ascending)', async () => {
      const results = await db.getAllWithCursor('images', {
        indexName: 'date_created',
        direction: 'next',
        limit: 3
      })
      expect(results).toHaveLength(3)
      // Oldest first (img-9 has the earliest date)
      expect(results[0].uuid).toBe('img-9')
    })

    it('should combine limit, offset, and filter', async () => {
      const results = await db.getAllWithCursor('images', {
        filter: img => img.is_favorite === true,
        offset: 1,
        limit: 2
      })
      expect(results).toHaveLength(2)
      expect(results.every(img => img.is_favorite === true)).toBe(true)
    })
  })

  describe('countWithFilter', () => {
    beforeEach(async () => {
      for (let i = 0; i < 10; i++) {
        await db.put('images', sampleImage({
          uuid: `img-${i}`,
          is_favorite: i % 2 === 0,
          is_hidden: i >= 8
        }))
      }
    })

    it('should count only matching records', async () => {
      const count = await db.countWithFilter('images', img => img.is_favorite === true)
      expect(count).toBe(5)
    })

    it('should return 0 for no matches', async () => {
      const count = await db.countWithFilter('images', img => img.uuid === 'non-existent')
      expect(count).toBe(0)
    })

    it('should count with complex filter', async () => {
      const count = await db.countWithFilter('images',
        img => img.is_favorite === true && img.is_hidden !== true
      )
      expect(count).toBe(4) // img-0, img-2, img-4, img-6 are favorites and not hidden
    })
  })

  describe('clearAllStores', () => {
    it('should clear all object stores', async () => {
      await db.put('requests', sampleRequest({ uuid: 'req-1' }))
      await db.put('images', sampleImage({ uuid: 'img-1' }))
      await db.put('imageBlobs', sampleImageBlob({ uuid: 'blob-1' }))

      await db.clearAllStores()

      expect(await db.count('requests')).toBe(0)
      expect(await db.count('images')).toBe(0)
      expect(await db.count('imageBlobs')).toBe(0)
    })
  })

  describe('getStorageEstimate', () => {
    it('should return storage estimate', async () => {
      const estimate = await db.getStorageEstimate()
      expect(estimate).toHaveProperty('usage')
      expect(estimate).toHaveProperty('quota')
      expect(estimate).toHaveProperty('usagePercent')
    })
  })
})

/**
 * Tests for the albums API (albums.js)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { albumsApi } from '../albums.js'
import * as db from '../db.js'
import { clearDatabase } from './helpers/testDb.js'
import { setupLocalStorage, getLocalStorageData } from './helpers/mocks.js'
import { sampleAlbum, sampleImage, resetFixtureCounter } from './helpers/fixtures.js'

describe('Albums API', () => {
  beforeEach(async () => {
    resetFixtureCounter()
    localStorage.clear()
    await clearDatabase()
  })

  afterEach(async () => {
    localStorage.clear()
    await clearDatabase()
  })

  describe('albumsApi.getAll', () => {
    it('should return empty array when no albums exist', async () => {
      const result = await albumsApi.getAll()

      expect(result.data).toEqual([])
    })

    it('should return all albums', async () => {
      setupLocalStorage({
        demo_albums: [
          sampleAlbum({ id: 1, title: 'Album 1' }),
          sampleAlbum({ id: 2, title: 'Album 2' })
        ]
      })

      const result = await albumsApi.getAll()

      expect(result.data).toHaveLength(2)
    })

    it('should filter hidden albums by default', async () => {
      setupLocalStorage({
        demo_albums: [
          sampleAlbum({ id: 1, title: 'Visible', is_hidden: 0 }),
          sampleAlbum({ id: 2, title: 'Hidden', is_hidden: 1 })
        ]
      })

      const result = await albumsApi.getAll()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toBe('Visible')
    })

    it('should include hidden albums when requested', async () => {
      setupLocalStorage({
        demo_albums: [
          sampleAlbum({ id: 1, title: 'Visible', is_hidden: 0 }),
          sampleAlbum({ id: 2, title: 'Hidden', is_hidden: 1 })
        ]
      })

      const result = await albumsApi.getAll({ includeHidden: true })

      expect(result.data).toHaveLength(2)
    })

    it('should sort by date created descending', async () => {
      const now = Date.now()
      setupLocalStorage({
        demo_albums: [
          sampleAlbum({ id: 1, title: 'Older', dateCreated: now - 1000 }),
          sampleAlbum({ id: 2, title: 'Newer', dateCreated: now })
        ]
      })

      const result = await albumsApi.getAll()

      expect(result.data[0].title).toBe('Newer')
      expect(result.data[1].title).toBe('Older')
    })

    it('should enrich albums with count and thumbnail', async () => {
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1, title: 'Test Album' })],
        demo_image_albums: [
          { album_id: 1, image_uuid: 'img-1', date_added: Date.now() },
          { album_id: 1, image_uuid: 'img-2', date_added: Date.now() - 1000 }
        ]
      })

      const result = await albumsApi.getAll()

      expect(result.data[0].count).toBe(2)
      expect(result.data[0].thumbnail).toBe('img-1') // Most recent
      expect(result.data[0].type).toBe('user')
    })
  })

  describe('albumsApi.create', () => {
    it('should create album with slug', async () => {
      const result = await albumsApi.create({ title: 'My New Album' })

      expect(result.data.title).toBe('My New Album')
      expect(result.data.slug).toMatch(/^my-new-album-[a-z0-9]+$/)
      expect(result.data.id).toBeDefined()
    })

    it('should store album in localStorage', async () => {
      await albumsApi.create({ title: 'Test Album' })

      const stored = getLocalStorageData('demo_albums')
      expect(stored).toHaveLength(1)
      expect(stored[0].title).toBe('Test Album')
    })

    it('should handle hidden albums', async () => {
      const result = await albumsApi.create({
        title: 'Hidden Album',
        isHidden: true
      })

      expect(result.data.is_hidden).toBe(1)
    })

    it('should set timestamps', async () => {
      const before = Date.now()
      const result = await albumsApi.create({ title: 'Timestamped Album' })
      const after = Date.now()

      expect(result.data.date_created).toBeGreaterThanOrEqual(before)
      expect(result.data.date_created).toBeLessThanOrEqual(after)
      expect(result.data.date_modified).toBe(result.data.date_created)
    })
  })

  describe('albumsApi.getBySlug', () => {
    it('should find album by slug', async () => {
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1, slug: 'my-album-abc1', title: 'My Album' })]
      })

      const result = await albumsApi.getBySlug('my-album-abc1')

      expect(result.data.title).toBe('My Album')
    })

    it('should reject for missing album', async () => {
      await expect(
        albumsApi.getBySlug('non-existent')
      ).rejects.toThrow('Album not found')
    })
  })

  describe('albumsApi.update', () => {
    beforeEach(() => {
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1, slug: 'test-album', title: 'Original' })]
      })
    })

    it('should update title', async () => {
      const result = await albumsApi.update(1, { title: 'Updated Title' })

      expect(result.data.title).toBe('Updated Title')
    })

    it('should update hidden status', async () => {
      const result = await albumsApi.update(1, { isHidden: true })

      expect(result.data.is_hidden).toBe(1)
    })

    it('should update cover image', async () => {
      const result = await albumsApi.update(1, { coverImageUuid: 'img-123' })

      expect(result.data.cover_image_uuid).toBe('img-123')
    })

    it('should preserve slug', async () => {
      const result = await albumsApi.update(1, { title: 'New Title' })

      expect(result.data.slug).toBe('test-album')
    })

    it('should update date_modified', async () => {
      const before = Date.now()
      const result = await albumsApi.update(1, { title: 'Updated' })
      const after = Date.now()

      expect(result.data.date_modified).toBeGreaterThanOrEqual(before)
      expect(result.data.date_modified).toBeLessThanOrEqual(after)
    })

    it('should reject for non-existent album', async () => {
      await expect(
        albumsApi.update(999, { title: 'Test' })
      ).rejects.toThrow('Album not found')
    })
  })

  describe('albumsApi.delete', () => {
    beforeEach(() => {
      setupLocalStorage({
        demo_albums: [
          sampleAlbum({ id: 1, title: 'Album 1' }),
          sampleAlbum({ id: 2, title: 'Album 2' })
        ],
        demo_image_albums: [
          { album_id: 1, image_uuid: 'img-1', date_added: Date.now() },
          { album_id: 1, image_uuid: 'img-2', date_added: Date.now() },
          { album_id: 2, image_uuid: 'img-3', date_added: Date.now() }
        ]
      })
    })

    it('should remove album', async () => {
      await albumsApi.delete(1)

      const stored = getLocalStorageData('demo_albums')
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe(2)
    })

    it('should remove image associations', async () => {
      await albumsApi.delete(1)

      const associations = getLocalStorageData('demo_image_albums')
      expect(associations).toHaveLength(1)
      expect(associations[0].album_id).toBe(2)
    })
  })

  describe('albumsApi.getImages', () => {
    beforeEach(async () => {
      // Setup albums
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1, title: 'Test Album' })],
        demo_image_albums: [
          { album_id: 1, image_uuid: 'img-1', date_added: Date.now() },
          { album_id: 1, image_uuid: 'img-2', date_added: Date.now() - 1000 },
          { album_id: 1, image_uuid: 'img-3', date_added: Date.now() - 2000 }
        ]
      })

      // Setup images in IndexedDB
      await db.put('images', sampleImage({ uuid: 'img-1', promptSimple: 'sunset' }))
      await db.put('images', sampleImage({ uuid: 'img-2', promptSimple: 'mountain', isFavorite: true }))
      await db.put('images', sampleImage({ uuid: 'img-3', promptSimple: 'ocean', isHidden: true }))
    })

    it('should return images in album', async () => {
      const result = await albumsApi.getImages(1)

      expect(result.data.images).toHaveLength(3)
      expect(result.data.total).toBe(3)
    })

    it('should paginate results', async () => {
      const result = await albumsApi.getImages(1, 2, 0)

      expect(result.data.images).toHaveLength(2)
      expect(result.data.limit).toBe(2)
      expect(result.data.offset).toBe(0)
    })

    it('should filter by favorites', async () => {
      const result = await albumsApi.getImages(1, 20, 0, { showFavorites: true })

      expect(result.data.images).toHaveLength(1)
      expect(result.data.images[0].uuid).toBe('img-2')
    })

    it('should filter by hidden only', async () => {
      const result = await albumsApi.getImages(1, 20, 0, { showHiddenOnly: true })

      expect(result.data.images).toHaveLength(1)
      expect(result.data.images[0].uuid).toBe('img-3')
    })

    it('should filter by keywords', async () => {
      const result = await albumsApi.getImages(1, 20, 0, { keywords: ['sunset'] })

      expect(result.data.images).toHaveLength(1)
      expect(result.data.images[0].uuid).toBe('img-1')
    })

    it('should sort by date added to album', async () => {
      const result = await albumsApi.getImages(1)

      // Most recently added first
      expect(result.data.images[0].uuid).toBe('img-1')
      expect(result.data.images[2].uuid).toBe('img-3')
    })
  })

  describe('albumsApi.addImages', () => {
    beforeEach(() => {
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1, title: 'Test Album' })],
        demo_image_albums: []
      })
    })

    it('should add images to album', async () => {
      const result = await albumsApi.addImages(1, ['img-1', 'img-2'])

      expect(result.success).toBe(true)
      expect(result.added).toBe(2)

      const associations = getLocalStorageData('demo_image_albums')
      expect(associations).toHaveLength(2)
    })

    it('should skip duplicates', async () => {
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1 })],
        demo_image_albums: [
          { album_id: 1, image_uuid: 'img-1', date_added: Date.now() }
        ]
      })

      const result = await albumsApi.addImages(1, ['img-1', 'img-2'])

      expect(result.added).toBe(1) // Only img-2 was added

      const associations = getLocalStorageData('demo_image_albums')
      expect(associations).toHaveLength(2)
    })

    it('should return count of added images', async () => {
      const result = await albumsApi.addImages(1, ['img-1', 'img-2', 'img-3'])

      expect(result.added).toBe(3)
      expect(result.albumId).toBe(1)
    })
  })

  describe('albumsApi.removeImage', () => {
    beforeEach(() => {
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1 })],
        demo_image_albums: [
          { album_id: 1, image_uuid: 'img-1', date_added: Date.now() },
          { album_id: 1, image_uuid: 'img-2', date_added: Date.now() }
        ]
      })
    })

    it('should remove single image from album', async () => {
      const result = await albumsApi.removeImage(1, 'img-1')

      expect(result.success).toBe(true)

      const associations = getLocalStorageData('demo_image_albums')
      expect(associations).toHaveLength(1)
      expect(associations[0].image_uuid).toBe('img-2')
    })
  })

  describe('albumsApi.removeImages', () => {
    beforeEach(() => {
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1 })],
        demo_image_albums: [
          { album_id: 1, image_uuid: 'img-1', date_added: Date.now() },
          { album_id: 1, image_uuid: 'img-2', date_added: Date.now() },
          { album_id: 1, image_uuid: 'img-3', date_added: Date.now() }
        ]
      })
    })

    it('should bulk remove images', async () => {
      const result = await albumsApi.removeImages(1, ['img-1', 'img-3'])

      expect(result.success).toBe(true)
      expect(result.removed).toBe(2)

      const associations = getLocalStorageData('demo_image_albums')
      expect(associations).toHaveLength(1)
      expect(associations[0].image_uuid).toBe('img-2')
    })

    it('should return count of removed images', async () => {
      const result = await albumsApi.removeImages(1, ['img-1', 'img-2'])

      expect(result.removed).toBe(2)
      expect(result.albumId).toBe(1)
    })
  })

  describe('albumsApi.getAlbumsForImage', () => {
    beforeEach(() => {
      setupLocalStorage({
        demo_albums: [
          sampleAlbum({ id: 1, title: 'Album 1', is_hidden: 0 }),
          sampleAlbum({ id: 2, title: 'Album 2', is_hidden: 0 }),
          sampleAlbum({ id: 3, title: 'Hidden Album', is_hidden: 1 })
        ],
        demo_image_albums: [
          { album_id: 1, image_uuid: 'img-1', date_added: Date.now() },
          { album_id: 2, image_uuid: 'img-1', date_added: Date.now() },
          { album_id: 3, image_uuid: 'img-1', date_added: Date.now() }
        ]
      })
    })

    it('should return albums containing image', async () => {
      const result = await albumsApi.getAlbumsForImage('img-1')

      expect(result.data).toHaveLength(2)
    })

    it('should filter hidden albums by default', async () => {
      const result = await albumsApi.getAlbumsForImage('img-1')

      expect(result.data.every(a => a.title !== 'Hidden Album')).toBe(true)
    })

    it('should include hidden when requested', async () => {
      const result = await albumsApi.getAlbumsForImage('img-1', { includeHidden: true })

      expect(result.data).toHaveLength(3)
    })

    it('should return empty array for image not in any album', async () => {
      const result = await albumsApi.getAlbumsForImage('img-not-in-album')

      expect(result.data).toEqual([])
    })
  })

  describe('albumsApi.clearAll', () => {
    it('should clear all album data', async () => {
      setupLocalStorage({
        demo_albums: [sampleAlbum({ id: 1 })],
        demo_image_albums: [{ album_id: 1, image_uuid: 'img-1', date_added: Date.now() }]
      })

      await albumsApi.clearAll()

      expect(localStorage.getItem('demo_albums')).toBeNull()
      expect(localStorage.getItem('demo_image_albums')).toBeNull()
    })
  })
})

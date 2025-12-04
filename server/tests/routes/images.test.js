import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, closeTestDatabase } from '../helpers/testDb.js';
import { sampleImage, sampleHordeRequest, sampleAlbum } from '../helpers/fixtures.js';

// Mock external dependencies before importing the route
vi.mock('../../db/database.js', () => ({
  default: {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(null),
      run: vi.fn().mockReturnValue({ changes: 0 })
    })
  },
  imagesDir: '/mock/images/dir'
}));

vi.mock('../../db/models.js', () => ({
  GeneratedImage: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByRequestId: vi.fn(),
    findByKeywords: vi.fn(),
    findByFilters: vi.fn(),
    countAll: vi.fn(),
    countByRequestId: vi.fn(),
    countByKeywords: vi.fn(),
    countByFilters: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  ImageAlbum: {
    findAlbumsForImage: vi.fn()
  }
}));

// Import after mocks are set up
import { GeneratedImage, ImageAlbum } from '../../db/models.js';

describe('Images Routes', () => {
  let app;
  let testDb;
  let testModels;

  beforeEach(async () => {
    // Create fresh in-memory database
    const { db, models } = createTestDatabase();
    testDb = db;
    testModels = models;

    // Reset all mocks
    vi.clearAllMocks();

    // Configure model mocks to use test database
    GeneratedImage.findAll.mockImplementation((limit, offset, filters) =>
      testModels.GeneratedImage.findAll(limit, offset, filters));
    GeneratedImage.findById.mockImplementation((id) =>
      testModels.GeneratedImage.findById(id));
    GeneratedImage.findByRequestId.mockImplementation((id, limit) =>
      testModels.GeneratedImage.findByRequestId(id, limit));
    GeneratedImage.findByKeywords.mockImplementation((keywords, limit, offset, filters) =>
      testModels.GeneratedImage.findByKeywords(keywords, limit, offset, filters));
    GeneratedImage.findByFilters.mockImplementation((criteria, limit, offset, filters) =>
      testModels.GeneratedImage.findByFilters(criteria, limit, offset, filters));
    GeneratedImage.countAll.mockImplementation((filters) =>
      testModels.GeneratedImage.countAll(filters));
    GeneratedImage.countByRequestId.mockImplementation((id) =>
      testModels.GeneratedImage.countByRequestId(id));
    GeneratedImage.countByKeywords.mockImplementation((keywords, filters) =>
      testModels.GeneratedImage.countByKeywords(keywords, filters));
    GeneratedImage.countByFilters.mockImplementation((criteria, filters) =>
      testModels.GeneratedImage.countByFilters(criteria, filters));
    GeneratedImage.update.mockImplementation((id, data) =>
      testModels.GeneratedImage.update(id, data));
    GeneratedImage.delete.mockImplementation((id) =>
      testModels.GeneratedImage.delete(id));

    ImageAlbum.findAlbumsForImage.mockImplementation((id, includeHidden) =>
      testModels.ImageAlbum.findAlbumsForImage(id, includeHidden));

    // Create Express app and import route dynamically
    app = express();
    app.use(express.json());

    const imagesRouter = (await import('../../routes/images.js')).default;
    app.use('/api/images', imagesRouter);
  });

  afterEach(() => {
    closeTestDatabase(testDb);
  });

  describe('GET /api/images', () => {
    it('should return empty array when no images exist', async () => {
      const response = await request(app).get('/api/images');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should return all non-hidden images by default', async () => {
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'visible' }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'hidden', isHidden: true }));

      const response = await request(app).get('/api/images');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].prompt_simple).toBe('visible');
    });

    it('should respect limit and offset parameters', async () => {
      for (let i = 0; i < 5; i++) {
        testModels.GeneratedImage.create(sampleImage({ promptSimple: `image ${i}` }));
      }

      const response = await request(app).get('/api/images?limit=2&offset=1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(5);
    });

    it('should filter by favorites', async () => {
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'favorite', isFavorite: true }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'normal' }));

      const response = await request(app).get('/api/images?favorites=true');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].prompt_simple).toBe('favorite');
    });

    it('should filter by showHiddenOnly', async () => {
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'visible' }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'hidden', isHidden: true }));

      const response = await request(app).get('/api/images?showHiddenOnly=true');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].prompt_simple).toBe('hidden');
    });

    it('should accept flexible filters JSON', async () => {
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'sunset photo' }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'portrait' }));

      const filters = JSON.stringify([{ type: 'keyword', value: 'sunset' }]);
      const response = await request(app).get(`/api/images?filters=${encodeURIComponent(filters)}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].prompt_simple).toBe('sunset photo');
    });

    it('should return 400 for invalid filters JSON', async () => {
      const response = await request(app).get('/api/images?filters=not-valid-json');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid filters JSON');
    });

    it('should filter by request_id', async () => {
      const requestId = 'test-request-123';
      testModels.GeneratedImage.create(sampleImage({ requestId, promptSimple: 'matching' }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'other' }));

      const filters = JSON.stringify([{ type: 'request_id', value: requestId }]);
      const response = await request(app).get(`/api/images?filters=${encodeURIComponent(filters)}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].prompt_simple).toBe('matching');
    });
  });

  describe('GET /api/images/request/:requestId', () => {
    it('should return images for specific request', async () => {
      const requestId = 'req-123';
      testModels.GeneratedImage.create(sampleImage({ requestId, promptSimple: 'image 1' }));
      testModels.GeneratedImage.create(sampleImage({ requestId, promptSimple: 'image 2' }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'other request' }));

      const response = await request(app).get(`/api/images/request/${requestId}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should return empty array for non-existent request', async () => {
      const response = await request(app).get('/api/images/request/non-existent');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const requestId = 'req-123';
      for (let i = 0; i < 5; i++) {
        testModels.GeneratedImage.create(sampleImage({ requestId }));
      }

      const response = await request(app).get(`/api/images/request/${requestId}?limit=3`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('GET /api/images/search', () => {
    it('should search by single keyword', async () => {
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'beautiful sunset' }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'mountain landscape' }));

      const response = await request(app).get('/api/images/search?q=sunset');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].prompt_simple).toContain('sunset');
    });

    it('should search by comma-separated keywords (AND logic)', async () => {
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'beautiful sunset beach' }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'beautiful mountain' }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'sunset only' }));

      const response = await request(app).get('/api/images/search?q=beautiful,sunset');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].prompt_simple).toBe('beautiful sunset beach');
    });

    it('should return empty results for no matches', async () => {
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'something else' }));

      const response = await request(app).get('/api/images/search?q=nonexistent');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should respect favorites filter in search', async () => {
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'sunset fav', isFavorite: true }));
      testModels.GeneratedImage.create(sampleImage({ promptSimple: 'sunset normal' }));

      const response = await request(app).get('/api/images/search?q=sunset&favorites=true');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].is_favorite).toBe(1);
    });
  });

  describe('GET /api/images/:id', () => {
    it('should return single image by UUID', async () => {
      const created = testModels.GeneratedImage.create(sampleImage({ promptSimple: 'find me' }));

      const response = await request(app).get(`/api/images/${created.uuid}`);

      expect(response.status).toBe(200);
      expect(response.body.uuid).toBe(created.uuid);
      expect(response.body.prompt_simple).toBe('find me');
    });

    it('should return 404 for non-existent UUID', async () => {
      const response = await request(app).get('/api/images/non-existent-uuid');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Image not found');
    });
  });

  describe('GET /api/images/:id/albums', () => {
    it('should return albums containing the image', async () => {
      const image = testModels.GeneratedImage.create(sampleImage());
      const album = testModels.Album.create(sampleAlbum({ title: 'Test Album' }));
      testModels.ImageAlbum.addImageToAlbum(image.uuid, album.id);

      const response = await request(app).get(`/api/images/${image.uuid}/albums`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Test Album');
    });

    it('should return empty array for image not in any album', async () => {
      const image = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app).get(`/api/images/${image.uuid}/albums`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should respect includeHidden parameter', async () => {
      const image = testModels.GeneratedImage.create(sampleImage());
      const visibleAlbum = testModels.Album.create(sampleAlbum({ title: 'Visible' }));
      const hiddenAlbum = testModels.Album.create(sampleAlbum({ title: 'Hidden', isHidden: true }));
      testModels.ImageAlbum.addImageToAlbum(image.uuid, visibleAlbum.id);
      testModels.ImageAlbum.addImageToAlbum(image.uuid, hiddenAlbum.id, false);

      // Without includeHidden
      let response = await request(app).get(`/api/images/${image.uuid}/albums`);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Visible');

      // With includeHidden
      response = await request(app).get(`/api/images/${image.uuid}/albums?includeHidden=true`);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('PATCH /api/images/:id', () => {
    it('should update isFavorite field', async () => {
      const created = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app)
        .patch(`/api/images/${created.uuid}`)
        .send({ isFavorite: true });

      expect(response.status).toBe(200);
      expect(response.body.is_favorite).toBe(1);
    });

    it('should update isHidden field', async () => {
      const created = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app)
        .patch(`/api/images/${created.uuid}`)
        .send({ isHidden: true });

      expect(response.status).toBe(200);
      expect(response.body.is_hidden).toBe(1);
    });

    it('should update multiple fields at once', async () => {
      const created = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app)
        .patch(`/api/images/${created.uuid}`)
        .send({ isFavorite: true, isHidden: true });

      expect(response.status).toBe(200);
      expect(response.body.is_favorite).toBe(1);
      expect(response.body.is_hidden).toBe(1);
    });
  });

  describe('PUT /api/images/batch', () => {
    it('should update multiple images at once', async () => {
      const img1 = testModels.GeneratedImage.create(sampleImage());
      const img2 = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app)
        .put('/api/images/batch')
        .send({
          imageIds: [img1.uuid, img2.uuid],
          updates: { isFavorite: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(2);
      expect(response.body.total).toBe(2);
    });

    it('should return 400 when imageIds is empty', async () => {
      const response = await request(app)
        .put('/api/images/batch')
        .send({ imageIds: [], updates: { isFavorite: true } });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('imageIds must be a non-empty array');
    });

    it('should return 400 when imageIds is not an array', async () => {
      const response = await request(app)
        .put('/api/images/batch')
        .send({ imageIds: 'not-array', updates: { isFavorite: true } });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('imageIds must be a non-empty array');
    });

    it('should return 400 when updates is missing', async () => {
      const response = await request(app)
        .put('/api/images/batch')
        .send({ imageIds: ['uuid-1'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('updates object is required');
    });
  });

  describe('DELETE /api/images/batch', () => {
    it('should delete multiple images', async () => {
      const img1 = testModels.GeneratedImage.create(sampleImage());
      const img2 = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app)
        .delete('/api/images/batch')
        .send({ imageIds: [img1.uuid, img2.uuid] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(2);
    });

    it('should return 400 when imageIds is empty', async () => {
      const response = await request(app)
        .delete('/api/images/batch')
        .send({ imageIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('imageIds must be a non-empty array');
    });

    it('should return 400 when imageIds is not an array', async () => {
      const response = await request(app)
        .delete('/api/images/batch')
        .send({ imageIds: 'not-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('imageIds must be a non-empty array');
    });
  });

  describe('DELETE /api/images/:id', () => {
    it('should delete single image', async () => {
      const created = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app).delete(`/api/images/${created.uuid}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      expect(testModels.GeneratedImage.findById(created.uuid)).toBeUndefined();
    });
  });
});

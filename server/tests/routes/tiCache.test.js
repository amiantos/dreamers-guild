import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, closeTestDatabase } from '../helpers/testDb.js';
import { sampleTiCache } from '../helpers/fixtures.js';

// Mock external dependencies
vi.mock('../../db/models.js', () => ({
  TiCache: {
    get: vi.fn(),
    getMultiple: vi.fn(),
    set: vi.fn(),
    cleanup: vi.fn()
  }
}));

import { TiCache } from '../../db/models.js';

describe('TI Cache Routes', () => {
  let app;
  let testDb;
  let testModels;

  beforeEach(async () => {
    const { db, models } = createTestDatabase();
    testDb = db;
    testModels = models;

    vi.clearAllMocks();

    // Configure mocks to use test database
    TiCache.get.mockImplementation((versionId) => testModels.TiCache.get(versionId));
    TiCache.getMultiple.mockImplementation((versionIds) => testModels.TiCache.getMultiple(versionIds));
    TiCache.set.mockImplementation((versionId, modelId, metadata) =>
      testModels.TiCache.set(versionId, modelId, metadata));
    TiCache.cleanup.mockImplementation((maxAgeMs) => testModels.TiCache.cleanup(maxAgeMs));

    app = express();
    app.use(express.json());

    const tiCacheRouter = (await import('../../routes/tiCache.js')).default;
    app.use('/api/ti-cache', tiCacheRouter);
  });

  afterEach(() => {
    closeTestDatabase(testDb);
  });

  describe('GET /api/ti-cache/:versionId', () => {
    it('should return cached TI metadata', async () => {
      const { versionId, modelId, metadata } = sampleTiCache();
      testModels.TiCache.set(versionId, modelId, metadata);

      const response = await request(app).get(`/api/ti-cache/${versionId}`);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test TI');
    });

    it('should return 404 when TI not cached', async () => {
      const response = await request(app).get('/api/ti-cache/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Textual Inversion not found in cache');
    });

    it('should update last_accessed timestamp on access', async () => {
      const { versionId, modelId, metadata } = sampleTiCache();
      testModels.TiCache.set(versionId, modelId, metadata);

      const beforeAccess = Date.now();
      await request(app).get(`/api/ti-cache/${versionId}`);

      const cached = testModels.TiCache.get(versionId);
      expect(cached.last_accessed).toBeGreaterThanOrEqual(beforeAccess);
    });
  });

  describe('POST /api/ti-cache/batch', () => {
    it('should return map of cached TIs', async () => {
      const ti1 = sampleTiCache({ versionId: '111', metadata: { name: 'TI 1' } });
      const ti2 = sampleTiCache({ versionId: '222', metadata: { name: 'TI 2' } });
      testModels.TiCache.set(ti1.versionId, ti1.modelId, ti1.metadata);
      testModels.TiCache.set(ti2.versionId, ti2.modelId, ti2.metadata);

      const response = await request(app)
        .post('/api/ti-cache/batch')
        .send({ versionIds: ['111', '222'] });

      expect(response.status).toBe(200);
      expect(response.body['111'].name).toBe('TI 1');
      expect(response.body['222'].name).toBe('TI 2');
    });

    it('should return empty map for uncached IDs', async () => {
      const response = await request(app)
        .post('/api/ti-cache/batch')
        .send({ versionIds: ['non-existent-1', 'non-existent-2'] });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });

    it('should return 400 when versionIds is not an array', async () => {
      const response = await request(app)
        .post('/api/ti-cache/batch')
        .send({ versionIds: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('versionIds must be an array');
    });

    it('should return partial results for mixed cached/uncached IDs', async () => {
      const ti = sampleTiCache({ versionId: '111' });
      testModels.TiCache.set(ti.versionId, ti.modelId, ti.metadata);

      const response = await request(app)
        .post('/api/ti-cache/batch')
        .send({ versionIds: ['111', 'non-existent'] });

      expect(response.status).toBe(200);
      expect(Object.keys(response.body)).toHaveLength(1);
      expect(response.body['111']).toBeDefined();
    });
  });

  describe('DELETE /api/ti-cache/cleanup', () => {
    it('should cleanup old cache entries', async () => {
      const ti = sampleTiCache();
      testModels.TiCache.set(ti.versionId, ti.modelId, ti.metadata);

      const response = await request(app).delete('/api/ti-cache/cleanup?maxAgeMs=1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.deleted).toBe('number');
    });

    it('should use default max age when not specified', async () => {
      const response = await request(app).delete('/api/ti-cache/cleanup');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

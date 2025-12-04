import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, closeTestDatabase } from '../helpers/testDb.js';
import { sampleLoraCache } from '../helpers/fixtures.js';

// Mock external dependencies
vi.mock('../../db/models.js', () => ({
  LoraCache: {
    get: vi.fn(),
    getMultiple: vi.fn(),
    set: vi.fn(),
    cleanup: vi.fn()
  }
}));

import { LoraCache } from '../../db/models.js';

describe('LoRA Cache Routes', () => {
  let app;
  let testDb;
  let testModels;

  beforeEach(async () => {
    const { db, models } = createTestDatabase();
    testDb = db;
    testModels = models;

    vi.clearAllMocks();

    // Configure mocks to use test database
    LoraCache.get.mockImplementation((versionId) => testModels.LoraCache.get(versionId));
    LoraCache.getMultiple.mockImplementation((versionIds) => testModels.LoraCache.getMultiple(versionIds));
    LoraCache.set.mockImplementation((versionId, modelId, metadata) =>
      testModels.LoraCache.set(versionId, modelId, metadata));
    LoraCache.cleanup.mockImplementation((maxAgeMs) => testModels.LoraCache.cleanup(maxAgeMs));

    app = express();
    app.use(express.json());

    const loraCacheRouter = (await import('../../routes/loraCache.js')).default;
    app.use('/api/lora-cache', loraCacheRouter);
  });

  afterEach(() => {
    closeTestDatabase(testDb);
  });

  describe('GET /api/lora-cache/:versionId', () => {
    it('should return cached LoRA metadata', async () => {
      const { versionId, modelId, metadata } = sampleLoraCache();
      testModels.LoraCache.set(versionId, modelId, metadata);

      const response = await request(app).get(`/api/lora-cache/${versionId}`);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test LoRA');
    });

    it('should return 404 when LoRA not cached', async () => {
      const response = await request(app).get('/api/lora-cache/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('LoRA not found in cache');
    });

    it('should update last_accessed timestamp on access', async () => {
      const { versionId, modelId, metadata } = sampleLoraCache();
      testModels.LoraCache.set(versionId, modelId, metadata);

      const beforeAccess = Date.now();
      await request(app).get(`/api/lora-cache/${versionId}`);

      // Access again and check timestamp was updated
      const cached = testModels.LoraCache.get(versionId);
      expect(cached.last_accessed).toBeGreaterThanOrEqual(beforeAccess);
    });
  });

  describe('POST /api/lora-cache/batch', () => {
    it('should return map of cached LoRAs', async () => {
      const lora1 = sampleLoraCache({ versionId: '111', metadata: { name: 'LoRA 1' } });
      const lora2 = sampleLoraCache({ versionId: '222', metadata: { name: 'LoRA 2' } });
      testModels.LoraCache.set(lora1.versionId, lora1.modelId, lora1.metadata);
      testModels.LoraCache.set(lora2.versionId, lora2.modelId, lora2.metadata);

      const response = await request(app)
        .post('/api/lora-cache/batch')
        .send({ versionIds: ['111', '222'] });

      expect(response.status).toBe(200);
      expect(response.body['111'].name).toBe('LoRA 1');
      expect(response.body['222'].name).toBe('LoRA 2');
    });

    it('should return empty map for uncached IDs', async () => {
      const response = await request(app)
        .post('/api/lora-cache/batch')
        .send({ versionIds: ['non-existent-1', 'non-existent-2'] });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });

    it('should return 400 when versionIds is not an array', async () => {
      const response = await request(app)
        .post('/api/lora-cache/batch')
        .send({ versionIds: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('versionIds must be an array');
    });

    it('should return partial results for mixed cached/uncached IDs', async () => {
      const lora = sampleLoraCache({ versionId: '111' });
      testModels.LoraCache.set(lora.versionId, lora.modelId, lora.metadata);

      const response = await request(app)
        .post('/api/lora-cache/batch')
        .send({ versionIds: ['111', 'non-existent'] });

      expect(response.status).toBe(200);
      expect(Object.keys(response.body)).toHaveLength(1);
      expect(response.body['111']).toBeDefined();
    });
  });

  describe('DELETE /api/lora-cache/cleanup', () => {
    it('should cleanup old cache entries', async () => {
      // Set a LoRA with old timestamp (simulate old cache)
      const lora = sampleLoraCache();
      testModels.LoraCache.set(lora.versionId, lora.modelId, lora.metadata);

      // Cleanup with very short max age (all entries should be deleted)
      const response = await request(app).delete('/api/lora-cache/cleanup?maxAgeMs=1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.deleted).toBe('number');
    });

    it('should use default max age when not specified', async () => {
      const response = await request(app).delete('/api/lora-cache/cleanup');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

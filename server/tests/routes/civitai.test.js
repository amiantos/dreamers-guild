import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { sampleCivitaiSearchResult } from '../helpers/fixtures.js';

// Mock the civitaiService before importing route
vi.mock('../../services/civitaiService.js', () => ({
  searchLoras: vi.fn(),
  getLoraById: vi.fn(),
  getLoraByVersionId: vi.fn(),
  searchTextualInversions: vi.fn(),
  getTiById: vi.fn(),
  getTiByVersionId: vi.fn()
}));

import {
  searchLoras,
  getLoraById,
  getLoraByVersionId,
  searchTextualInversions,
  getTiById,
  getTiByVersionId
} from '../../services/civitaiService.js';

describe('CivitAI Routes', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup default mock responses
    searchLoras.mockResolvedValue(sampleCivitaiSearchResult());
    getLoraById.mockResolvedValue({ id: 1, name: 'Test LoRA', type: 'LORA' });
    getLoraByVersionId.mockResolvedValue({ id: 1, name: 'Test LoRA', version: { id: 100 } });
    searchTextualInversions.mockResolvedValue(sampleCivitaiSearchResult());
    getTiById.mockResolvedValue({ id: 1, name: 'Test TI', type: 'TextualInversion' });
    getTiByVersionId.mockResolvedValue({ id: 1, name: 'Test TI', version: { id: 200 } });

    app = express();
    app.use(express.json());

    const civitaiRouter = (await import('../../routes/civitai.js')).default;
    app.use('/api/civitai', civitaiRouter);
  });

  describe('POST /api/civitai/search', () => {
    it('should search LoRAs with default params', async () => {
      const response = await request(app)
        .post('/api/civitai/search')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(searchLoras).toHaveBeenCalledWith({
        query: '',
        page: 1,
        limit: 100,
        baseModelFilters: [],
        nsfw: false,
        sort: 'Highest Rated',
        url: null
      });
    });

    it('should search LoRAs with custom params', async () => {
      const response = await request(app)
        .post('/api/civitai/search')
        .send({
          query: 'anime',
          page: 2,
          limit: 50,
          baseModelFilters: ['SD 1.5', 'SDXL'],
          nsfw: true,
          sort: 'Most Downloaded'
        });

      expect(response.status).toBe(200);
      expect(searchLoras).toHaveBeenCalledWith({
        query: 'anime',
        page: 2,
        limit: 50,
        baseModelFilters: ['SD 1.5', 'SDXL'],
        nsfw: true,
        sort: 'Most Downloaded',
        url: null
      });
    });

    it('should return 500 when service fails', async () => {
      searchLoras.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .post('/api/civitai/search')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to search LoRAs');
    });
  });

  describe('GET /api/civitai/models/:modelId', () => {
    it('should return LoRA model by ID', async () => {
      const response = await request(app).get('/api/civitai/models/123');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test LoRA');
      expect(getLoraById).toHaveBeenCalledWith('123');
    });

    it('should return 500 when service fails', async () => {
      getLoraById.mockRejectedValue(new Error('Not found'));

      const response = await request(app).get('/api/civitai/models/999');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch model');
    });
  });

  describe('GET /api/civitai/model-versions/:versionId', () => {
    it('should return LoRA by version ID', async () => {
      const response = await request(app).get('/api/civitai/model-versions/456');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test LoRA');
      expect(getLoraByVersionId).toHaveBeenCalledWith('456');
    });

    it('should return 500 when service fails', async () => {
      getLoraByVersionId.mockRejectedValue(new Error('Not found'));

      const response = await request(app).get('/api/civitai/model-versions/999');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch version');
    });
  });

  describe('POST /api/civitai/search-tis', () => {
    it('should search Textual Inversions with default params', async () => {
      const response = await request(app)
        .post('/api/civitai/search-tis')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(searchTextualInversions).toHaveBeenCalledWith({
        query: '',
        page: 1,
        limit: 100,
        baseModelFilters: [],
        nsfw: false,
        sort: 'Highest Rated',
        url: null
      });
    });

    it('should search TIs with custom params', async () => {
      const response = await request(app)
        .post('/api/civitai/search-tis')
        .send({
          query: 'style',
          page: 3,
          limit: 25
        });

      expect(response.status).toBe(200);
      expect(searchTextualInversions).toHaveBeenCalledWith(expect.objectContaining({
        query: 'style',
        page: 3,
        limit: 25
      }));
    });

    it('should return 500 when service fails', async () => {
      searchTextualInversions.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .post('/api/civitai/search-tis')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to search Textual Inversions');
    });
  });

  describe('GET /api/civitai/ti-models/:modelId', () => {
    it('should return TI model by ID', async () => {
      const response = await request(app).get('/api/civitai/ti-models/789');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test TI');
      expect(getTiById).toHaveBeenCalledWith('789');
    });

    it('should return 500 when service fails', async () => {
      getTiById.mockRejectedValue(new Error('Not found'));

      const response = await request(app).get('/api/civitai/ti-models/999');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch TI model');
    });
  });

  describe('GET /api/civitai/ti-versions/:versionId', () => {
    it('should return TI by version ID', async () => {
      const response = await request(app).get('/api/civitai/ti-versions/321');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test TI');
      expect(getTiByVersionId).toHaveBeenCalledWith('321');
    });

    it('should return 500 when service fails', async () => {
      getTiByVersionId.mockRejectedValue(new Error('Not found'));

      const response = await request(app).get('/api/civitai/ti-versions/999');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch TI version');
    });
  });
});

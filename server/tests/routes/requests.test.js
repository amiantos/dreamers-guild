import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, closeTestDatabase } from '../helpers/testDb.js';
import {
  validRequestParams,
  invalidRequestParams,
  sampleHordeRequest,
  sampleImage,
  samplePendingDownload,
  sampleHordeGenerateResponse
} from '../helpers/fixtures.js';

// Mock external dependencies before importing the route
vi.mock('../../services/queueManager.js', () => ({
  default: {
    addRequest: vi.fn(),
    cancelRequest: vi.fn().mockResolvedValue(true),
    getStatus: vi.fn().mockReturnValue({
      active: 0,
      maxActive: 5,
      pendingRequests: 0,
      pendingDownloads: 0,
      isProcessing: false
    })
  }
}));

vi.mock('../../services/hordeApi.js', () => ({
  default: {
    postImageAsyncGenerate: vi.fn().mockResolvedValue({ id: 'horde-123', kudos: 10 })
  }
}));

vi.mock('../../db/database.js', () => ({
  default: {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(null),
      run: vi.fn().mockReturnValue({ changes: 0 })
    })
  }
}));

vi.mock('../../db/models.js', () => ({
  HordeRequest: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  GeneratedImage: {
    findByRequestId: vi.fn().mockReturnValue([]),
    update: vi.fn(),
    delete: vi.fn()
  },
  HordePendingDownload: {
    findByRequestId: vi.fn().mockReturnValue([]),
    delete: vi.fn(),
    deleteByRequestId: vi.fn()
  }
}));

// Import after mocks are set up
import queueManager from '../../services/queueManager.js';
import hordeApi from '../../services/hordeApi.js';
import { HordeRequest, GeneratedImage, HordePendingDownload } from '../../db/models.js';

describe('Requests Routes', () => {
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
    HordeRequest.findAll.mockImplementation((limit) => testModels.HordeRequest.findAll(limit));
    HordeRequest.findById.mockImplementation((id) => testModels.HordeRequest.findById(id));
    HordeRequest.create.mockImplementation((data) => testModels.HordeRequest.create(data));
    HordeRequest.update.mockImplementation((id, data) => testModels.HordeRequest.update(id, data));
    HordeRequest.delete.mockImplementation((id) => testModels.HordeRequest.delete(id));

    GeneratedImage.findByRequestId.mockImplementation((id, limit) => testModels.GeneratedImage.findByRequestId(id, limit));
    GeneratedImage.update.mockImplementation((id, data) => testModels.GeneratedImage.update(id, data));
    GeneratedImage.delete.mockImplementation((id) => testModels.GeneratedImage.delete(id));

    HordePendingDownload.findByRequestId.mockImplementation((id) => testModels.HordePendingDownload.findByRequestId(id));
    HordePendingDownload.delete.mockImplementation((id) => testModels.HordePendingDownload.delete(id));
    HordePendingDownload.deleteByRequestId.mockImplementation((id) => testModels.HordePendingDownload.deleteByRequestId(id));

    // Configure queueManager mock
    queueManager.addRequest.mockImplementation((data) => {
      return testModels.HordeRequest.create({
        prompt: data.prompt,
        fullRequest: JSON.stringify(data.params),
        status: 'pending',
        albumId: data.albumId || null
      });
    });

    // Create Express app and import route dynamically
    app = express();
    app.use(express.json());

    // Import the route module (it uses the mocked dependencies)
    const requestsRouter = (await import('../../routes/requests.js')).default;
    app.use('/api/requests', requestsRouter);
  });

  afterEach(() => {
    closeTestDatabase(testDb);
  });

  describe('GET /api/requests', () => {
    it('should return empty array when no requests exist', async () => {
      const response = await request(app).get('/api/requests');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all requests', async () => {
      // Create test data
      testModels.HordeRequest.create(sampleHordeRequest({ prompt: 'test 1' }));
      testModels.HordeRequest.create(sampleHordeRequest({ prompt: 'test 2' }));

      const response = await request(app).get('/api/requests');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      // Create multiple requests
      for (let i = 0; i < 5; i++) {
        testModels.HordeRequest.create(sampleHordeRequest({ prompt: `test ${i}` }));
      }

      const response = await request(app).get('/api/requests?limit=3');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return requests sorted by date_created DESC', async () => {
      const now = Date.now();
      testModels.HordeRequest.create(sampleHordeRequest({ prompt: 'older', dateCreated: now - 1000 }));
      testModels.HordeRequest.create(sampleHordeRequest({ prompt: 'newer', dateCreated: now }));

      const response = await request(app).get('/api/requests');

      expect(response.status).toBe(200);
      expect(response.body[0].prompt).toBe('newer');
      expect(response.body[1].prompt).toBe('older');
    });
  });

  describe('GET /api/requests/:id', () => {
    it('should return single request by UUID', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest({ prompt: 'find me' }));

      const response = await request(app).get(`/api/requests/${created.uuid}`);

      expect(response.status).toBe(200);
      expect(response.body.uuid).toBe(created.uuid);
      expect(response.body.prompt).toBe('find me');
    });

    it('should return 404 for non-existent UUID', async () => {
      const response = await request(app).get('/api/requests/non-existent-uuid');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Request not found');
    });
  });

  describe('POST /api/requests', () => {
    it('should create request with valid params', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(validRequestParams());

      expect(response.status).toBe(201);
      expect(response.body.uuid).toBeDefined();
      expect(response.body.status).toBe('pending');
      expect(queueManager.addRequest).toHaveBeenCalled();
    });

    it('should create request with albumId', async () => {
      const album = testModels.Album.create({ title: 'Test Album' });

      const response = await request(app)
        .post('/api/requests')
        .send({ ...validRequestParams(), albumId: album.id });

      expect(response.status).toBe(201);
      expect(response.body.album_id).toBe(album.id);
    });

    it('should return 400 when prompt is missing', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.missingPrompt());

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 when params is missing', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.missingParams());

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 when models is empty', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.emptyModels());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('models must be a non-empty array');
    });

    it('should return 400 when models is not an array', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.modelsNotArray());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('models must be a non-empty array');
    });

    it('should return 400 when width is negative', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.negativeWidth());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('width must be a positive number');
    });

    it('should return 400 when width is missing', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.missingWidth());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('width must be a positive number');
    });

    it('should return 400 when height is missing', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.missingHeight());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('height must be a positive number');
    });

    it('should return 400 when steps is missing', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.missingSteps());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('steps must be a positive number');
    });

    it('should return 400 when cfg_scale is missing', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.missingCfgScale());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('cfg_scale must be a non-negative number');
    });

    it('should return 400 when sampler_name is missing', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.missingSamplerName());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('sampler_name is required');
    });

    it('should return 400 when sampler_name is empty', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.emptySamplerName());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('sampler_name is required');
    });

    it('should return 400 when n is invalid', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.invalidN());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('n must be a positive number');
    });

    it('should return 400 when nested params is missing', async () => {
      const response = await request(app)
        .post('/api/requests')
        .send(invalidRequestParams.missingNestedParams());

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('params.params is required');
    });
  });

  describe('DELETE /api/requests/:id', () => {
    it('should delete single request', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest());

      const response = await request(app).delete(`/api/requests/${created.uuid}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(queueManager.cancelRequest).toHaveBeenCalledWith(created.uuid);
    });

    it('should delete pending downloads for request', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest());
      testModels.HordePendingDownload.create(samplePendingDownload({ requestId: created.uuid }));

      await request(app).delete(`/api/requests/${created.uuid}`);

      expect(HordePendingDownload.deleteByRequestId).toHaveBeenCalledWith(created.uuid);
    });

    it('should handle imageAction=prune - keep favorites/hidden', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest());
      const favoriteImage = testModels.GeneratedImage.create(sampleImage({ requestId: created.uuid, isFavorite: true }));
      const normalImage = testModels.GeneratedImage.create(sampleImage({ requestId: created.uuid }));

      await request(app).delete(`/api/requests/${created.uuid}?imageAction=prune`);

      // Favorite should be kept with requestId removed
      expect(GeneratedImage.update).toHaveBeenCalledWith(favoriteImage.uuid, { requestId: null });
      // Normal image should be deleted
      expect(GeneratedImage.delete).toHaveBeenCalledWith(normalImage.uuid);
    });

    it('should handle imageAction=hide - mark all as hidden', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest());
      const image = testModels.GeneratedImage.create(sampleImage({ requestId: created.uuid }));

      await request(app).delete(`/api/requests/${created.uuid}?imageAction=hide`);

      expect(GeneratedImage.update).toHaveBeenCalledWith(image.uuid, { isHidden: true, requestId: null });
    });

    it('should handle imageAction=keep - remove request_id only', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest());
      const image = testModels.GeneratedImage.create(sampleImage({ requestId: created.uuid }));

      await request(app).delete(`/api/requests/${created.uuid}?imageAction=keep`);

      expect(GeneratedImage.update).toHaveBeenCalledWith(image.uuid, { requestId: null });
    });

    it('should delete all images by default', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest());
      const image = testModels.GeneratedImage.create(sampleImage({ requestId: created.uuid }));

      await request(app).delete(`/api/requests/${created.uuid}`);

      expect(GeneratedImage.delete).toHaveBeenCalledWith(image.uuid);
    });
  });

  describe('DELETE /api/requests', () => {
    it('should delete all requests', async () => {
      testModels.HordeRequest.create(sampleHordeRequest());
      testModels.HordeRequest.create(sampleHordeRequest());

      const response = await request(app).delete('/api/requests');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedCount).toBe(2);
    });

    it('should cancel all active requests on AI Horde', async () => {
      const req1 = testModels.HordeRequest.create(sampleHordeRequest());
      const req2 = testModels.HordeRequest.create(sampleHordeRequest());

      await request(app).delete('/api/requests');

      expect(queueManager.cancelRequest).toHaveBeenCalledWith(req1.uuid);
      expect(queueManager.cancelRequest).toHaveBeenCalledWith(req2.uuid);
    });
  });

  describe('GET /api/requests/queue/status', () => {
    it('should return queue status', async () => {
      queueManager.getStatus.mockReturnValue({
        active: 2,
        maxActive: 5,
        pendingRequests: 3,
        pendingDownloads: 1,
        isProcessing: true
      });

      const response = await request(app).get('/api/requests/queue/status');

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(2);
      expect(response.body.maxActive).toBe(5);
      expect(response.body.pendingRequests).toBe(3);
    });
  });

  describe('POST /api/requests/:id/retry', () => {
    it('should retry a failed request', async () => {
      const params = validRequestParams().params;
      const created = testModels.HordeRequest.create(sampleHordeRequest({
        status: 'failed',
        fullRequest: JSON.stringify(params)
      }));

      const response = await request(app).post(`/api/requests/${created.uuid}/retry`);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('pending');
      expect(queueManager.addRequest).toHaveBeenCalled();
    });

    it('should return 404 for non-existent request', async () => {
      const response = await request(app).post('/api/requests/non-existent/retry');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Request not found');
    });

    it('should return 400 when request is not failed', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest({ status: 'pending' }));

      const response = await request(app).post(`/api/requests/${created.uuid}/retry`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Only failed requests can be retried');
    });

    it('should return 400 when stored params are invalid', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest({
        status: 'failed',
        fullRequest: JSON.stringify({ models: [] }) // Invalid params
      }));

      const response = await request(app).post(`/api/requests/${created.uuid}/retry`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid stored params');
    });

    it('should return 500 when full_request JSON is invalid', async () => {
      const created = testModels.HordeRequest.create(sampleHordeRequest({
        status: 'failed',
        fullRequest: 'not valid json'
      }));

      const response = await request(app).post(`/api/requests/${created.uuid}/retry`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to parse original request data');
    });

    it('should preserve album_id from original request', async () => {
      const album = testModels.Album.create({ title: 'Test Album' });
      const params = validRequestParams().params;
      const created = testModels.HordeRequest.create(sampleHordeRequest({
        status: 'failed',
        fullRequest: JSON.stringify(params),
        albumId: album.id
      }));

      const response = await request(app).post(`/api/requests/${created.uuid}/retry`);

      expect(response.status).toBe(201);
      expect(queueManager.addRequest).toHaveBeenCalledWith(
        expect.objectContaining({ albumId: album.id })
      );
    });
  });

  describe('POST /api/requests/estimate', () => {
    it('should return kudos estimate for valid params', async () => {
      hordeApi.postImageAsyncGenerate.mockResolvedValue({ kudos: 15 });

      const response = await request(app)
        .post('/api/requests/estimate')
        .send({ params: validRequestParams().params });

      expect(response.status).toBe(200);
      expect(response.body.kudos).toBe(15);
      expect(hordeApi.postImageAsyncGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ dry_run: true })
      );
    });

    it('should return 400 when params is missing', async () => {
      const response = await request(app)
        .post('/api/requests/estimate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: params');
    });

    it('should forward API error message', async () => {
      hordeApi.postImageAsyncGenerate.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Invalid model specified', rc: 'InvalidModel' }
        }
      });

      const response = await request(app)
        .post('/api/requests/estimate')
        .send({ params: validRequestParams().params });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid model specified');
      expect(response.body.rc).toBe('InvalidModel');
    });

    it('should return 500 for generic errors', async () => {
      hordeApi.postImageAsyncGenerate.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/requests/estimate')
        .send({ params: validRequestParams().params });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to estimate kudos cost');
    });
  });
});

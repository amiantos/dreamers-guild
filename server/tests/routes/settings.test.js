import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, closeTestDatabase } from '../helpers/testDb.js';
import { sampleHordeUserInfo, sampleHordeWorker } from '../helpers/fixtures.js';

// Mock external dependencies
vi.mock('../../db/models.js', () => ({
  UserSettings: {
    get: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('../../services/hordeApi.js', () => ({
  default: {
    getUserInfo: vi.fn(),
    getUserWorkers: vi.fn(),
    updateWorker: vi.fn(),
    getSharedKeys: vi.fn(),
    createSharedKey: vi.fn(),
    updateSharedKey: vi.fn(),
    deleteSharedKey: vi.fn(),
    validateSharedKey: vi.fn(),
    getCurrentSharedKeyInfo: vi.fn()
  }
}));

import { UserSettings } from '../../db/models.js';
import hordeApi from '../../services/hordeApi.js';

describe('Settings Routes', () => {
  let app;
  let testDb;
  let testModels;

  beforeEach(async () => {
    const { db, models } = createTestDatabase();
    testDb = db;
    testModels = models;

    vi.clearAllMocks();

    // Initialize default settings first
    testModels.UserSettings.get();

    // Configure UserSettings mocks to use test database
    UserSettings.get.mockImplementation(() => testModels.UserSettings.get());
    UserSettings.update.mockImplementation((data) => testModels.UserSettings.update(data));

    // Setup default hordeApi mocks
    hordeApi.getUserInfo.mockResolvedValue(sampleHordeUserInfo());
    hordeApi.getUserWorkers.mockResolvedValue([sampleHordeWorker()]);
    hordeApi.updateWorker.mockResolvedValue({ success: true });
    hordeApi.getSharedKeys.mockResolvedValue([]);
    hordeApi.createSharedKey.mockResolvedValue({ id: 'sk-new', key: 'new-key' });
    hordeApi.updateSharedKey.mockResolvedValue({ success: true });
    hordeApi.deleteSharedKey.mockResolvedValue({ success: true });
    hordeApi.validateSharedKey.mockResolvedValue({ id: 'sk-123', name: 'Test Key', kudos: 100 });
    hordeApi.getCurrentSharedKeyInfo.mockResolvedValue(null);

    app = express();
    app.use(express.json());

    const settingsRouter = (await import('../../routes/settings.js')).default;
    app.use('/api/settings', settingsRouter);
  });

  afterEach(() => {
    closeTestDatabase(testDb);
  });

  describe('GET /api/settings', () => {
    it('should return sanitized settings', async () => {
      testModels.UserSettings.update({ apiKey: 'secret-key-123' });

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.api_key).toBe('***');
      expect(response.body.hasApiKey).toBe(true);
      expect(response.body.hidden_pin_hash).toBeUndefined();
    });

    it('should return hasApiKey=false when no API key set', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.api_key).toBeNull();
      expect(response.body.hasApiKey).toBe(false);
    });

    it('should include hasPinProtection flag', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.hasPinProtection).toBeDefined();
    });

    it('should create default settings if none exist', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  describe('PATCH /api/settings', () => {
    it('should update apiKey', async () => {
      const response = await request(app)
        .patch('/api/settings')
        .send({ apiKey: 'new-api-key' });

      expect(response.status).toBe(200);
      expect(response.body.hasApiKey).toBe(true);
      expect(response.body.api_key).toBe('***');
    });

    it('should update defaultParams', async () => {
      const response = await request(app)
        .patch('/api/settings')
        .send({ defaultParams: { steps: 30, width: 768 } });

      expect(response.status).toBe(200);
    });

    it('should update favoriteModels', async () => {
      const response = await request(app)
        .patch('/api/settings')
        .send({ favoriteModels: ['model1', 'model2'] });

      expect(response.status).toBe(200);
    });

    it('should update workerPreferences', async () => {
      const response = await request(app)
        .patch('/api/settings')
        .send({ workerPreferences: { nsfw: true, slowWorkers: false } });

      expect(response.status).toBe(200);
    });

    it('should not expose PIN hash in response', async () => {
      const response = await request(app)
        .patch('/api/settings')
        .send({ favoriteModels: ['test'] });

      expect(response.status).toBe(200);
      expect(response.body.hidden_pin_hash).toBeUndefined();
    });
  });

  describe('GET /api/settings/horde-user', () => {
    it('should return user info from AI Horde', async () => {
      const response = await request(app).get('/api/settings/horde-user');

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('TestUser');
      expect(response.body.kudos).toBeDefined();
    });

    it('should return 500 when API fails', async () => {
      hordeApi.getUserInfo.mockRejectedValue(new Error('API Error'));

      const response = await request(app).get('/api/settings/horde-user');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch user info');
    });
  });

  describe('GET /api/settings/horde-workers', () => {
    it('should return user workers', async () => {
      const response = await request(app).get('/api/settings/horde-workers');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle empty worker_ids', async () => {
      hordeApi.getUserInfo.mockResolvedValue({ ...sampleHordeUserInfo(), worker_ids: [] });

      const response = await request(app).get('/api/settings/horde-workers');

      expect(response.status).toBe(200);
    });

    it('should return 500 when API fails', async () => {
      hordeApi.getUserInfo.mockRejectedValue(new Error('API Error'));

      const response = await request(app).get('/api/settings/horde-workers');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch workers');
    });
  });

  describe('PUT /api/settings/horde-workers/:workerId', () => {
    it('should update worker settings', async () => {
      const response = await request(app)
        .put('/api/settings/horde-workers/worker-123')
        .send({ maintenance: true });

      expect(response.status).toBe(200);
      expect(hordeApi.updateWorker).toHaveBeenCalledWith('worker-123', { maintenance: true });
    });

    it('should return 500 when API fails', async () => {
      hordeApi.updateWorker.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .put('/api/settings/horde-workers/worker-123')
        .send({ maintenance: true });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/settings/horde-shared-keys', () => {
    it('should return shared keys', async () => {
      const response = await request(app).get('/api/settings/horde-shared-keys');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 500 when API fails', async () => {
      hordeApi.getUserInfo.mockRejectedValue(new Error('API Error'));

      const response = await request(app).get('/api/settings/horde-shared-keys');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/settings/horde-shared-keys', () => {
    it('should create new shared key', async () => {
      const response = await request(app)
        .post('/api/settings/horde-shared-keys')
        .send({ name: 'New Key', kudos: 50 });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('sk-new');
    });

    it('should return 500 when API fails', async () => {
      hordeApi.createSharedKey.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .post('/api/settings/horde-shared-keys')
        .send({ name: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /api/settings/horde-shared-keys/:keyId', () => {
    it('should update shared key', async () => {
      const response = await request(app)
        .patch('/api/settings/horde-shared-keys/sk-123')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(hordeApi.updateSharedKey).toHaveBeenCalledWith('sk-123', { name: 'Updated Name' });
    });
  });

  describe('DELETE /api/settings/horde-shared-keys/:keyId', () => {
    it('should delete shared key', async () => {
      const response = await request(app).delete('/api/settings/horde-shared-keys/sk-123');

      expect(response.status).toBe(200);
      expect(hordeApi.deleteSharedKey).toHaveBeenCalledWith('sk-123');
    });
  });

  describe('GET /api/settings/validate-shared-key/:keyId', () => {
    it('should validate shared key', async () => {
      const response = await request(app).get('/api/settings/validate-shared-key/sk-123');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.name).toBe('Test Key');
    });

    it('should return 404 for invalid key', async () => {
      hordeApi.validateSharedKey.mockRejectedValue(new Error('Not found'));

      const response = await request(app).get('/api/settings/validate-shared-key/invalid');

      expect(response.status).toBe(404);
      expect(response.body.valid).toBe(false);
    });
  });

  describe('GET /api/settings/current-shared-key-info', () => {
    it('should return null when not using shared key', async () => {
      const response = await request(app).get('/api/settings/current-shared-key-info');

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it('should return key info when using shared key', async () => {
      hordeApi.getCurrentSharedKeyInfo.mockResolvedValue({
        id: 'sk-123',
        username: 'owner',
        name: 'Shared Key',
        kudos: 100
      });

      const response = await request(app).get('/api/settings/current-shared-key-info');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('sk-123');
    });

    it('should return null on error', async () => {
      hordeApi.getCurrentSharedKeyInfo.mockRejectedValue(new Error('Error'));

      const response = await request(app).get('/api/settings/current-shared-key-info');

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe('POST /api/settings/hidden-pin/setup', () => {
    it('should setup 4-digit PIN', async () => {
      const response = await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ pin: '1234' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow declining PIN protection', async () => {
      const response = await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ declined: true });

      expect(response.status).toBe(200);
      expect(response.body.declined).toBe(true);
    });

    it('should return 400 when PIN already configured', async () => {
      // Setup PIN first
      await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ pin: '1234' });

      // Try to setup again
      const response = await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ pin: '5678' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('PIN already configured');
    });

    it('should return 400 for non-4-digit PIN', async () => {
      const response = await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ pin: '123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('PIN must be exactly 4 digits');
    });

    it('should return 400 for PIN with letters', async () => {
      const response = await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ pin: '12ab' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('PIN must be exactly 4 digits');
    });
  });

  describe('POST /api/settings/hidden-pin/verify', () => {
    beforeEach(async () => {
      // Setup a PIN first
      await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ pin: '1234' });
    });

    it('should return valid=true for correct PIN', async () => {
      const response = await request(app)
        .post('/api/settings/hidden-pin/verify')
        .send({ pin: '1234' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });

    it('should return valid=false for incorrect PIN', async () => {
      const response = await request(app)
        .post('/api/settings/hidden-pin/verify')
        .send({ pin: '0000' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should return 400 for invalid PIN format', async () => {
      const response = await request(app)
        .post('/api/settings/hidden-pin/verify')
        .send({ pin: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid PIN format');
    });
  });

  describe('POST /api/settings/hidden-pin/verify (no PIN configured)', () => {
    it('should return 400 when no PIN configured', async () => {
      const response = await request(app)
        .post('/api/settings/hidden-pin/verify')
        .send({ pin: '1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No PIN configured');
    });
  });

  describe('PATCH /api/settings/hidden-pin', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ pin: '1234' });
    });

    it('should change PIN when current PIN is correct', async () => {
      const response = await request(app)
        .patch('/api/settings/hidden-pin')
        .send({ currentPin: '1234', newPin: '5678' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify new PIN works
      const verify = await request(app)
        .post('/api/settings/hidden-pin/verify')
        .send({ pin: '5678' });
      expect(verify.body.valid).toBe(true);
    });

    it('should return 401 when current PIN is wrong', async () => {
      const response = await request(app)
        .patch('/api/settings/hidden-pin')
        .send({ currentPin: '0000', newPin: '5678' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Current PIN is incorrect');
    });

    it('should return 400 when new PIN is invalid format', async () => {
      const response = await request(app)
        .patch('/api/settings/hidden-pin')
        .send({ currentPin: '1234', newPin: '12' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('New PIN must be exactly 4 digits');
    });
  });

  describe('PATCH /api/settings/hidden-pin (no PIN configured)', () => {
    it('should return 400 when no PIN configured', async () => {
      const response = await request(app)
        .patch('/api/settings/hidden-pin')
        .send({ currentPin: '1234', newPin: '5678' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No PIN configured');
    });
  });

  describe('DELETE /api/settings/hidden-pin', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/settings/hidden-pin/setup')
        .send({ pin: '1234' });
    });

    it('should remove PIN protection with correct PIN', async () => {
      const response = await request(app)
        .delete('/api/settings/hidden-pin')
        .send({ pin: '1234' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify PIN is no longer configured
      const settings = await request(app).get('/api/settings');
      expect(settings.body.hasPinProtection).toBe(false);
    });

    it('should return 401 when PIN is wrong', async () => {
      const response = await request(app)
        .delete('/api/settings/hidden-pin')
        .send({ pin: '0000' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('PIN is incorrect');
    });
  });

  describe('DELETE /api/settings/hidden-pin (no PIN configured)', () => {
    it('should return 400 when no PIN configured', async () => {
      const response = await request(app)
        .delete('/api/settings/hidden-pin')
        .send({ pin: '1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No PIN configured');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, closeTestDatabase } from '../helpers/testDb.js';
import { sampleStylesData } from '../helpers/fixtures.js';

// Mock axios before importing route
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

// Mock UserSettings
vi.mock('../../db/models.js', () => ({
  UserSettings: {
    get: vi.fn()
  }
}));

import axios from 'axios';
import { UserSettings } from '../../db/models.js';

describe('Styles Routes', () => {
  let app;
  let testDb;
  let testModels;

  beforeEach(async () => {
    const { db, models } = createTestDatabase();
    testDb = db;
    testModels = models;

    vi.clearAllMocks();

    // Setup default mock responses
    const stylesData = sampleStylesData();
    axios.get.mockImplementation((url) => {
      if (url.includes('styles.json')) {
        return Promise.resolve({ data: stylesData });
      }
      if (url.includes('previews.json')) {
        return Promise.resolve({ data: { 'Anime': 'preview-url' } });
      }
      if (url.includes('categories.json')) {
        return Promise.resolve({ data: { 'Featured': ['Anime', 'Photorealistic'] } });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    // Mock UserSettings to use test database
    UserSettings.get.mockImplementation(() => testModels.UserSettings.get());

    app = express();
    app.use(express.json());

    // Clear module cache to reset the styles cache
    vi.resetModules();

    const stylesRouter = (await import('../../routes/styles.js')).default;
    app.use('/api/styles', stylesRouter);
  });

  afterEach(() => {
    closeTestDatabase(testDb);
  });

  describe('GET /api/styles', () => {
    it('should return styles with categories', async () => {
      const response = await request(app).get('/api/styles');

      expect(response.status).toBe(200);
      expect(response.body.allStyles).toBeDefined();
      expect(response.body.stylesMap).toBeDefined();
      expect(response.body.categorizedStyles).toBeDefined();
      expect(Array.isArray(response.body.allStyles)).toBe(true);
    });

    it('should include user favorites in response', async () => {
      // Set up user with favorite styles
      testModels.UserSettings.update({ favoriteStyles: ['Anime'] });

      const response = await request(app).get('/api/styles');

      expect(response.status).toBe(200);
      // Favorites category should be first if user has favorites
      const favoritesCategory = response.body.categorizedStyles.find(c => c.name === 'Favorites');
      if (favoritesCategory) {
        expect(favoritesCategory.styles.length).toBeGreaterThan(0);
      }
    });

    it('should sort styles alphabetically in allStyles', async () => {
      const response = await request(app).get('/api/styles');

      expect(response.status).toBe(200);
      const names = response.body.allStyles.map(s => s.name);
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sortedNames);
    });

    it('should return cached data on subsequent calls', async () => {
      // First call
      await request(app).get('/api/styles');
      expect(axios.get).toHaveBeenCalled();

      const callCount = axios.get.mock.calls.length;

      // Second call should use cache
      await request(app).get('/api/styles');

      // axios.get should not be called again
      expect(axios.get.mock.calls.length).toBe(callCount);
    });

    it('should return 500 when GitHub fetch fails', async () => {
      // Need to reset module to clear cache
      vi.resetModules();

      axios.get.mockRejectedValue(new Error('Network error'));

      const freshApp = express();
      freshApp.use(express.json());
      const freshRouter = (await import('../../routes/styles.js')).default;
      freshApp.use('/api/styles', freshRouter);

      const response = await request(freshApp).get('/api/styles');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch styles');
    });
  });

  describe('GET /api/styles/:name', () => {
    it('should return specific style by name', async () => {
      const response = await request(app).get('/api/styles/Anime');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Anime');
      expect(response.body.prompt).toBeDefined();
    });

    it('should return 404 for non-existent style', async () => {
      const response = await request(app).get('/api/styles/NonExistentStyle');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Style not found');
    });
  });

  describe('POST /api/styles/refresh', () => {
    it('should clear cache and refetch styles', async () => {
      // First call to populate cache
      await request(app).get('/api/styles');
      const initialCallCount = axios.get.mock.calls.length;

      // Refresh cache
      const response = await request(app).post('/api/styles/refresh');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);

      // axios.get should have been called again
      expect(axios.get.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('should return 500 when refresh fails', async () => {
      // First populate cache
      await request(app).get('/api/styles');

      // Make axios fail for refresh
      axios.get.mockRejectedValue(new Error('Network error'));

      const response = await request(app).post('/api/styles/refresh');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to refresh styles cache');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for the real HordeAPI rate limiter implementation
 *
 * We mock axios to prevent actual API calls, but test the real
 * rate limiting logic in hordeApi.js
 */

// Mock axios before importing hordeApi
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        post: vi.fn().mockResolvedValue({ data: { id: 'test-id' } }),
        get: vi.fn().mockResolvedValue({ data: { done: false } }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        patch: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
      })),
      get: vi.fn().mockResolvedValue({ data: Buffer.from('fake-image') }),
    },
  };
});

// Mock the database models to avoid database dependency
vi.mock('../db/models.js', () => ({
  UserSettings: {
    get: vi.fn(() => ({ api_key: 'test-api-key' })),
  },
}));

// Now import the real hordeApi
import hordeApi from '../services/hordeApi.js';

describe('HordeAPI Rate Limiter (Real Implementation)', () => {
  beforeEach(() => {
    // Reset the rate limiter state before each test
    hordeApi.backgroundLastApiCallTime = 0;
    hordeApi.uiLastApiCallTime = 0;
    hordeApi.backgroundThrottleQueue = Promise.resolve();
    hordeApi.uiThrottleQueue = Promise.resolve();
    // Use shorter interval for faster tests
    hordeApi.minApiInterval = 100;
  });

  afterEach(() => {
    // Restore default interval
    hordeApi.minApiInterval = 1000;
  });

  describe('throttleBackground', () => {
    it('should update backgroundLastApiCallTime but not uiLastApiCallTime', async () => {
      const initialUITime = hordeApi.uiLastApiCallTime;

      await hordeApi.throttleBackground();

      expect(hordeApi.backgroundLastApiCallTime).toBeGreaterThan(0);
      expect(hordeApi.uiLastApiCallTime).toBe(initialUITime);
    });

    it('should enforce minimum interval between background calls', async () => {
      const start = Date.now();

      await hordeApi.throttleBackground();
      await hordeApi.throttleBackground();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(hordeApi.minApiInterval - 15);
    });

    it('should serialize concurrent background calls', async () => {
      const callOrder = [];

      const call1 = hordeApi.throttleBackground().then(() => callOrder.push(1));
      const call2 = hordeApi.throttleBackground().then(() => callOrder.push(2));
      const call3 = hordeApi.throttleBackground().then(() => callOrder.push(3));

      await Promise.all([call1, call2, call3]);

      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('throttleUI', () => {
    it('should update both backgroundLastApiCallTime and uiLastApiCallTime', async () => {
      await hordeApi.throttleUI();

      expect(hordeApi.backgroundLastApiCallTime).toBeGreaterThan(0);
      expect(hordeApi.uiLastApiCallTime).toBeGreaterThan(0);
      expect(hordeApi.backgroundLastApiCallTime).toBe(hordeApi.uiLastApiCallTime);
    });

    it('should enforce minimum interval between UI calls', async () => {
      const start = Date.now();

      await hordeApi.throttleUI();
      await hordeApi.throttleUI();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(hordeApi.minApiInterval - 15);
    });
  });

  describe('UI Priority', () => {
    it('should allow UI call immediately after background call (separate queues)', async () => {
      await hordeApi.throttleBackground();

      const uiStart = Date.now();
      await hordeApi.throttleUI();
      const uiDuration = Date.now() - uiStart;

      // UI should complete quickly since it has its own queue
      expect(uiDuration).toBeLessThan(hordeApi.minApiInterval);
    });

    it('should make background wait after UI call (UI updates both timestamps)', async () => {
      await hordeApi.throttleUI();

      const bgStart = Date.now();
      await hordeApi.throttleBackground();
      const bgDuration = Date.now() - bgStart;

      // Background should have waited because UI updated backgroundLastApiCallTime
      expect(bgDuration).toBeGreaterThanOrEqual(hordeApi.minApiInterval - 20);
    });
  });

  describe('API Methods Use Correct Throttle', () => {
    it('postImageAsyncGenerate should use background throttle', async () => {
      const bgTimeBefore = hordeApi.backgroundLastApiCallTime;
      const uiTimeBefore = hordeApi.uiLastApiCallTime;

      await hordeApi.postImageAsyncGenerate({ prompt: 'test' });

      expect(hordeApi.backgroundLastApiCallTime).toBeGreaterThan(bgTimeBefore);
      expect(hordeApi.uiLastApiCallTime).toBe(uiTimeBefore);
    });

    it('getImageAsyncCheck should use background throttle', async () => {
      const bgTimeBefore = hordeApi.backgroundLastApiCallTime;
      const uiTimeBefore = hordeApi.uiLastApiCallTime;

      await hordeApi.getImageAsyncCheck('test-id');

      expect(hordeApi.backgroundLastApiCallTime).toBeGreaterThan(bgTimeBefore);
      expect(hordeApi.uiLastApiCallTime).toBe(uiTimeBefore);
    });

    it('getUserInfo should use UI throttle (updates both timestamps)', async () => {
      await hordeApi.getUserInfo();

      expect(hordeApi.backgroundLastApiCallTime).toBeGreaterThan(0);
      expect(hordeApi.uiLastApiCallTime).toBeGreaterThan(0);
      expect(hordeApi.backgroundLastApiCallTime).toBe(hordeApi.uiLastApiCallTime);
    });

    it('cancelRequest should use background throttle', async () => {
      const bgTimeBefore = hordeApi.backgroundLastApiCallTime;
      const uiTimeBefore = hordeApi.uiLastApiCallTime;

      await hordeApi.cancelRequest('test-id');

      expect(hordeApi.backgroundLastApiCallTime).toBeGreaterThan(bgTimeBefore);
      expect(hordeApi.uiLastApiCallTime).toBe(uiTimeBefore);
    });
  });
});

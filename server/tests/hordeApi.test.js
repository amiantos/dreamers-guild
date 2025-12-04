import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for the dual rate limiter implementation in HordeAPI
 *
 * These tests verify:
 * 1. Background and UI operations have separate throttle queues
 * 2. UI operations update both timestamps (UI priority)
 * 3. Background operations only update background timestamp
 * 4. Rate limiting enforces minimum interval between calls
 */

// Create a minimal HordeAPI class for testing (isolated from real implementation)
class MockHordeAPI {
  constructor() {
    this.backgroundLastApiCallTime = 0;
    this.backgroundThrottleQueue = Promise.resolve();
    this.uiLastApiCallTime = 0;
    this.uiThrottleQueue = Promise.resolve();
    this.minApiInterval = 100; // Use 100ms for faster tests
  }

  async throttleBackground() {
    const waitPromise = this.backgroundThrottleQueue.then(async () => {
      const now = Date.now();
      const timeSinceLastCall = now - this.backgroundLastApiCallTime;
      if (timeSinceLastCall < this.minApiInterval) {
        const waitTime = this.minApiInterval - timeSinceLastCall;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.backgroundLastApiCallTime = Date.now();
    });

    this.backgroundThrottleQueue = waitPromise.catch(() => {});
    return waitPromise;
  }

  async throttleUI() {
    const waitPromise = this.uiThrottleQueue.then(async () => {
      const now = Date.now();
      const timeSinceLastCall = now - this.uiLastApiCallTime;
      if (timeSinceLastCall < this.minApiInterval) {
        const waitTime = this.minApiInterval - timeSinceLastCall;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      // Update BOTH timestamps - UI takes priority and pushes back background
      const timestamp = Date.now();
      this.uiLastApiCallTime = timestamp;
      this.backgroundLastApiCallTime = timestamp;
    });

    this.uiThrottleQueue = waitPromise.catch(() => {});
    return waitPromise;
  }
}

describe('HordeAPI Rate Limiter', () => {
  let api;

  beforeEach(() => {
    api = new MockHordeAPI();
  });

  describe('throttleBackground', () => {
    it('should only update backgroundLastApiCallTime', async () => {
      const initialUITime = api.uiLastApiCallTime;

      await api.throttleBackground();

      expect(api.backgroundLastApiCallTime).toBeGreaterThan(0);
      expect(api.uiLastApiCallTime).toBe(initialUITime);
    });

    it('should enforce minimum interval between background calls', async () => {
      const start = Date.now();

      await api.throttleBackground();
      await api.throttleBackground();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(api.minApiInterval - 10); // Allow 10ms tolerance
    });

    it('should serialize concurrent background calls', async () => {
      const callOrder = [];

      const call1 = api.throttleBackground().then(() => callOrder.push(1));
      const call2 = api.throttleBackground().then(() => callOrder.push(2));
      const call3 = api.throttleBackground().then(() => callOrder.push(3));

      await Promise.all([call1, call2, call3]);

      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('throttleUI', () => {
    it('should update both backgroundLastApiCallTime and uiLastApiCallTime', async () => {
      await api.throttleUI();

      expect(api.backgroundLastApiCallTime).toBeGreaterThan(0);
      expect(api.uiLastApiCallTime).toBeGreaterThan(0);
      // They should be equal (set at the same time)
      expect(api.backgroundLastApiCallTime).toBe(api.uiLastApiCallTime);
    });

    it('should enforce minimum interval between UI calls', async () => {
      const start = Date.now();

      await api.throttleUI();
      await api.throttleUI();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(api.minApiInterval - 10);
    });
  });

  describe('UI Priority', () => {
    it('should allow UI call immediately after background call', async () => {
      // Background call sets backgroundLastApiCallTime
      await api.throttleBackground();
      const bgTime = api.backgroundLastApiCallTime;

      // UI call should NOT wait for background cooldown
      // because UI uses its own uiLastApiCallTime
      const uiStart = Date.now();
      await api.throttleUI();
      const uiDuration = Date.now() - uiStart;

      // UI should complete almost immediately (< minApiInterval)
      expect(uiDuration).toBeLessThan(api.minApiInterval);
    });

    it('should make background wait after UI call', async () => {
      // UI call sets BOTH timestamps
      await api.throttleUI();

      // Background call should wait because UI updated backgroundLastApiCallTime
      const bgStart = Date.now();
      await api.throttleBackground();
      const bgDuration = Date.now() - bgStart;

      // Background should have waited for the cooldown
      expect(bgDuration).toBeGreaterThanOrEqual(api.minApiInterval - 15); // Allow some tolerance
    });

    it('should demonstrate UI priority in interleaved calls', async () => {
      const timestamps = [];

      // First background call
      await api.throttleBackground();
      timestamps.push({ type: 'BG1', time: Date.now() });

      // UI call (should go through immediately on its own queue)
      await api.throttleUI();
      timestamps.push({ type: 'UI1', time: Date.now() });

      // Second background call (should wait because UI updated bg timestamp)
      await api.throttleBackground();
      timestamps.push({ type: 'BG2', time: Date.now() });

      // Verify BG2 waited after UI1
      const uiToBg2Gap = timestamps[2].time - timestamps[1].time;
      expect(uiToBg2Gap).toBeGreaterThanOrEqual(api.minApiInterval - 15);

      // Verify UI1 did NOT wait long after BG1
      const bg1ToUiGap = timestamps[1].time - timestamps[0].time;
      expect(bg1ToUiGap).toBeLessThan(api.minApiInterval);
    });
  });

  describe('Separate Queues', () => {
    it('should allow concurrent background and UI calls to different queues', async () => {
      // Start both at the same time
      const bgPromise = api.throttleBackground();
      const uiPromise = api.throttleUI();

      await Promise.all([bgPromise, uiPromise]);

      // Both should have completed (different queues)
      expect(api.backgroundLastApiCallTime).toBeGreaterThan(0);
      expect(api.uiLastApiCallTime).toBeGreaterThan(0);
    });
  });
});

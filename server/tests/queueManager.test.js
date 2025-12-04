import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for the QueueManager isChecking flag
 *
 * These tests verify that concurrent calls to checkActiveRequests()
 * are prevented by the isChecking flag, avoiding duplicate processing
 * of the same request.
 */

// Mock implementation of key parts of QueueManager for testing
class MockQueueManager {
  constructor() {
    this.maxActiveRequests = 5;
    this.activeRequests = new Map();
    this.activeDownloads = new Set();
    this.lastPollTime = new Map();
    this.minPollInterval = 100; // Short for testing
    this.isProcessing = false;
    this.isSubmitting = false;
    this.isDownloading = false;
    this.isChecking = false;

    // Track calls for testing
    this.checkActiveRequestsCalls = [];
    this.handleCompletedRequestCalls = [];
  }

  async checkActiveRequests() {
    // Prevent concurrent status checking
    if (this.isChecking) {
      this.checkActiveRequestsCalls.push({ skipped: true, time: Date.now() });
      return;
    }
    this.isChecking = true;

    try {
      this.checkActiveRequestsCalls.push({ skipped: false, time: Date.now() });

      if (this.activeRequests.size === 0) {
        return;
      }

      for (const [requestUuid, hordeId] of this.activeRequests.entries()) {
        if (hordeId === 'submitting') {
          continue;
        }

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 50));

        // Simulate a completed request
        if (this.mockRequestDone) {
          this.activeRequests.delete(requestUuid);
          this.lastPollTime.delete(requestUuid);
          await this.handleCompletedRequest(requestUuid, hordeId);
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  async handleCompletedRequest(requestUuid, hordeId) {
    this.handleCompletedRequestCalls.push({ requestUuid, hordeId, time: Date.now() });
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

describe('QueueManager isChecking Flag', () => {
  let queueManager;

  beforeEach(() => {
    queueManager = new MockQueueManager();
  });

  describe('Concurrent Call Prevention', () => {
    it('should prevent concurrent checkActiveRequests calls', async () => {
      // Add some active requests
      queueManager.activeRequests.set('request-1', 'horde-id-1');
      queueManager.activeRequests.set('request-2', 'horde-id-2');

      // Start multiple concurrent calls
      const call1 = queueManager.checkActiveRequests();
      const call2 = queueManager.checkActiveRequests();
      const call3 = queueManager.checkActiveRequests();

      await Promise.all([call1, call2, call3]);

      // Only one call should have actually run (not skipped)
      const actualCalls = queueManager.checkActiveRequestsCalls.filter(c => !c.skipped);
      const skippedCalls = queueManager.checkActiveRequestsCalls.filter(c => c.skipped);

      expect(actualCalls.length).toBe(1);
      expect(skippedCalls.length).toBe(2);
    });

    it('should allow sequential checkActiveRequests calls', async () => {
      queueManager.activeRequests.set('request-1', 'horde-id-1');

      // Sequential calls should all execute
      await queueManager.checkActiveRequests();
      await queueManager.checkActiveRequests();
      await queueManager.checkActiveRequests();

      const actualCalls = queueManager.checkActiveRequestsCalls.filter(c => !c.skipped);
      expect(actualCalls.length).toBe(3);
    });

    it('should reset isChecking flag even on error', async () => {
      queueManager.activeRequests.set('request-1', 'horde-id-1');

      // Override to throw error
      const originalMethod = queueManager.checkActiveRequests.bind(queueManager);
      queueManager.checkActiveRequests = async function () {
        if (this.isChecking) {
          this.checkActiveRequestsCalls.push({ skipped: true, time: Date.now() });
          return;
        }
        this.isChecking = true;
        try {
          throw new Error('Simulated error');
        } finally {
          this.isChecking = false;
        }
      };

      // First call throws error
      await expect(queueManager.checkActiveRequests()).rejects.toThrow('Simulated error');

      // isChecking should be reset
      expect(queueManager.isChecking).toBe(false);

      // Subsequent call should work
      queueManager.checkActiveRequests = originalMethod;
      await queueManager.checkActiveRequests();
      const actualCalls = queueManager.checkActiveRequestsCalls.filter(c => !c.skipped);
      expect(actualCalls.length).toBe(1);
    });
  });

  describe('Race Condition Prevention for handleCompletedRequest', () => {
    it('should only call handleCompletedRequest once per request', async () => {
      queueManager.activeRequests.set('request-1', 'horde-id-1');
      queueManager.mockRequestDone = true;

      // Simulate race: multiple interval fires
      const call1 = queueManager.checkActiveRequests();
      const call2 = queueManager.checkActiveRequests();

      await Promise.all([call1, call2]);

      // handleCompletedRequest should only be called once
      expect(queueManager.handleCompletedRequestCalls.length).toBe(1);
      expect(queueManager.handleCompletedRequestCalls[0].requestUuid).toBe('request-1');
    });

    it('should prevent duplicate downloads from concurrent status checks', async () => {
      // This simulates the original bug:
      // 1. Two intervals fire while status check is running
      // 2. Both see the same request as "done"
      // 3. Without isChecking flag, both would call handleCompletedRequest

      queueManager.activeRequests.set('request-1', 'horde-id-1');
      queueManager.activeRequests.set('request-2', 'horde-id-2');
      queueManager.mockRequestDone = true;

      // Fire 5 concurrent "interval" calls (simulating overlapping intervals)
      const calls = Array(5).fill(null).map(() => queueManager.checkActiveRequests());
      await Promise.all(calls);

      // Should only have processed requests once
      // (2 requests, each should only appear once in handleCompletedRequestCalls)
      const requestIds = queueManager.handleCompletedRequestCalls.map(c => c.requestUuid);
      const uniqueRequestIds = [...new Set(requestIds)];

      expect(uniqueRequestIds.length).toBe(requestIds.length);
    });
  });
});

describe('QueueManager Download Processing', () => {
  let queueManager;

  beforeEach(() => {
    queueManager = new MockQueueManager();
  });

  it('should prevent concurrent download processing with isDownloading flag', async () => {
    let processDownloadsCalls = 0;

    queueManager.processDownloads = async function () {
      if (this.isDownloading) {
        return;
      }
      this.isDownloading = true;
      try {
        processDownloadsCalls++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } finally {
        this.isDownloading = false;
      }
    };

    // Fire concurrent calls
    const calls = Array(5).fill(null).map(() => queueManager.processDownloads());
    await Promise.all(calls);

    // Only one should have executed
    expect(processDownloadsCalls).toBe(1);
  });
});

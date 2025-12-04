import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for the real QueueManager implementation
 *
 * We mock hordeApi and database models to prevent external calls,
 * but test the real queue management logic including the isChecking flag.
 */

// Mock hordeApi
vi.mock('../services/hordeApi.js', () => ({
  default: {
    postImageAsyncGenerate: vi.fn().mockResolvedValue({ id: 'horde-123' }),
    getImageAsyncCheck: vi.fn().mockResolvedValue({ done: false, queue_position: 1 }),
    getImageAsyncStatus: vi.fn().mockResolvedValue({
      generations: [
        { img: 'https://example.com/image1.png', censored: false },
        { img: 'https://example.com/image2.png', censored: false },
      ],
    }),
    cancelRequest: vi.fn().mockResolvedValue({ cancelled: true }),
    downloadImage: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
  },
}));

// Mock database models
vi.mock('../db/models.js', () => ({
  HordeRequest: {
    findPending: vi.fn(() => []),
    findById: vi.fn(() => ({ uuid: 'req-123', prompt: 'test', full_request: '{}' })),
    create: vi.fn((data) => ({ uuid: 'new-req-uuid', ...data })),
    update: vi.fn(),
  },
  GeneratedImage: {
    create: vi.fn(),
  },
  HordePendingDownload: {
    create: vi.fn((data) => ({ uuid: 'download-uuid', ...data })),
    findAll: vi.fn(() => []),
    delete: vi.fn(),
  },
  ImageAlbum: {
    addImageToAlbum: vi.fn(),
  },
}));

// Mock sharp
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ format: 'png' }),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(),
  })),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
}));

// Mock database.js to avoid initialization
vi.mock('../db/database.js', () => ({
  imagesDir: '/tmp/test-images',
}));

// Now import the real queueManager
import queueManager from '../services/queueManager.js';
import hordeApi from '../services/hordeApi.js';
import { HordeRequest, HordePendingDownload } from '../db/models.js';

describe('QueueManager (Real Implementation)', () => {
  beforeEach(() => {
    // Reset queue manager state
    queueManager.activeRequests.clear();
    queueManager.activeDownloads.clear();
    queueManager.lastPollTime.clear();
    queueManager.isProcessing = false;
    queueManager.isSubmitting = false;
    queueManager.isDownloading = false;
    queueManager.isChecking = false;

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('isChecking Flag', () => {
    it('should prevent concurrent checkActiveRequests calls', async () => {
      // Add an active request
      queueManager.activeRequests.set('req-1', 'horde-1');

      // Make the API call slow so we can test concurrency
      hordeApi.getImageAsyncCheck.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { done: false, queue_position: 1 };
      });

      // Start multiple concurrent calls
      const call1 = queueManager.checkActiveRequests();
      const call2 = queueManager.checkActiveRequests();
      const call3 = queueManager.checkActiveRequests();

      await Promise.all([call1, call2, call3]);

      // The API should only be called once (from the first call that got the lock)
      expect(hordeApi.getImageAsyncCheck).toHaveBeenCalledTimes(1);
    });

    it('should allow sequential checkActiveRequests calls', async () => {
      queueManager.activeRequests.set('req-1', 'horde-1');
      queueManager.minPollInterval = 0; // Disable poll interval for this test

      hordeApi.getImageAsyncCheck.mockResolvedValue({ done: false, queue_position: 1 });

      await queueManager.checkActiveRequests();
      await queueManager.checkActiveRequests();
      await queueManager.checkActiveRequests();

      // Each sequential call should execute
      expect(hordeApi.getImageAsyncCheck).toHaveBeenCalledTimes(3);
    });

    it('should reset isChecking flag even on error', async () => {
      queueManager.activeRequests.set('req-1', 'horde-1');
      queueManager.minPollInterval = 0;

      hordeApi.getImageAsyncCheck.mockRejectedValueOnce(new Error('API Error'));

      // This should not throw (errors are caught internally)
      await queueManager.checkActiveRequests();

      // Flag should be reset
      expect(queueManager.isChecking).toBe(false);

      // Next call should work
      hordeApi.getImageAsyncCheck.mockResolvedValue({ done: false });
      await queueManager.checkActiveRequests();
      expect(hordeApi.getImageAsyncCheck).toHaveBeenCalledTimes(2);
    });

    it('should only call handleCompletedRequest once per request when done', async () => {
      queueManager.activeRequests.set('req-1', 'horde-1');
      queueManager.minPollInterval = 0;

      // First call returns done=true
      hordeApi.getImageAsyncCheck.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { done: true, queue_position: 0 };
      });

      // Start concurrent calls
      const call1 = queueManager.checkActiveRequests();
      const call2 = queueManager.checkActiveRequests();

      await Promise.all([call1, call2]);

      // getImageAsyncStatus (called in handleCompletedRequest) should only be called once
      expect(hordeApi.getImageAsyncStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('isSubmitting Flag', () => {
    it('should prevent concurrent submitPendingRequests calls', async () => {
      HordeRequest.findPending.mockReturnValue([
        { uuid: 'req-1', status: 'pending', full_request: '{"prompt":"test"}' },
      ]);

      hordeApi.postImageAsyncGenerate.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { id: 'horde-123' };
      });

      const call1 = queueManager.submitPendingRequests();
      const call2 = queueManager.submitPendingRequests();
      const call3 = queueManager.submitPendingRequests();

      await Promise.all([call1, call2, call3]);

      // Only one submission should happen
      expect(hordeApi.postImageAsyncGenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe('isDownloading Flag', () => {
    it('should prevent concurrent processDownloads calls', async () => {
      HordePendingDownload.findAll.mockReturnValue([
        { uuid: 'dl-1', request_id: 'req-1', uri: 'https://example.com/img.png' },
      ]);

      hordeApi.downloadImage.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return Buffer.from('fake-image');
      });

      const call1 = queueManager.processDownloads();
      const call2 = queueManager.processDownloads();
      const call3 = queueManager.processDownloads();

      await Promise.all([call1, call2, call3]);

      // Only one download batch should process
      expect(hordeApi.downloadImage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request Lifecycle', () => {
    it('should track active requests correctly', async () => {
      HordeRequest.findPending.mockReturnValue([
        { uuid: 'req-1', status: 'pending', full_request: '{"prompt":"test"}' },
      ]);

      hordeApi.postImageAsyncGenerate.mockResolvedValue({ id: 'horde-123' });

      await queueManager.submitPendingRequests();

      // Request should be tracked
      expect(queueManager.activeRequests.has('req-1')).toBe(true);
      expect(queueManager.activeRequests.get('req-1')).toBe('horde-123');
    });

    it('should remove completed requests from active tracking', async () => {
      queueManager.activeRequests.set('req-1', 'horde-1');
      queueManager.minPollInterval = 0;

      hordeApi.getImageAsyncCheck.mockResolvedValue({ done: true });
      hordeApi.getImageAsyncStatus.mockResolvedValue({ generations: [] });

      await queueManager.checkActiveRequests();

      // Request should be removed from tracking
      expect(queueManager.activeRequests.has('req-1')).toBe(false);
    });
  });

  describe('handleCompletedRequest', () => {
    it('should create pending downloads for each non-censored image', async () => {
      hordeApi.getImageAsyncStatus.mockResolvedValue({
        generations: [
          { img: 'https://example.com/image1.png', censored: false },
          { img: 'https://example.com/image2.png', censored: false },
          { img: 'https://example.com/image3.png', censored: true }, // Should be skipped
        ],
      });

      await queueManager.handleCompletedRequest('req-1', 'horde-1');

      // Should create 2 downloads (skipping the censored one)
      expect(HordePendingDownload.create).toHaveBeenCalledTimes(2);
      expect(HordePendingDownload.create).toHaveBeenCalledWith(
        expect.objectContaining({ uri: 'https://example.com/image1.png' })
      );
      expect(HordePendingDownload.create).toHaveBeenCalledWith(
        expect.objectContaining({ uri: 'https://example.com/image2.png' })
      );
    });

    it('should update request status to downloading', async () => {
      hordeApi.getImageAsyncStatus.mockResolvedValue({
        generations: [{ img: 'https://example.com/image1.png', censored: false }],
      });

      await queueManager.handleCompletedRequest('req-1', 'horde-1');

      expect(HordeRequest.update).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ status: 'downloading' })
      );
    });
  });

  describe('Poll Interval Enforcement', () => {
    it('should respect minPollInterval for individual requests', async () => {
      queueManager.activeRequests.set('req-1', 'horde-1');
      queueManager.minPollInterval = 100;

      hordeApi.getImageAsyncCheck.mockResolvedValue({ done: false });

      // First call should poll
      await queueManager.checkActiveRequests();
      expect(hordeApi.getImageAsyncCheck).toHaveBeenCalledTimes(1);

      // Immediate second call should skip (within minPollInterval)
      await queueManager.checkActiveRequests();
      expect(hordeApi.getImageAsyncCheck).toHaveBeenCalledTimes(1);

      // Wait for interval to pass
      await new Promise((resolve) => setTimeout(resolve, 110));

      // Now it should poll again
      await queueManager.checkActiveRequests();
      expect(hordeApi.getImageAsyncCheck).toHaveBeenCalledTimes(2);
    });
  });
});

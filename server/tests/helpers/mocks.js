import { vi } from 'vitest';
import {
  sampleHordeGenerateResponse,
  sampleHordeStatusResponse,
  sampleHordeUserInfo,
  sampleHordeWorker,
  sampleCivitaiSearchResult,
  sampleStylesData
} from './fixtures.js';

/**
 * Creates a mock hordeApi service with configurable responses.
 * All methods return resolved promises by default.
 */
export function createMockHordeApi(overrides = {}) {
  return {
    postImageAsyncGenerate: vi.fn().mockResolvedValue(
      overrides.generateResponse || sampleHordeGenerateResponse()
    ),

    getImageAsyncCheck: vi.fn().mockResolvedValue(
      overrides.checkResponse || sampleHordeStatusResponse()
    ),

    getImageAsyncStatus: vi.fn().mockResolvedValue(
      overrides.statusResponse || sampleHordeStatusResponse({ done: true, generations: [] })
    ),

    cancelRequest: vi.fn().mockResolvedValue(
      overrides.cancelResponse || { cancelled: true }
    ),

    downloadImage: vi.fn().mockResolvedValue(
      overrides.downloadResponse || Buffer.from('fake-image-data')
    ),

    getKudosEstimate: vi.fn().mockResolvedValue(
      overrides.estimateResponse || { kudos: 10 }
    ),

    getUserInfo: vi.fn().mockResolvedValue(
      overrides.userInfo || sampleHordeUserInfo()
    ),

    getUserWorkers: vi.fn().mockResolvedValue(
      overrides.workers || [sampleHordeWorker()]
    ),

    getWorkerDetails: vi.fn().mockResolvedValue(
      overrides.workerDetails || sampleHordeWorker()
    ),

    updateWorker: vi.fn().mockResolvedValue(
      overrides.updateWorkerResponse || { success: true }
    ),

    getSharedKeys: vi.fn().mockResolvedValue(
      overrides.sharedKeys || []
    ),

    createSharedKey: vi.fn().mockResolvedValue(
      overrides.createSharedKeyResponse || { id: 'shared-key-123', key: 'sk-test-key' }
    ),

    updateSharedKey: vi.fn().mockResolvedValue(
      overrides.updateSharedKeyResponse || { success: true }
    ),

    deleteSharedKey: vi.fn().mockResolvedValue(
      overrides.deleteSharedKeyResponse || { success: true }
    ),

    getSharedKeyDetails: vi.fn().mockResolvedValue(
      overrides.sharedKeyDetails || { id: 'shared-key-123', name: 'Test Key' }
    ),

    // Reset all mocks
    _resetAll() {
      Object.values(this).forEach(value => {
        if (typeof value?.mockReset === 'function') {
          value.mockReset();
        }
      });
    }
  };
}

/**
 * Creates a mock queueManager service with configurable responses.
 */
export function createMockQueueManager(overrides = {}) {
  const mockModels = overrides.models;

  return {
    addRequest: vi.fn().mockImplementation((data) => {
      if (mockModels) {
        return mockModels.HordeRequest.create({
          prompt: data.prompt,
          fullRequest: JSON.stringify(data.params),
          status: 'pending',
          albumId: data.albumId || null
        });
      }
      return {
        uuid: 'mock-uuid-' + Date.now(),
        prompt: data.prompt,
        status: 'pending',
        date_created: Date.now()
      };
    }),

    cancelRequest: vi.fn().mockResolvedValue(true),

    getStatus: vi.fn().mockReturnValue(
      overrides.status || {
        active: 0,
        maxActive: 5,
        pendingRequests: 0,
        pendingDownloads: 0,
        isProcessing: false
      }
    ),

    start: vi.fn(),
    stop: vi.fn(),

    // Reset all mocks
    _resetAll() {
      Object.values(this).forEach(value => {
        if (typeof value?.mockReset === 'function') {
          value.mockReset();
        }
      });
    }
  };
}

/**
 * Creates a mock civitaiService with configurable responses.
 */
export function createMockCivitaiService(overrides = {}) {
  return {
    searchLoras: vi.fn().mockResolvedValue(
      overrides.searchLorasResponse || sampleCivitaiSearchResult()
    ),

    searchTextualInversions: vi.fn().mockResolvedValue(
      overrides.searchTisResponse || sampleCivitaiSearchResult()
    ),

    getLoraById: vi.fn().mockResolvedValue(
      overrides.loraById || { id: 1, name: 'Test LoRA' }
    ),

    getLoraByVersionId: vi.fn().mockResolvedValue(
      overrides.loraByVersionId || { id: 1, name: 'Test LoRA', version: { id: 100 } }
    ),

    getTiById: vi.fn().mockResolvedValue(
      overrides.tiById || { id: 1, name: 'Test TI' }
    ),

    getTiByVersionId: vi.fn().mockResolvedValue(
      overrides.tiByVersionId || { id: 1, name: 'Test TI', version: { id: 200 } }
    ),

    // Reset all mocks
    _resetAll() {
      Object.values(this).forEach(value => {
        if (typeof value?.mockReset === 'function') {
          value.mockReset();
        }
      });
    }
  };
}

/**
 * Creates a mock axios instance for HTTP requests.
 */
export function createMockAxios(overrides = {}) {
  const mock = {
    get: vi.fn().mockResolvedValue({ data: overrides.getData || {} }),
    post: vi.fn().mockResolvedValue({ data: overrides.postData || {} }),
    put: vi.fn().mockResolvedValue({ data: overrides.putData || {} }),
    patch: vi.fn().mockResolvedValue({ data: overrides.patchData || {} }),
    delete: vi.fn().mockResolvedValue({ data: overrides.deleteData || {} }),
    create: vi.fn().mockReturnThis(),
    defaults: {
      headers: {
        common: {}
      }
    },

    // Reset all mocks
    _resetAll() {
      this.get.mockReset();
      this.post.mockReset();
      this.put.mockReset();
      this.patch.mockReset();
      this.delete.mockReset();
    }
  };

  return mock;
}

/**
 * Creates mock styles response (from GitHub).
 */
export function createMockStylesResponse() {
  return sampleStylesData();
}

/**
 * Creates a mock fs module for file operations.
 */
export function createMockFs() {
  return {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-file-content')),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ isFile: () => true, isDirectory: () => false }),

    _resetAll() {
      Object.values(this).forEach(value => {
        if (typeof value?.mockReset === 'function') {
          value.mockReset();
        }
      });
    }
  };
}

/**
 * Creates a mock sharp module for image processing.
 */
export function createMockSharp() {
  const mockInstance = {
    resize: vi.fn().mockReturnThis(),
    toFormat: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue({ width: 256, height: 256 }),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image'))
  };

  const sharp = vi.fn().mockReturnValue(mockInstance);
  sharp._instance = mockInstance;
  sharp._resetAll = () => {
    sharp.mockReset();
    Object.values(mockInstance).forEach(value => {
      if (typeof value?.mockReset === 'function') {
        value.mockReset();
      }
    });
  };

  return sharp;
}

/**
 * Helper to setup vi.mock() calls for common modules.
 * Call this at the top of test files before imports.
 *
 * Usage:
 * ```
 * vi.mock('../../services/hordeApi.js', () => ({
 *   default: createMockHordeApi()
 * }));
 * ```
 */
export const mockModuleFactories = {
  hordeApi: (overrides = {}) => ({
    default: createMockHordeApi(overrides)
  }),

  queueManager: (overrides = {}) => ({
    default: createMockQueueManager(overrides)
  }),

  civitaiService: (overrides = {}) => ({
    default: createMockCivitaiService(overrides)
  }),

  axios: (overrides = {}) => ({
    default: createMockAxios(overrides)
  }),

  fs: () => ({
    default: createMockFs(),
    ...createMockFs()
  }),

  sharp: () => createMockSharp()
};

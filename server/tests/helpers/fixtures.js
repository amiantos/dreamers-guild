import { v4 as uuidv4 } from 'uuid';

/**
 * Test data fixtures and factories for generating consistent test data.
 */

/**
 * Generate valid request params for AI Horde generation
 */
export function validRequestParams(overrides = {}) {
  return {
    prompt: 'a beautiful sunset over mountains',
    params: {
      models: ['stable_diffusion'],
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'k_euler',
        n: 1,
        ...overrides.genParams
      },
      ...overrides.params
    },
    ...overrides
  };
}

/**
 * Invalid request params for testing validation
 */
export const invalidRequestParams = {
  missingPrompt: () => ({
    params: {
      models: ['stable_diffusion'],
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'k_euler'
      }
    }
  }),

  missingParams: () => ({
    prompt: 'a test prompt'
  }),

  emptyModels: () => ({
    prompt: 'a test prompt',
    params: {
      models: [],
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'k_euler'
      }
    }
  }),

  modelsNotArray: () => ({
    prompt: 'a test prompt',
    params: {
      models: 'stable_diffusion',
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'k_euler'
      }
    }
  }),

  negativeWidth: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion'],
      params: {
        width: -512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'k_euler'
      }
    }
  }),

  missingWidth: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion'],
      params: {
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'k_euler'
      }
    }
  }),

  missingHeight: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion'],
      params: {
        width: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'k_euler'
      }
    }
  }),

  missingSteps: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion'],
      params: {
        width: 512,
        height: 512,
        cfg_scale: 7,
        sampler_name: 'k_euler'
      }
    }
  }),

  missingCfgScale: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion'],
      params: {
        width: 512,
        height: 512,
        steps: 20,
        sampler_name: 'k_euler'
      }
    }
  }),

  missingSamplerName: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion'],
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7
      }
    }
  }),

  emptySamplerName: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion'],
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: '   '
      }
    }
  }),

  invalidN: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion'],
      params: {
        width: 512,
        height: 512,
        steps: 20,
        cfg_scale: 7,
        sampler_name: 'k_euler',
        n: -1
      }
    }
  }),

  missingNestedParams: () => ({
    prompt: 'a test prompt',
    params: {
      models: ['stable_diffusion']
    }
  })
};

/**
 * Generate sample image data
 */
export function sampleImage(overrides = {}) {
  const uuid = overrides.uuid || uuidv4();
  return {
    uuid,
    requestId: overrides.requestId || null,
    dateCreated: overrides.dateCreated || Date.now(),
    backend: overrides.backend || 'AI Horde',
    promptSimple: overrides.promptSimple || 'a beautiful sunset',
    fullRequest: overrides.fullRequest || JSON.stringify({ prompt: 'a beautiful sunset', models: ['stable_diffusion'] }),
    fullResponse: overrides.fullResponse || JSON.stringify({ id: 'response-123' }),
    imagePath: overrides.imagePath || `${uuid}.png`,
    thumbnailPath: overrides.thumbnailPath || `${uuid}-thumb.webp`,
    isFavorite: overrides.isFavorite || false,
    isHidden: overrides.isHidden || false
  };
}

/**
 * Generate sample album data
 */
export function sampleAlbum(overrides = {}) {
  return {
    title: overrides.title || 'Test Album',
    isHidden: overrides.isHidden || false,
    coverImageUuid: overrides.coverImageUuid || null
  };
}

/**
 * Generate sample user settings data
 */
export function sampleSettings(overrides = {}) {
  return {
    apiKey: overrides.apiKey || 'test-api-key-12345',
    defaultParams: overrides.defaultParams || {},
    favoriteModels: overrides.favoriteModels || [],
    favoriteStyles: overrides.favoriteStyles || [],
    lastUsedSettings: overrides.lastUsedSettings || {},
    workerPreferences: overrides.workerPreferences || {
      slowWorkers: true,
      trustedWorkers: false,
      nsfw: false,
      allowDowngrade: true,
      replacementFilter: true
    }
  };
}

/**
 * Generate sample LoRA cache data
 */
export function sampleLoraCache(overrides = {}) {
  const versionId = overrides.versionId || '12345';
  return {
    versionId,
    modelId: overrides.modelId || '100',
    metadata: overrides.metadata || {
      id: parseInt(versionId),
      name: 'Test LoRA',
      modelVersions: [{
        id: parseInt(versionId),
        name: 'v1.0'
      }]
    }
  };
}

/**
 * Generate sample TI cache data
 */
export function sampleTiCache(overrides = {}) {
  const versionId = overrides.versionId || '67890';
  return {
    versionId,
    modelId: overrides.modelId || '200',
    metadata: overrides.metadata || {
      id: parseInt(versionId),
      name: 'Test TI',
      modelVersions: [{
        id: parseInt(versionId),
        name: 'v1.0'
      }]
    }
  };
}

/**
 * Generate sample HordeRequest data
 */
export function sampleHordeRequest(overrides = {}) {
  const uuid = overrides.uuid || uuidv4();
  return {
    uuid,
    dateCreated: overrides.dateCreated || Date.now(),
    prompt: overrides.prompt || 'a beautiful sunset',
    fullRequest: overrides.fullRequest || JSON.stringify(validRequestParams().params),
    status: overrides.status || 'pending',
    message: overrides.message || null,
    n: overrides.n || 1,
    queuePosition: overrides.queuePosition || 0,
    waitTime: overrides.waitTime || 0,
    totalKudosCost: overrides.totalKudosCost || 0,
    hordeId: overrides.hordeId || null,
    albumId: overrides.albumId || null
  };
}

/**
 * Generate sample pending download data
 */
export function samplePendingDownload(overrides = {}) {
  const uuid = overrides.uuid || uuidv4();
  return {
    uuid,
    requestId: overrides.requestId || uuidv4(),
    uri: overrides.uri || `https://example.com/images/${uuid}.png`,
    fullRequest: overrides.fullRequest || JSON.stringify({ prompt: 'test' }),
    fullResponse: overrides.fullResponse || JSON.stringify({ id: 'response-123' })
  };
}

/**
 * Generate sample AI Horde API response for async generate
 */
export function sampleHordeGenerateResponse(overrides = {}) {
  return {
    id: overrides.id || 'horde-request-' + uuidv4().substring(0, 8),
    kudos: overrides.kudos || 10,
    message: overrides.message || null
  };
}

/**
 * Generate sample AI Horde API response for status check
 */
export function sampleHordeStatusResponse(overrides = {}) {
  return {
    done: overrides.done || false,
    faulted: overrides.faulted || false,
    wait_time: overrides.waitTime || 30,
    queue_position: overrides.queuePosition || 5,
    kudos: overrides.kudos || 10,
    is_possible: overrides.isPossible !== false,
    finished: overrides.finished || 0,
    processing: overrides.processing || 0,
    waiting: overrides.waiting || 1,
    generations: overrides.generations || []
  };
}

/**
 * Generate sample AI Horde completed generation
 */
export function sampleHordeGeneration(overrides = {}) {
  return {
    img: overrides.img || `https://example.com/images/${uuidv4()}.png`,
    seed: overrides.seed || '12345',
    id: overrides.id || uuidv4(),
    censored: overrides.censored || false,
    worker_id: overrides.workerId || 'worker-123',
    worker_name: overrides.workerName || 'Test Worker',
    model: overrides.model || 'stable_diffusion',
    state: overrides.state || 'ok'
  };
}

/**
 * Generate sample CivitAI search result
 */
export function sampleCivitaiSearchResult(overrides = {}) {
  return {
    items: overrides.items || [
      {
        id: 1,
        name: 'Test LoRA',
        type: 'LORA',
        nsfw: false,
        modelVersions: [{
          id: 100,
          name: 'v1.0',
          files: [{ name: 'test.safetensors' }]
        }]
      }
    ],
    metadata: overrides.metadata || {
      totalItems: 1,
      currentPage: 1,
      pageSize: 20
    }
  };
}

/**
 * Generate sample AI Horde user info
 */
export function sampleHordeUserInfo(overrides = {}) {
  return {
    id: overrides.id || 12345,
    username: overrides.username || 'TestUser',
    kudos: overrides.kudos || 1000,
    trusted: overrides.trusted || false,
    moderator: overrides.moderator || false,
    worker_ids: overrides.workerIds || []
  };
}

/**
 * Generate sample AI Horde worker
 */
export function sampleHordeWorker(overrides = {}) {
  return {
    id: overrides.id || 'worker-' + uuidv4().substring(0, 8),
    name: overrides.name || 'Test Worker',
    online: overrides.online !== false,
    requests_fulfilled: overrides.requestsFulfilled || 100,
    kudos_rewards: overrides.kudosRewards || 500,
    models: overrides.models || ['stable_diffusion'],
    maintenance_mode: overrides.maintenanceMode || false,
    paused: overrides.paused || false
  };
}

/**
 * Generate sample styles data (as returned from GitHub)
 */
export function sampleStylesData() {
  return {
    'Anime': {
      prompt: '{p}, anime style, high quality',
      negative_prompt: 'bad quality, blurry',
      model: 'Anything V5'
    },
    'Photorealistic': {
      prompt: '{p}, photorealistic, 8k',
      negative_prompt: 'cartoon, anime',
      model: 'Realistic Vision'
    },
    'Fantasy': {
      prompt: '{p}, fantasy art, magical',
      negative_prompt: 'modern, realistic',
      model: 'DreamShaper'
    }
  };
}

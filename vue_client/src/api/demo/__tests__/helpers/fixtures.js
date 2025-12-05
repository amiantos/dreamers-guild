/**
 * Test data factories for demo mode API tests
 * Mirrors patterns from server/tests/helpers/fixtures.js
 */

let fixtureCounter = 0

function nextId() {
  fixtureCounter++
  return fixtureCounter
}

export function resetFixtureCounter() {
  fixtureCounter = 0
}

/**
 * Create a sample request record
 */
export function sampleRequest(overrides = {}) {
  const id = nextId()
  const uuid = overrides.uuid || `request-uuid-${id}`
  const now = new Date().toISOString()

  return {
    uuid,
    horde_request_id: 'hordeRequestId' in overrides ? overrides.hordeRequestId : `horde-${id}`,
    full_request: overrides.fullRequest || JSON.stringify({
      prompt: 'a beautiful sunset over the ocean',
      models: ['stable_diffusion'],
      params: { n: 1, width: 512, height: 512 }
    }),
    prompt: overrides.prompt || 'a beautiful sunset over the ocean',
    n: overrides.n || 1,
    status: overrides.status || 'pending',
    queue_position: overrides.queuePosition ?? 0,
    wait_time: overrides.waitTime ?? 0,
    waiting: overrides.waiting ?? 0,
    processing: overrides.processing ?? 0,
    finished: overrides.finished ?? 0,
    total_kudos_cost: overrides.totalKudosCost ?? 0,
    message: overrides.message || null,
    date_created: overrides.dateCreated || now,
    date_completed: overrides.dateCompleted || null,
    ...overrides
  }
}

/**
 * Create a sample image metadata record
 */
export function sampleImage(overrides = {}) {
  const id = nextId()
  const uuid = overrides.uuid || `image-uuid-${id}`
  const now = new Date().toISOString()

  return {
    uuid,
    request_id: overrides.requestId || null,
    prompt_simple: overrides.promptSimple || 'a beautiful sunset',
    full_request: overrides.fullRequest || JSON.stringify({
      prompt: 'a beautiful sunset',
      models: ['stable_diffusion']
    }),
    full_response: overrides.fullResponse || JSON.stringify({
      id: `gen-${id}`,
      seed: '12345',
      model: 'stable_diffusion'
    }),
    seed: overrides.seed || '12345',
    model: overrides.model || 'stable_diffusion',
    worker_id: overrides.workerId || `worker-${id}`,
    worker_name: overrides.workerName || 'Test Worker',
    is_favorite: overrides.isFavorite ?? false,
    is_hidden: overrides.isHidden ?? false,
    date_created: overrides.dateCreated || now,
    ...overrides
  }
}

/**
 * Create a sample image blob record
 */
export function sampleImageBlob(overrides = {}) {
  const id = nextId()
  const uuid = overrides.uuid || `blob-uuid-${id}`

  return {
    uuid,
    fullImage: overrides.fullImage || new Blob(['fake-image-data'], { type: 'image/png' }),
    thumbnail: overrides.thumbnail || new Blob(['fake-thumb-data'], { type: 'image/webp' }),
    ...overrides
  }
}

/**
 * Create a sample album record
 */
export function sampleAlbum(overrides = {}) {
  const id = overrides.id ?? nextId()
  const now = Date.now()

  return {
    id,
    slug: overrides.slug || `test-album-${id}`,
    title: overrides.title || `Test Album ${id}`,
    is_hidden: overrides.isHidden ? 1 : 0,
    cover_image_uuid: overrides.coverImageUuid || null,
    date_created: overrides.dateCreated || now,
    date_modified: overrides.dateModified || now,
    ...overrides
  }
}

/**
 * Create a sample image-album association
 */
export function sampleImageAlbumAssociation(overrides = {}) {
  return {
    album_id: overrides.albumId ?? 1,
    image_uuid: overrides.imageUuid || `image-uuid-${nextId()}`,
    date_added: overrides.dateAdded || Date.now(),
    ...overrides
  }
}

/**
 * Create a sample AI Horde submission response
 */
export function sampleHordeResponse(overrides = {}) {
  const id = nextId()
  return {
    id: overrides.id || `horde-request-${id}`,
    kudos: overrides.kudos ?? 10,
    message: overrides.message || null,
    ...overrides
  }
}

/**
 * Create a sample AI Horde status/check response
 */
export function sampleHordeStatusResponse(overrides = {}) {
  return {
    done: overrides.done ?? false,
    faulted: overrides.faulted ?? false,
    wait_time: overrides.waitTime ?? 30,
    queue_position: overrides.queuePosition ?? 5,
    kudos: overrides.kudos ?? 10,
    is_possible: overrides.isPossible !== false,
    finished: overrides.finished ?? 0,
    processing: overrides.processing ?? 0,
    waiting: overrides.waiting ?? 1,
    generations: overrides.generations || [],
    ...overrides
  }
}

/**
 * Create a sample generation result (from /generate/status endpoint)
 */
export function sampleGeneration(overrides = {}) {
  const id = nextId()
  return {
    img: overrides.img || `https://example.com/image-${id}.png`,
    seed: overrides.seed || '12345',
    id: overrides.id || `gen-${id}`,
    censored: overrides.censored ?? false,
    worker_id: overrides.workerId || `worker-${id}`,
    worker_name: overrides.workerName || 'Test Worker',
    model: overrides.model || 'stable_diffusion',
    state: overrides.state || 'ok',
    ...overrides
  }
}

/**
 * Create a sample user response from /find_user
 */
export function sampleHordeUser(overrides = {}) {
  return {
    id: overrides.id ?? 12345,
    username: overrides.username || 'testuser',
    kudos: overrides.kudos ?? 1000,
    worker_ids: overrides.workerIds || [],
    sharedkey_ids: overrides.sharedkeyIds || [],
    ...overrides
  }
}

/**
 * Create sample settings object
 */
export function sampleSettings(overrides = {}) {
  return {
    horde_api_key: overrides.apiKey || '',
    last_used_settings: overrides.lastUsedSettings || null,
    favorite_loras: overrides.favoriteLoras || '[]',
    recent_loras: overrides.recentLoras || '[]',
    favorite_tis: overrides.favoriteTis || '[]',
    recent_tis: overrides.recentTis || '[]',
    favorite_styles: overrides.favoriteStyles || '[]',
    hidden_pin_enabled: overrides.pinEnabled ?? null,
    hidden_pin_hash: overrides.pinHash || null,
    hidden_pin_declined: overrides.pinDeclined ?? false,
    welcome_modal_dismissed: overrides.welcomeDismissed ?? false,
    ...overrides
  }
}

/**
 * Create valid request params for AI Horde API
 */
export function validRequestParams(overrides = {}) {
  return {
    prompt: overrides.prompt || 'a beautiful landscape painting',
    models: overrides.models || ['stable_diffusion'],
    params: {
      n: overrides.n ?? 1,
      width: overrides.width ?? 512,
      height: overrides.height ?? 512,
      steps: overrides.steps ?? 20,
      sampler_name: overrides.samplerName || 'k_euler',
      cfg_scale: overrides.cfgScale ?? 7,
      ...overrides.params
    },
    nsfw: overrides.nsfw ?? false,
    censor_nsfw: overrides.censorNsfw ?? true,
    ...overrides
  }
}

import * as db from './db.js'
import {
  submitGenerationRequest,
  checkGenerationStatus,
  getGenerationResult,
  cancelGeneration,
  base64ToBlob,
  generateThumbnail,
  downloadImage
} from './horde.js'

function generateUuid() {
  return crypto.randomUUID()
}

let pollingIntervals = new Map()

async function startPollingRequest(requestUuid, hordeRequestId) {
  if (pollingIntervals.has(requestUuid)) {
    return
  }

  const pollFn = async () => {
    try {
      const request = await db.get('requests', requestUuid)
      if (!request || request.status === 'completed' || request.status === 'cancelled') {
        stopPollingRequest(requestUuid)
        return
      }

      const status = await checkGenerationStatus(hordeRequestId)
      console.log('[Demo] Poll status for', requestUuid.substring(0, 8), ':', status)

      // Update request with all status fields from AI Horde
      const updatedRequest = {
        ...request,
        queue_position: status.queue_position,
        wait_time: status.wait_time,
        waiting: status.waiting,
        processing: status.processing,
        finished: status.finished,
        is_possible: status.is_possible,
        kudos: status.kudos
      }

      // Update status based on processing state
      if (status.processing > 0) {
        updatedRequest.status = 'processing'
      }

      await db.put('requests', updatedRequest)

      if (status.done) {
        // Stop polling FIRST to prevent race condition where another poll
        // fires while we're still processing images
        stopPollingRequest(requestUuid)
        const result = await getGenerationResult(hordeRequestId)
        await processGenerationResult(requestUuid, result)
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }

  pollFn()
  const intervalId = setInterval(pollFn, 3000)
  pollingIntervals.set(requestUuid, intervalId)
}

function stopPollingRequest(requestUuid) {
  const intervalId = pollingIntervals.get(requestUuid)
  if (intervalId) {
    clearInterval(intervalId)
    pollingIntervals.delete(requestUuid)
  }
}

async function processGenerationResult(requestUuid, result) {
  const request = await db.get('requests', requestUuid)
  if (!request) return

  // Guard against double-processing
  if (request.status === 'completed') {
    console.log(`[Demo] Request ${requestUuid.substring(0, 8)} already completed, skipping`)
    return
  }

  const generations = result.generations || []
  console.log(`[Demo] Processing ${generations.length} generations for request ${requestUuid}`)

  let successCount = 0

  for (let i = 0; i < generations.length; i++) {
    const gen = generations[i]
    const imageUuid = generateUuid()

    try {
      let imageBlob = null

      if (gen.img) {
        console.log(`[Demo] Processing generation ${i + 1}/${generations.length}`, gen.img?.substring(0, 50))

        if (gen.img.startsWith('http')) {
          // URL-based image
          imageBlob = await downloadImage(gen.img)
        } else if (gen.img.startsWith('data:')) {
          // Data URL
          const base64 = gen.img.split(',')[1]
          imageBlob = base64ToBlob(base64)
        } else {
          // Raw base64
          imageBlob = base64ToBlob(gen.img)
        }
      }

      if (imageBlob) {
        const thumbnailBlob = await generateThumbnail(imageBlob)

        await db.put('imageBlobs', {
          uuid: imageUuid,
          fullImage: imageBlob,
          thumbnail: thumbnailBlob
        })

        const fullRequest = JSON.parse(request.full_request || '{}')
        const promptSimple = fullRequest.prompt?.split('###')[0]?.trim() || ''

        const imageRecord = {
          uuid: imageUuid,
          request_id: requestUuid,
          prompt_simple: promptSimple,
          full_request: request.full_request,
          full_response: JSON.stringify(gen),
          seed: gen.seed || '',
          model: gen.model || '',
          worker_id: gen.worker_id || '',
          worker_name: gen.worker_name || '',
          is_favorite: false,
          is_hidden: false,
          date_created: new Date().toISOString()
        }

        await db.put('images', imageRecord)
        successCount++
        console.log(`[Demo] Successfully saved image ${i + 1}/${generations.length}`)
      } else {
        console.warn(`[Demo] No image blob for generation ${i + 1}`, gen)
      }
    } catch (error) {
      console.error(`[Demo] Error processing generation ${i + 1}:`, error)
      // Continue with other generations even if one fails
    }
  }

  console.log(`[Demo] Completed request ${requestUuid}: ${successCount}/${generations.length} images saved`)

  await db.put('requests', {
    ...request,
    status: 'completed',
    finished: successCount,
    date_completed: new Date().toISOString()
  })
}

export const requestsApi = {
  async getAll(limit = 100) {
    const requests = await db.getAllWithCursor('requests', {
      indexName: 'date_created',
      direction: 'prev',
      limit
    })
    return { data: requests }
  },

  async getById(id) {
    const request = await db.get('requests', id)
    return { data: request }
  },

  async create(data) {
    const uuid = generateUuid()
    const now = new Date().toISOString()

    try {
      // The server API receives { prompt, params } where params is the full request object
      // We need to use params as the actual request to AI Horde
      const hordeRequestData = data.params || data

      console.log('[Demo] Submitting generation request:', JSON.stringify(hordeRequestData, null, 2))

      const hordeResponse = await submitGenerationRequest(hordeRequestData)

      // Extract prompt from the horde request data
      const promptSimple = hordeRequestData.prompt?.split('###')[0]?.trim() || ''
      // Get n from params.n (AI Horde format)
      const imageCount = hordeRequestData.params?.n || 1

      const request = {
        uuid,
        horde_request_id: hordeResponse.id,
        full_request: JSON.stringify(hordeRequestData),
        prompt: promptSimple,
        n: imageCount,
        status: 'pending',
        queue_position: null,
        waiting: 0,
        processing: 0,
        finished: 0,
        date_created: now
      }

      await db.put('requests', request)

      startPollingRequest(uuid, hordeResponse.id)

      return { data: request }
    } catch (error) {
      console.error('[Demo] Error creating request:', error)
      throw new Error(error.message || 'Failed to submit generation request')
    }
  },

  async delete(id, imageAction = null) {
    const request = await db.get('requests', id)
    if (!request) return

    stopPollingRequest(id)

    if (request.horde_request_id && request.status !== 'completed') {
      try {
        await cancelGeneration(request.horde_request_id)
      } catch (e) {
        // Ignore cancellation errors
      }
    }

    // Handle image actions
    const images = await db.getAllWithCursor('images', {
      filter: img => img.request_id === id
    })

    if (imageAction === 'prune') {
      // Delete images that are NOT favorited AND NOT hidden
      for (const img of images) {
        if (!img.is_favorite && !img.is_hidden) {
          await db.remove('imageBlobs', img.uuid)
          await db.remove('images', img.uuid)
        }
      }
    } else if (imageAction === 'hide') {
      // Mark all images as hidden
      for (const img of images) {
        await db.put('images', { ...img, is_hidden: 1 })
      }
    } else if (imageAction === 'delete') {
      // Delete all images
      for (const img of images) {
        await db.remove('imageBlobs', img.uuid)
        await db.remove('images', img.uuid)
      }
    }
    // 'keep' and 'cancel' don't touch images

    await db.remove('requests', id)
  },

  async deleteAll(imageAction = null) {
    const requests = await db.getAll('requests')

    for (const request of requests) {
      stopPollingRequest(request.uuid)

      if (request.horde_request_id && request.status !== 'completed') {
        try {
          await cancelGeneration(request.horde_request_id)
        } catch (e) {
          // Ignore
        }
      }
    }

    // Handle image actions
    if (imageAction === 'prune') {
      // Delete images that are NOT favorited AND NOT hidden
      const images = await db.getAll('images')
      for (const img of images) {
        if (!img.is_favorite && !img.is_hidden) {
          await db.remove('imageBlobs', img.uuid)
          await db.remove('images', img.uuid)
        }
      }
    } else if (imageAction === 'hide') {
      // Mark all images as hidden
      const images = await db.getAll('images')
      for (const img of images) {
        await db.put('images', { ...img, is_hidden: 1 })
      }
    } else if (imageAction === 'delete') {
      // Delete all images
      await db.clear('imageBlobs')
      await db.clear('images')
    }
    // 'keep' and 'cancel' don't touch images

    await db.clear('requests')
  },

  async getQueueStatus() {
    const requests = await db.getAll('requests')
    const activeRequests = requests.filter(r =>
      r.status === 'pending' || r.status === 'processing'
    )

    let totalWaiting = 0
    let totalProcessing = 0

    for (const req of activeRequests) {
      totalWaiting += req.waiting || 0
      totalProcessing += req.processing || 0
    }

    // Match the field names expected by useImagePolling composable
    return {
      data: {
        pendingRequests: activeRequests.length,
        active: totalProcessing,
        waiting: totalWaiting,
        processing: totalProcessing
      }
    }
  }
}

export function resumePolling() {
  db.getAll('requests').then(requests => {
    console.log('[Demo] Resuming polling for pending requests...')
    for (const request of requests) {
      // Resume polling for both pending and processing requests
      const isActive = request.status === 'pending' || request.status === 'processing'
      if (isActive && request.horde_request_id) {
        console.log('[Demo] Resuming poll for request:', request.uuid.substring(0, 8))
        startPollingRequest(request.uuid, request.horde_request_id)
      }
    }
  })
}

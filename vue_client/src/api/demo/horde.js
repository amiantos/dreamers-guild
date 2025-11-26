const HORDE_API_BASE = 'https://aihorde.net/api/v2'

function getApiKey() {
  const settings = localStorage.getItem('demoSettings')
  if (settings) {
    const parsed = JSON.parse(settings)
    return parsed.horde_api_key || '0000000000'
  }
  return '0000000000'
}

async function hordeRequest(endpoint, options = {}) {
  const apiKey = getApiKey()
  const url = `${HORDE_API_BASE}${endpoint}`

  const headers = {
    'Content-Type': 'application/json',
    'apikey': apiKey,
    'Client-Agent': 'aislingeach-demo:1.0.0:github.com/amiantos/aislingeach-web',
    ...options.headers
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `Horde API error: ${response.status}`)
  }

  return response.json()
}

export async function submitGenerationRequest(requestData) {
  return hordeRequest('/generate/async', {
    method: 'POST',
    body: JSON.stringify(requestData)
  })
}

export async function checkGenerationStatus(requestId) {
  return hordeRequest(`/generate/check/${requestId}`)
}

export async function getGenerationResult(requestId) {
  return hordeRequest(`/generate/status/${requestId}`)
}

export async function cancelGeneration(requestId) {
  return hordeRequest(`/generate/status/${requestId}`, {
    method: 'DELETE'
  })
}

export async function getHordeUser() {
  return hordeRequest('/find_user')
}

export async function getHordeWorkers() {
  const user = await getHordeUser()
  if (!user.worker_ids || user.worker_ids.length === 0) {
    return []
  }

  const workers = await Promise.all(
    user.worker_ids.map(id => hordeRequest(`/workers/${id}`))
  )
  return workers
}

export async function updateHordeWorker(workerId, data) {
  return hordeRequest(`/workers/${workerId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function getHordeSharedKeys() {
  const user = await getHordeUser()
  if (!user.sharedkey_ids || user.sharedkey_ids.length === 0) {
    return []
  }

  const keys = await Promise.all(
    user.sharedkey_ids.map(id => hordeRequest(`/sharedkeys/${id}`))
  )
  return keys
}

export async function createHordeSharedKey(data) {
  return hordeRequest('/sharedkeys', {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function updateHordeSharedKey(keyId, data) {
  return hordeRequest(`/sharedkeys/${keyId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export async function deleteHordeSharedKey(keyId) {
  return hordeRequest(`/sharedkeys/${keyId}`, {
    method: 'DELETE'
  })
}

export async function getHordeModels() {
  return hordeRequest('/status/models?type=image')
}

export async function getHordeStyles() {
  const response = await fetch('https://raw.githubusercontent.com/Haidra-Org/AI-Horde-Styles/main/styles.json')
  if (!response.ok) {
    throw new Error('Failed to fetch styles')
  }
  return response.json()
}

export async function estimateKudos(params) {
  return hordeRequest('/generate/async', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      dry_run: true
    })
  })
}

export async function downloadImage(url) {
  try {
    // AI Horde image URLs may have CORS issues, so we need to handle them
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit'
    })
    if (!response.ok) {
      console.error('Failed to download image:', response.status, url)
      throw new Error(`Failed to download image: ${response.status}`)
    }
    return response.blob()
  } catch (error) {
    console.error('Error downloading image from:', url, error)
    throw error
  }
}

export function base64ToBlob(base64, mimeType = 'image/webp') {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

export async function generateThumbnail(blob, maxSize = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      let { width, height } = img
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (thumbnailBlob) => {
          if (thumbnailBlob) {
            resolve(thumbnailBlob)
          } else {
            reject(new Error('Failed to generate thumbnail'))
          }
        },
        'image/webp',
        0.8
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for thumbnail'))
    }

    img.src = url
  })
}

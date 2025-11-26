import axios from 'axios'

const devApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8005/api'
const baseURL = import.meta.env.PROD ? '/api' : devApiUrl

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const requestsApi = {
  getAll(limit = 100) {
    return apiClient.get(`/requests?limit=${limit}`)
  },

  getById(id) {
    return apiClient.get(`/requests/${id}`)
  },

  create(data) {
    return apiClient.post('/requests', data)
  },

  delete(id, imageAction = null) {
    const params = imageAction ? `?imageAction=${imageAction}` : ''
    return apiClient.delete(`/requests/${id}${params}`)
  },

  deleteAll(imageAction = null) {
    const params = imageAction ? `?imageAction=${imageAction}` : ''
    return apiClient.delete(`/requests${params}`)
  },

  getQueueStatus() {
    return apiClient.get('/requests/queue/status')
  }
}

export const imagesApi = {
  /**
   * Get images with optional flexible filters
   * @param {number} limit - Max results
   * @param {number} offset - Pagination offset
   * @param {Object} options - Filter options
   * @param {boolean} options.showFavoritesOnly - Only show favorites
   * @param {boolean} options.showHidden - Include hidden images
   * @param {Array} options.filterCriteria - Array of {type, value} filters
   */
  getAll(limit = 100, offset = 0, options = {}) {
    let url = `/images?limit=${limit}&offset=${offset}`
    if (options.showFavoritesOnly) {
      url += '&favorites=true'
    }
    if (options.showHidden) {
      url += '&includeHidden=true'
    }
    if (options.filterCriteria && options.filterCriteria.length > 0) {
      url += `&filters=${encodeURIComponent(JSON.stringify(options.filterCriteria))}`
    }
    return apiClient.get(url)
  },

  getByRequestId(requestId, limit = 100) {
    return apiClient.get(`/images/request/${requestId}?limit=${limit}`)
  },

  search(keywords, limit = 100, offset = 0, filters = {}) {
    let url = `/images/search?q=${encodeURIComponent(keywords)}&limit=${limit}&offset=${offset}`
    if (filters.showFavoritesOnly) {
      url += '&favorites=true'
    }
    if (filters.showHidden) {
      url += '&includeHidden=true'
    }
    return apiClient.get(url)
  },

  getById(id) {
    return apiClient.get(`/images/${id}`)
  },

  getThumbnailUrl(id) {
    return `${baseURL}/images/${id}/thumbnail`
  },

  getImageUrl(id) {
    return `${baseURL}/images/${id}/file`
  },

  update(id, data) {
    return apiClient.patch(`/images/${id}`, data)
  },

  delete(id) {
    return apiClient.delete(`/images/${id}`)
  },

  batchUpdate(imageIds, updates) {
    return apiClient.put('/images/batch', { imageIds, updates })
  },

  estimate(params) {
    return apiClient.post('/requests/estimate', { params })
  }
}

export const settingsApi = {
  get() {
    return apiClient.get('/settings').then(res => res.data)
  },

  update(data) {
    return apiClient.patch('/settings', data).then(res => res.data)
  },

  getHordeUser() {
    return apiClient.get('/settings/horde-user').then(res => res.data)
  },

  // Horde workers management
  getHordeWorkers() {
    return apiClient.get('/settings/horde-workers').then(res => res.data)
  },

  updateHordeWorker(workerId, data) {
    return apiClient.put(`/settings/horde-workers/${workerId}`, data).then(res => res.data)
  },

  // Horde shared keys management
  getHordeSharedKeys() {
    return apiClient.get('/settings/horde-shared-keys').then(res => res.data)
  },

  createHordeSharedKey(data) {
    return apiClient.post('/settings/horde-shared-keys', data).then(res => res.data)
  },

  updateHordeSharedKey(keyId, data) {
    return apiClient.patch(`/settings/horde-shared-keys/${keyId}`, data).then(res => res.data)
  },

  deleteHordeSharedKey(keyId) {
    return apiClient.delete(`/settings/horde-shared-keys/${keyId}`).then(res => res.data)
  },

  // PIN management
  setupHiddenPin(pin, declined = false) {
    return apiClient.post('/settings/hidden-pin/setup', { pin, declined }).then(res => res.data)
  },

  verifyHiddenPin(pin) {
    return apiClient.post('/settings/hidden-pin/verify', { pin }).then(res => res.data)
  },

  changeHiddenPin(currentPin, newPin) {
    return apiClient.patch('/settings/hidden-pin', { currentPin, newPin }).then(res => res.data)
  },

  removeHiddenPin(pin) {
    return apiClient.delete('/settings/hidden-pin', { data: { pin } }).then(res => res.data)
  }
}

export const stylesApi = {
  getAll() {
    return apiClient.get('/styles')
  },

  refresh() {
    return apiClient.post('/styles/refresh')
  }
}

export const albumsApi = {
  getAll(filters = {}) {
    let url = '/albums'
    const params = []
    if (filters.showFavoritesOnly) {
      params.push('favorites=true')
    }
    if (filters.showHidden) {
      params.push('includeHidden=true')
    }
    if (params.length > 0) {
      url += '?' + params.join('&')
    }
    return apiClient.get(url)
  }
}

export default apiClient

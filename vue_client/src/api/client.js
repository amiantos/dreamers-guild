import axios from 'axios'

const baseURL = import.meta.env.PROD ? '/api' : 'http://localhost:8005/api'

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

  getQueueStatus() {
    return apiClient.get('/requests/queue/status')
  }
}

export const imagesApi = {
  getAll(limit = 100, offset = 0, filters = {}) {
    let url = `/images?limit=${limit}&offset=${offset}`
    if (filters.showFavoritesOnly) {
      url += '&favorites=true'
    }
    if (filters.showHidden) {
      url += '&hidden=true'
    }
    return apiClient.get(url)
  },

  getByRequestId(requestId, limit = 100) {
    return apiClient.get(`/images/request/${requestId}?limit=${limit}`)
  },

  search(keywords, limit = 100, filters = {}) {
    let url = `/images/search?q=${encodeURIComponent(keywords)}&limit=${limit}`
    if (filters.showFavoritesOnly) {
      url += '&favorites=true'
    }
    if (filters.showHidden) {
      url += '&hidden=true'
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

  getByCategory(category) {
    return apiClient.get(`/styles/category/${category}`)
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
      params.push('hidden=true')
    }
    if (params.length > 0) {
      url += '?' + params.join('&')
    }
    return apiClient.get(url)
  }
}

export default apiClient

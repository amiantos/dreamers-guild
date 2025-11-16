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
  getAll(limit = 100, offset = 0) {
    return apiClient.get(`/images?limit=${limit}&offset=${offset}`)
  },

  getByRequestId(requestId, limit = 100) {
    return apiClient.get(`/images/request/${requestId}?limit=${limit}`)
  },

  search(keywords, limit = 100) {
    return apiClient.get(`/images/search?q=${encodeURIComponent(keywords)}&limit=${limit}`)
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
    return apiClient.get('/settings')
  },

  update(data) {
    return apiClient.patch('/settings', data)
  },

  getHordeUser() {
    return apiClient.get('/settings/horde-user')
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

export default apiClient

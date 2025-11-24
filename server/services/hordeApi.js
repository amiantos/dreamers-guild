import axios from 'axios';
import dotenv from 'dotenv';
import { UserSettings } from '../db/models.js';

dotenv.config();

const HORDE_API_BASE = 'https://stablehorde.net/api/v2';

// AI Horde API Client
class HordeAPI {
  constructor() {
    this.baseURL = HORDE_API_BASE;
  }

  /**
   * Get the API key from user settings or fallback to environment variable
   */
  getApiKey() {
    try {
      const settings = UserSettings.get();
      if (settings && settings.api_key) {
        return settings.api_key;
      }
    } catch (error) {
      console.error('Error getting API key from settings:', error);
    }
    return process.env.HORDE_API_KEY || '0000000000';
  }

  /**
   * Get an axios client with the current API key
   */
  getClient() {
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.getApiKey()
      }
    });
  }

  /**
   * Submit an async image generation request
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Response with request ID
   */
  async postImageAsyncGenerate(params) {
    try {
      const client = this.getClient();
      const response = await client.post('/generate/async', params);
      return response.data;
    } catch (error) {
      console.error('Error submitting generation request:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Check the status of an image generation request
   * @param {string} requestId - The request ID to check
   * @returns {Promise<Object>} Status information
   */
  async getImageAsyncCheck(requestId) {
    try {
      const client = this.getClient();
      const response = await client.get(`/generate/check/${requestId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Request not found');
      }
      console.error('Error checking request status:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get the generated images for a completed request
   * @param {string} requestId - The request ID
   * @returns {Promise<Object>} Generated images data
   */
  async getImageAsyncStatus(requestId) {
    try {
      const client = this.getClient();
      const response = await client.get(`/generate/status/${requestId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting generation status:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Download an image from URL
   * @param {string} url - Image URL
   * @returns {Promise<Buffer>} Image data
   */
  async downloadImage(url) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading image:', error.message);
      throw error;
    }
  }

  /**
   * Get user info
   * @returns {Promise<Object>} User information
   */
  async getUserInfo() {
    try {
      const client = this.getClient();
      const response = await client.get('/find_user');
      return response.data;
    } catch (error) {
      console.error('Error getting user info:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cancel an ongoing image generation request
   * @param {string} requestId - The request ID to cancel
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelRequest(requestId) {
    try {
      const client = this.getClient();
      const response = await client.delete(`/generate/status/${requestId}`);
      return response.data;
    } catch (error) {
      // 404 means request was already completed/cancelled, which is fine
      if (error.response?.status === 404) {
        console.log(`Request ${requestId} already completed or cancelled`);
        return { cancelled: false, message: 'Already completed or not found' };
      }
      console.error('Error cancelling request:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get details for multiple workers by ID
   * @param {string[]} workerIds - Array of worker IDs
   * @returns {Promise<Object[]>} Array of worker details
   */
  async getUserWorkers(workerIds) {
    try {
      if (!workerIds || workerIds.length === 0) {
        return [];
      }
      const client = this.getClient();
      const promises = workerIds.map(id =>
        client.get(`/workers/${id}`).then(res => res.data).catch(err => {
          console.error(`Error fetching worker ${id}:`, err.message);
          return null;
        })
      );
      const results = await Promise.all(promises);
      return results.filter(worker => worker !== null);
    } catch (error) {
      console.error('Error fetching user workers:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update a worker's settings
   * @param {string} workerId - The worker ID
   * @param {Object} settings - Worker settings to update
   * @returns {Promise<Object>} Updated worker data
   */
  async updateWorker(workerId, settings) {
    try {
      const client = this.getClient();
      const response = await client.put(`/workers/${workerId}`, settings);
      return response.data;
    } catch (error) {
      console.error(`Error updating worker ${workerId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get details for multiple shared keys by ID
   * @param {string[]} sharedKeyIds - Array of shared key IDs
   * @returns {Promise<Object[]>} Array of shared key details
   */
  async getSharedKeys(sharedKeyIds) {
    try {
      if (!sharedKeyIds || sharedKeyIds.length === 0) {
        return [];
      }
      const client = this.getClient();
      const promises = sharedKeyIds.map(id =>
        client.get(`/sharedkeys/${id}`).then(res => res.data).catch(err => {
          console.error(`Error fetching shared key ${id}:`, err.message);
          return null;
        })
      );
      const results = await Promise.all(promises);
      return results.filter(key => key !== null);
    } catch (error) {
      console.error('Error fetching shared keys:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a new shared key
   * @param {Object} data - Shared key configuration (name, kudos, limits)
   * @returns {Promise<Object>} Created shared key data
   */
  async createSharedKey(data) {
    try {
      const client = this.getClient();
      const response = await client.put('/sharedkeys', data);
      return response.data;
    } catch (error) {
      console.error('Error creating shared key:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update an existing shared key
   * @param {string} keyId - The shared key ID
   * @param {Object} data - Updated configuration (name, kudos, limits)
   * @returns {Promise<Object>} Updated shared key data
   */
  async updateSharedKey(keyId, data) {
    try {
      const client = this.getClient();
      const response = await client.patch(`/sharedkeys/${keyId}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating shared key ${keyId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete a shared key
   * @param {string} keyId - The shared key ID to delete
   * @returns {Promise<Object>} Deletion response
   */
  async deleteSharedKey(keyId) {
    try {
      const client = this.getClient();
      const response = await client.delete(`/sharedkeys/${keyId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting shared key ${keyId}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

export default new HordeAPI();

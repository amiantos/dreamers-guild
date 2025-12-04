import axios from 'axios';
import dotenv from 'dotenv';
import { UserSettings } from '../db/models.js';

dotenv.config();

const HORDE_API_BASE = 'https://stablehorde.net/api/v2';

// AI Horde API Client
class HordeAPI {
  constructor() {
    this.baseURL = HORDE_API_BASE;
    this.lastApiCallTime = 0;
    this.minApiInterval = 1000; // 1 second minimum between API calls
    this.throttleQueue = Promise.resolve(); // Queue for serializing API calls
  }

  /**
   * Throttle API calls to ensure minimum interval between requests
   * Uses a promise chain to serialize calls and prevent race conditions
   */
  async throttle() {
    // Chain onto the queue to ensure only one call proceeds at a time
    const waitPromise = this.throttleQueue.then(async () => {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastApiCallTime;
      if (timeSinceLastCall < this.minApiInterval) {
        const waitTime = this.minApiInterval - timeSinceLastCall;
        console.log(`[RateLimit] Waiting ${waitTime}ms before next API call`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.lastApiCallTime = Date.now();
    });

    // Update the queue (catch to prevent unhandled rejection if a call fails)
    this.throttleQueue = waitPromise.catch(() => {});

    return waitPromise;
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
      timeout: 30000, // 30 second timeout for API calls
      headers: {
        'Content-Type': 'application/json',
        'Client-Agent': 'dreamers-guild:0.1:github.com/amiantos/dreamers-guild',
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
    await this.throttle();
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
    await this.throttle();
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
    await this.throttle();
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
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });
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
    await this.throttle();
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
    await this.throttle();
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
      const results = [];
      for (const id of workerIds) {
        await this.throttle();
        try {
          const response = await client.get(`/workers/${id}`);
          results.push(response.data);
        } catch (err) {
          console.error(`Error fetching worker ${id}:`, err.message);
          results.push(null);
        }
      }
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
    await this.throttle();
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
      const results = [];
      for (const id of sharedKeyIds) {
        await this.throttle();
        try {
          const response = await client.get(`/sharedkeys/${id}`);
          results.push(response.data);
        } catch (err) {
          console.error(`Error fetching shared key ${id}:`, err.message);
          results.push(null);
        }
      }
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
    await this.throttle();
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
    await this.throttle();
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
    await this.throttle();
    try {
      const client = this.getClient();
      const response = await client.delete(`/sharedkeys/${keyId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting shared key ${keyId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get the current shared key info if the user's API key is a shared key
   * @returns {Promise<Object|null>} Shared key details or null if not a shared key
   */
  async getCurrentSharedKeyInfo() {
    await this.throttle();
    try {
      const apiKey = this.getApiKey();
      if (!apiKey || apiKey === '0000000000') {
        return null;
      }
      const client = this.getClient();
      const response = await client.get(`/sharedkeys/${apiKey}`);
      return response.data;
    } catch (error) {
      // Not a shared key or not found - return null
      return null;
    }
  }

  /**
   * Validate a shared key without requiring user authentication
   * Uses anonymous API key to fetch shared key details
   * @param {string} keyId - The shared key ID to validate
   * @returns {Promise<Object>} Shared key details if valid
   */
  async validateSharedKey(keyId) {
    await this.throttle();
    try {
      // Use anonymous client - shared key lookup is public
      const client = axios.create({
        baseURL: this.baseURL,
        timeout: 30000, // 30 second timeout for API calls
        headers: {
          'Content-Type': 'application/json',
          'Client-Agent': 'dreamers-guild:0.1:github.com/amiantos/dreamers-guild',
          'apikey': '0000000000'
        }
      });
      const response = await client.get(`/sharedkeys/${keyId}`);
      return response.data;
    } catch (error) {
      console.error(`Error validating shared key ${keyId}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

export default new HordeAPI();

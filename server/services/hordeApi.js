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
}

export default new HordeAPI();

import express from 'express';
import { UserSettings } from '../db/models.js';
import hordeApi from '../services/hordeApi.js';

const router = express.Router();

// Get user settings
router.get('/', (req, res) => {
  try {
    const settings = UserSettings.get();
    // Don't send the full API key to the client for security
    const sanitized = {
      ...settings,
      api_key: settings.api_key ? '***' : null,
      hasApiKey: !!settings.api_key
    };
    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update user settings
router.patch('/', (req, res) => {
  try {
    const updated = UserSettings.update(req.body);
    // Don't send the full API key to the client
    const sanitized = {
      ...updated,
      api_key: updated.api_key ? '***' : null,
      hasApiKey: !!updated.api_key
    };
    res.json(sanitized);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get user info from AI Horde
router.get('/horde-user', async (req, res) => {
  try {
    const userInfo = await hordeApi.getUserInfo();
    res.json(userInfo);
  } catch (error) {
    console.error('Error fetching horde user info:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

export default router;

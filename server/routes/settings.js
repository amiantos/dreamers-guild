import express from 'express';
import bcrypt from 'bcrypt';
import { UserSettings } from '../db/models.js';
import hordeApi from '../services/hordeApi.js';

const router = express.Router();
const SALT_ROUNDS = 10;

// Get user settings
router.get('/', (req, res) => {
  try {
    const settings = UserSettings.get();
    // Don't send the full API key or PIN hash to the client for security
    const sanitized = {
      ...settings,
      api_key: settings.api_key ? '***' : null,
      hasApiKey: !!settings.api_key,
      hidden_pin_hash: undefined,  // Never send the hash
      hasPinProtection: !!settings.hidden_pin_hash
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
    // Don't send the full API key or PIN hash to the client
    const sanitized = {
      ...updated,
      api_key: updated.api_key ? '***' : null,
      hasApiKey: !!updated.api_key,
      hidden_pin_hash: undefined,  // Never send the hash
      hasPinProtection: !!updated.hidden_pin_hash
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

// Get user's workers from AI Horde
router.get('/horde-workers', async (req, res) => {
  try {
    const userInfo = await hordeApi.getUserInfo();
    const workers = await hordeApi.getUserWorkers(userInfo.worker_ids || []);
    res.json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// Update a worker
router.put('/horde-workers/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    const result = await hordeApi.updateWorker(workerId, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating worker:', error);
    res.status(500).json({ error: 'Failed to update worker' });
  }
});

// Get user's shared keys from AI Horde
router.get('/horde-shared-keys', async (req, res) => {
  try {
    const userInfo = await hordeApi.getUserInfo();
    const sharedKeys = await hordeApi.getSharedKeys(userInfo.sharedkey_ids || []);
    res.json(sharedKeys);
  } catch (error) {
    console.error('Error fetching shared keys:', error);
    res.status(500).json({ error: 'Failed to fetch shared keys' });
  }
});

// Create a new shared key
router.post('/horde-shared-keys', async (req, res) => {
  try {
    const result = await hordeApi.createSharedKey(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error creating shared key:', error);
    res.status(500).json({ error: 'Failed to create shared key' });
  }
});

// Update a shared key
router.patch('/horde-shared-keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const result = await hordeApi.updateSharedKey(keyId, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating shared key:', error);
    res.status(500).json({ error: 'Failed to update shared key' });
  }
});

// Delete a shared key
router.delete('/horde-shared-keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const result = await hordeApi.deleteSharedKey(keyId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting shared key:', error);
    res.status(500).json({ error: 'Failed to delete shared key' });
  }
});

// Setup hidden gallery PIN (first time) or decline protection
router.post('/hidden-pin/setup', async (req, res) => {
  try {
    const { pin, declined } = req.body;
    const settings = UserSettings.get();

    // Check if PIN is already configured
    if (settings.hidden_pin_enabled !== null) {
      return res.status(400).json({ error: 'PIN already configured' });
    }

    if (declined) {
      // User explicitly declined PIN protection
      UserSettings.update({
        hiddenPinEnabled: 0,
        hiddenPinHash: null
      });
      return res.json({ success: true, declined: true });
    }

    // Validate PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    // Hash and save PIN
    const hash = await bcrypt.hash(pin, SALT_ROUNDS);
    UserSettings.update({
      hiddenPinEnabled: 1,
      hiddenPinHash: hash
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting up PIN:', error);
    res.status(500).json({ error: 'Failed to setup PIN' });
  }
});

// Verify hidden gallery PIN
router.post('/hidden-pin/verify', async (req, res) => {
  try {
    const { pin } = req.body;
    const settings = UserSettings.get();

    // Check if PIN protection is enabled
    if (!settings.hidden_pin_hash) {
      return res.status(400).json({ error: 'No PIN configured' });
    }

    // Validate PIN format
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'Invalid PIN format' });
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, settings.hidden_pin_hash);

    if (isValid) {
      res.json({ success: true, valid: true });
    } else {
      res.json({ success: true, valid: false });
    }
  } catch (error) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// Change hidden gallery PIN
router.patch('/hidden-pin', async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    const settings = UserSettings.get();

    // Check if PIN protection is enabled
    if (!settings.hidden_pin_hash) {
      return res.status(400).json({ error: 'No PIN configured' });
    }

    // Validate current PIN
    const isValid = await bcrypt.compare(currentPin, settings.hidden_pin_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    // Validate new PIN
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
    }

    // Hash and save new PIN
    const hash = await bcrypt.hash(newPin, SALT_ROUNDS);
    UserSettings.update({
      hiddenPinHash: hash
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error changing PIN:', error);
    res.status(500).json({ error: 'Failed to change PIN' });
  }
});

// Remove hidden gallery PIN protection
router.delete('/hidden-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    const settings = UserSettings.get();

    // Check if PIN protection is enabled
    if (!settings.hidden_pin_hash) {
      return res.status(400).json({ error: 'No PIN configured' });
    }

    // Validate PIN
    const isValid = await bcrypt.compare(pin, settings.hidden_pin_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'PIN is incorrect' });
    }

    // Remove PIN
    UserSettings.update({
      hiddenPinEnabled: 0,
      hiddenPinHash: null
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing PIN:', error);
    res.status(500).json({ error: 'Failed to remove PIN' });
  }
});

export default router;

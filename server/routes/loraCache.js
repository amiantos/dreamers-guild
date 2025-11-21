import express from 'express';
import { LoraCache } from '../db/models.js';

const router = express.Router();

// Get single cached LoRA by version ID
router.get('/:versionId', (req, res) => {
  try {
    const { versionId } = req.params;
    const cached = LoraCache.get(versionId);

    if (cached) {
      res.json(cached.full_metadata);
    } else {
      res.status(404).json({ error: 'LoRA not found in cache' });
    }
  } catch (error) {
    console.error('Error fetching cached LoRA:', error);
    res.status(500).json({ error: 'Failed to fetch cached LoRA' });
  }
});

// Get multiple cached LoRAs (batch)
router.post('/batch', (req, res) => {
  try {
    const { versionIds } = req.body;

    if (!Array.isArray(versionIds)) {
      return res.status(400).json({ error: 'versionIds must be an array' });
    }

    const results = LoraCache.getMultiple(versionIds);

    // Return as a map: versionId -> full_metadata
    const resultMap = {};
    results.forEach(item => {
      resultMap[item.version_id] = item.full_metadata;
    });

    res.json(resultMap);
  } catch (error) {
    console.error('Error fetching cached LoRAs:', error);
    res.status(500).json({ error: 'Failed to fetch cached LoRAs' });
  }
});

// Store single LoRA metadata
router.post('/', (req, res) => {
  try {
    const lora = req.body;

    if (!lora.versionId || !lora.id) {
      return res.status(400).json({ error: 'LoRA must have versionId and id' });
    }

    const result = LoraCache.set(
      String(lora.versionId),
      String(lora.id),
      lora
    );

    res.json({ success: true, cached: result });
  } catch (error) {
    console.error('Error caching LoRA:', error);
    res.status(500).json({ error: 'Failed to cache LoRA' });
  }
});

// Store multiple LoRAs (batch)
router.post('/batch-store', (req, res) => {
  try {
    const { loras } = req.body;

    if (!Array.isArray(loras)) {
      return res.status(400).json({ error: 'loras must be an array' });
    }

    const count = LoraCache.setMultiple(loras);

    res.json({ success: true, count });
  } catch (error) {
    console.error('Error caching LoRAs:', error);
    res.status(500).json({ error: 'Failed to cache LoRAs' });
  }
});

// Cleanup old cache entries (optional maintenance endpoint)
router.delete('/cleanup', (req, res) => {
  try {
    const { maxAgeMs } = req.query;
    const deleted = LoraCache.cleanup(maxAgeMs ? parseInt(maxAgeMs) : undefined);

    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Error cleaning up cache:', error);
    res.status(500).json({ error: 'Failed to cleanup cache' });
  }
});

export default router;

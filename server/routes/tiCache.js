/**
 * Textual Inversion Cache Routes
 *
 * Read-only endpoints for accessing cached TI metadata.
 * Cache population is handled automatically by civitaiService.js
 */

import express from 'express';
import { TiCache } from '../db/models.js';

const router = express.Router();

// Get single cached TI by version ID
router.get('/:versionId', (req, res) => {
  try {
    const { versionId } = req.params;
    const cached = TiCache.get(versionId);

    if (cached) {
      res.json(cached.full_metadata);
    } else {
      res.status(404).json({ error: 'Textual Inversion not found in cache' });
    }
  } catch (error) {
    console.error('Error fetching cached TI:', error);
    res.status(500).json({ error: 'Failed to fetch cached TI' });
  }
});

// Get multiple cached TIs (batch)
router.post('/batch', (req, res) => {
  try {
    const { versionIds } = req.body;

    if (!Array.isArray(versionIds)) {
      return res.status(400).json({ error: 'versionIds must be an array' });
    }

    const results = TiCache.getMultiple(versionIds);

    // Return as a map: versionId -> full_metadata
    const resultMap = {};
    results.forEach(item => {
      resultMap[item.version_id] = item.full_metadata;
    });

    res.json(resultMap);
  } catch (error) {
    console.error('Error fetching cached TIs:', error);
    res.status(500).json({ error: 'Failed to fetch cached TIs' });
  }
});

// Cleanup old cache entries (optional maintenance endpoint)
router.delete('/cleanup', (req, res) => {
  try {
    const { maxAgeMs } = req.query;
    const deleted = TiCache.cleanup(maxAgeMs ? parseInt(maxAgeMs) : undefined);

    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Error cleaning up cache:', error);
    res.status(500).json({ error: 'Failed to cleanup cache' });
  }
});

export default router;

/**
 * CivitAI Proxy Routes
 * Proxy requests to CivitAI API through the server
 */

import express from 'express';
import { searchLoras, getLoraById, getLoraByVersionId } from '../services/civitaiService.js';

const router = express.Router();

/**
 * POST /api/civitai/search
 * Search for LoRAs
 */
router.post('/search', async (req, res) => {
  try {
    const {
      query = '',
      page = 1,
      limit = 100,
      baseModelFilters = [],
      nsfw = false,
      sort = 'Highest Rated',
      url = null
    } = req.body;

    const results = await searchLoras({
      query,
      page,
      limit,
      baseModelFilters,
      nsfw,
      sort,
      url
    });

    res.json(results);
  } catch (error) {
    console.error('[CivitAI API] Error searching LoRAs:', error);
    res.status(500).json({ error: 'Failed to search LoRAs' });
  }
});

/**
 * GET /api/civitai/models/:modelId
 * Get a specific LoRA model by ID
 */
router.get('/models/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;

    const model = await getLoraById(modelId);

    res.json(model);
  } catch (error) {
    console.error(`[CivitAI API] Error fetching model ${req.params.modelId}:`, error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

/**
 * GET /api/civitai/model-versions/:versionId
 * Get a LoRA model by version ID
 */
router.get('/model-versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;

    const model = await getLoraByVersionId(versionId);

    res.json(model);
  } catch (error) {
    console.error(`[CivitAI API] Error fetching version ${req.params.versionId}:`, error);
    res.status(500).json({ error: 'Failed to fetch version' });
  }
});

export default router;

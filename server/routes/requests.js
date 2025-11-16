import express from 'express';
import { HordeRequest, GeneratedImage, HordePendingDownload } from '../db/models.js';
import queueManager from '../services/queueManager.js';
import hordeApi from '../services/hordeApi.js';

const router = express.Router();

// Get all requests
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const requests = HordeRequest.findAll(limit);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get a single request
router.get('/:id', (req, res) => {
  try {
    const request = HordeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// Create a new request
router.post('/', (req, res) => {
  try {
    const { prompt, params } = req.body;

    if (!prompt || !params) {
      return res.status(400).json({ error: 'Missing required fields: prompt, params' });
    }

    const request = queueManager.addRequest({ prompt, params });
    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Delete a request
router.delete('/:id', (req, res) => {
  try {
    const { imageAction } = req.query; // 'prune' or 'keep'
    const requestId = req.params.id;

    // Delete any pending downloads for this request
    const pendingDownloads = HordePendingDownload.findAll().filter(d => d.request_id === requestId);
    pendingDownloads.forEach(d => HordePendingDownload.delete(d.uuid));

    if (imageAction === 'prune') {
      // Delete all non-favorited images (for now, all images since favoriting doesn't exist)
      const images = GeneratedImage.findByRequestId(requestId);
      images.forEach(img => {
        if (!img.is_favorite) {
          GeneratedImage.delete(img.uuid);
        }
      });
    } else if (imageAction === 'keep') {
      // Keep all images by removing the request_id reference
      const images = GeneratedImage.findByRequestId(requestId);
      images.forEach(img => {
        GeneratedImage.update(img.uuid, { requestId: null });
      });
    }

    // Now delete the request
    HordeRequest.delete(requestId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

// Get queue status
router.get('/queue/status', (req, res) => {
  try {
    const status = queueManager.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

// Estimate kudos cost for a request (dry run)
router.post('/estimate', async (req, res) => {
  try {
    const { params } = req.body;

    if (!params) {
      return res.status(400).json({ error: 'Missing required field: params' });
    }

    // Add dry_run flag to params
    const dryRunParams = {
      ...params,
      dry_run: true
    };

    // Submit dry run request to AI Horde
    const response = await hordeApi.postImageAsyncGenerate(dryRunParams);

    res.json({
      kudos: response.kudos || 0
    });
  } catch (error) {
    console.error('Error estimating kudos cost:', error);
    res.status(500).json({ error: 'Failed to estimate kudos cost' });
  }
});

export default router;

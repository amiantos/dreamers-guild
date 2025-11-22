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

// Delete all requests
router.delete('/', async (req, res) => {
  try {
    const { imageAction } = req.query; // 'prune', 'keep', 'hide', or 'cancel'

    // Get all requests
    const requests = HordeRequest.findAll();

    // Cancel all active requests on AI Horde
    for (const request of requests) {
      await queueManager.cancelRequest(request.uuid);
    }

    // Delete all pending downloads
    const allPendingDownloads = HordePendingDownload.findAll();
    allPendingDownloads.forEach(d => HordePendingDownload.delete(d.uuid));

    // Process images based on action
    for (const request of requests) {
      const images = GeneratedImage.findByRequestId(request.uuid);

      if (imageAction === 'prune') {
        // Delete all non-favorited and non-hidden images
        images.forEach(img => {
          if (!img.is_favorite && !img.is_hidden) {
            GeneratedImage.delete(img.uuid);
          } else {
            // Remove request_id from favorited/hidden images
            GeneratedImage.update(img.uuid, { requestId: null });
          }
        });
      } else if (imageAction === 'hide') {
        // Mark all images as hidden and remove the request_id reference
        images.forEach(img => {
          GeneratedImage.update(img.uuid, { isHidden: true, requestId: null });
        });
      } else if (imageAction === 'keep' || imageAction === 'cancel') {
        // Keep all images by removing the request_id reference
        images.forEach(img => {
          GeneratedImage.update(img.uuid, { requestId: null });
        });
      }

      // Delete the request
      HordeRequest.delete(request.uuid);
    }

    res.json({ success: true, deletedCount: requests.length });
  } catch (error) {
    console.error('Error deleting all requests:', error);
    res.status(500).json({ error: 'Failed to delete all requests' });
  }
});

// Delete a request
router.delete('/:id', async (req, res) => {
  try {
    const { imageAction } = req.query; // 'prune', 'keep', or 'hide'
    const requestId = req.params.id;

    // Cancel the request on AI Horde if it's still active
    await queueManager.cancelRequest(requestId);

    // Delete any pending downloads for this request (to avoid foreign key constraint)
    HordePendingDownload.deleteByRequestId(requestId);

    // Handle images based on the action
    const images = GeneratedImage.findByRequestId(requestId);

    if (imageAction === 'prune') {
      // Delete all non-favorited and non-hidden images
      images.forEach(img => {
        if (!img.is_favorite && !img.is_hidden) {
          GeneratedImage.delete(img.uuid);
        } else {
          // Remove request_id from favorited/hidden images
          GeneratedImage.update(img.uuid, { requestId: null });
        }
      });
    } else if (imageAction === 'hide') {
      // Mark all images as hidden and remove the request_id reference
      images.forEach(img => {
        GeneratedImage.update(img.uuid, { isHidden: true, requestId: null });
      });
    } else if (imageAction === 'keep') {
      // Keep all images by removing the request_id reference
      images.forEach(img => {
        GeneratedImage.update(img.uuid, { requestId: null });
      });
    } else {
      // Default: delete all images (handles 'delete' and any other values)
      images.forEach(img => {
        GeneratedImage.delete(img.uuid);
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

    // Forward the actual error from AI Horde API if available
    if (error.response?.data) {
      const statusCode = error.response.status || 500;
      const errorMessage = error.response.data.message || error.response.data.error || 'Failed to estimate kudos cost';
      const errorCode = error.response.data.rc;

      return res.status(statusCode).json({
        message: errorMessage,
        rc: errorCode
      });
    }

    // Generic server error if not an API error
    res.status(500).json({ message: 'Failed to estimate kudos cost' });
  }
});

export default router;

import express from 'express';
import { GeneratedImage, ImageAlbum } from '../db/models.js';
import { imagesDir } from '../db/database.js';
import path from 'path';

const router = express.Router();

// Get all images (paginated) with optional flexible filters
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const showFavorites = req.query.favorites === 'true';
    const showHiddenOnly = req.query.showHiddenOnly === 'true';

    // Parse flexible filters if provided
    let filterCriteria = null;
    if (req.query.filters) {
      try {
        filterCriteria = JSON.parse(req.query.filters);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid filters JSON' });
      }
    }

    const globalFilters = { showFavorites, showHiddenOnly };

    let images, total;
    if (filterCriteria && filterCriteria.length > 0) {
      images = GeneratedImage.findByFilters(filterCriteria, limit, offset, globalFilters);
      total = GeneratedImage.countByFilters(filterCriteria, globalFilters);
    } else {
      images = GeneratedImage.findAll(limit, offset, globalFilters);
      total = GeneratedImage.countAll(globalFilters);
    }

    res.json({ data: images, total });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get images for a specific request
router.get('/request/:requestId', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const images = GeneratedImage.findByRequestId(req.params.requestId, limit);
    const total = GeneratedImage.countByRequestId(req.params.requestId);
    res.json({ data: images, total });
  } catch (error) {
    console.error('Error fetching images for request:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Search images by keywords
router.get('/search', (req, res) => {
  try {
    const keywords = req.query.q || '';
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const showFavorites = req.query.favorites === 'true';
    const showHiddenOnly = req.query.showHiddenOnly === 'true';

    const images = GeneratedImage.findByKeywords(keywords, limit, offset, { showFavorites, showHiddenOnly });
    const total = GeneratedImage.countByKeywords(keywords, { showFavorites, showHiddenOnly });

    res.json({ data: images, total });
  } catch (error) {
    console.error('Error searching images:', error);
    res.status(500).json({ error: 'Failed to search images' });
  }
});

// Get a single image
router.get('/:id', (req, res) => {
  try {
    const image = GeneratedImage.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json(image);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Serve image file
router.get('/:id/file', (req, res) => {
  try {
    const image = GeneratedImage.findById(req.params.id);
    if (!image || !image.image_path) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const filePath = path.join(imagesDir, image.image_path);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving image file:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Serve thumbnail file
router.get('/:id/thumbnail', (req, res) => {
  try {
    const image = GeneratedImage.findById(req.params.id);
    if (!image || !image.thumbnail_path) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    const filePath = path.join(imagesDir, image.thumbnail_path);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
});

// Get albums containing this image
router.get('/:id/albums', (req, res) => {
  try {
    const imageId = req.params.id;
    const includeHidden = req.query.includeHidden === 'true';

    const albums = ImageAlbum.findAlbumsForImage(imageId, includeHidden);

    res.json(albums);
  } catch (error) {
    console.error('Error fetching albums for image:', error);
    res.status(500).json({ error: 'Failed to fetch albums for image' });
  }
});

// Update image metadata
router.patch('/:id', (req, res) => {
  try {
    const { isFavorite, isHidden } = req.body;

    const updates = {};
    if (isFavorite !== undefined) updates.isFavorite = isFavorite;
    if (isHidden !== undefined) updates.isHidden = isHidden;

    const image = GeneratedImage.update(req.params.id, updates);
    res.json(image);
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// Batch update images
router.put('/batch', (req, res) => {
  try {
    const { imageIds, updates } = req.body;

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'imageIds must be a non-empty array' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object is required' });
    }

    const updateData = {};
    if (updates.isFavorite !== undefined) updateData.isFavorite = updates.isFavorite;
    if (updates.isHidden !== undefined) updateData.isHidden = updates.isHidden;

    const results = imageIds.map(id => {
      try {
        const image = GeneratedImage.update(id, updateData);
        return { id, success: true, image };
      } catch (error) {
        console.error(`Error updating image ${id}:`, error);
        return { id, success: false, error: error.message };
      }
    });

    const successCount = results.filter(r => r.success).length;
    res.json({
      success: true,
      updated: successCount,
      total: imageIds.length,
      results
    });
  } catch (error) {
    console.error('Error in batch update:', error);
    res.status(500).json({ error: 'Failed to batch update images' });
  }
});

// Batch delete images
router.delete('/batch', (req, res) => {
  try {
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'imageIds must be a non-empty array' });
    }

    const results = imageIds.map(id => {
      try {
        GeneratedImage.delete(id);
        return { id, success: true };
      } catch (error) {
        console.error(`Error deleting image ${id}:`, error);
        return { id, success: false, error: error.message };
      }
    });

    const successCount = results.filter(r => r.success).length;
    res.json({
      success: true,
      deleted: successCount,
      total: imageIds.length,
      results
    });
  } catch (error) {
    console.error('Error in batch delete:', error);
    res.status(500).json({ error: 'Failed to batch delete images' });
  }
});

// Delete image
router.delete('/:id', (req, res) => {
  try {
    GeneratedImage.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;

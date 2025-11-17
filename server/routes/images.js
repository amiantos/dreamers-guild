import express from 'express';
import { GeneratedImage } from '../db/models.js';
import { imagesDir } from '../db/database.js';
import path from 'path';

const router = express.Router();

// Get all images (paginated)
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const showFavorites = req.query.favorites === 'true';
    const showHidden = req.query.hidden === 'true';

    const images = GeneratedImage.findAll(limit, offset, { showFavorites, showHidden });
    res.json(images);
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
    res.json(images);
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
    const showFavorites = req.query.favorites === 'true';
    const showHidden = req.query.hidden === 'true';

    const images = GeneratedImage.findByKeywords(keywords, limit, { showFavorites, showHidden });
    res.json(images);
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

// Update image metadata
router.patch('/:id', (req, res) => {
  try {
    const { isFavorite, isHidden, isTrashed } = req.body;

    const updates = {};
    if (isFavorite !== undefined) updates.isFavorite = isFavorite;
    if (isHidden !== undefined) updates.isHidden = isHidden;
    if (isTrashed !== undefined) {
      updates.isTrashed = isTrashed;
      if (isTrashed) updates.dateTrashed = Date.now();
    }

    const image = GeneratedImage.update(req.params.id, updates);
    res.json(image);
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Failed to update image' });
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

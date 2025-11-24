import express from 'express';
import { GeneratedImage } from '../db/models.js';
import { imagesDir } from '../db/database.js';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const router = express.Router();

// Get all images (paginated)
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const showFavorites = req.query.favorites === 'true';
    const includeHidden = req.query.includeHidden === 'true';

    const images = GeneratedImage.findAll(limit, offset, { showFavorites, includeHidden });
    const total = GeneratedImage.countAll({ showFavorites, includeHidden });

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
    const showFavorites = req.query.favorites === 'true';
    const includeHidden = req.query.includeHidden === 'true';

    const images = GeneratedImage.findByKeywords(keywords, limit, { showFavorites, includeHidden });
    const total = GeneratedImage.countByKeywords(keywords, { showFavorites, includeHidden });

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

// Serve aspect-ratio thumbnail file
router.get('/:id/thumbnail-ar', (req, res) => {
  try {
    const image = GeneratedImage.findById(req.params.id);
    if (!image || !image.thumbnail_path) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    // Replace _thumb.webp with _thumb_ar.webp
    const arThumbnailPath = image.thumbnail_path.replace('_thumb.webp', '_thumb_ar.webp');
    const filePath = path.join(imagesDir, arThumbnailPath);

    // If aspect-ratio thumbnail doesn't exist, fall back to square thumbnail
    if (!fs.existsSync(filePath)) {
      const squarePath = path.join(imagesDir, image.thumbnail_path);
      return res.sendFile(squarePath);
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving aspect-ratio thumbnail:', error);
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

// Regenerate aspect-ratio thumbnails for all images
router.post('/regenerate-thumbnails', async (req, res) => {
  try {
    // Get all images that have an image_path
    const images = GeneratedImage.findAll(999999, 0, { includeHidden: true });
    const imagesToProcess = images.filter(img => img.image_path);

    console.log(`[Thumbnail Regeneration] Starting regeneration for ${imagesToProcess.length} images`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors = [];

    for (const image of imagesToProcess) {
      try {
        const imagePath = path.join(imagesDir, image.image_path);
        const arThumbnailPath = path.join(
          imagesDir,
          image.thumbnail_path.replace('_thumb.webp', '_thumb_ar.webp')
        );

        // Skip if aspect-ratio thumbnail already exists
        if (fs.existsSync(arThumbnailPath)) {
          processed++;
          succeeded++;
          continue;
        }

        // Check if original image exists
        if (!fs.existsSync(imagePath)) {
          console.warn(`[Thumbnail Regeneration] Original image not found: ${imagePath}`);
          failed++;
          errors.push({ uuid: image.uuid, error: 'Original image not found' });
          processed++;
          continue;
        }

        // Generate aspect-ratio thumbnail
        await sharp(imagePath)
          .resize(512, null, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 85 })
          .toFile(arThumbnailPath);

        succeeded++;
        console.log(`[Thumbnail Regeneration] Generated thumbnail for ${image.uuid} (${processed + 1}/${imagesToProcess.length})`);
      } catch (error) {
        console.error(`[Thumbnail Regeneration] Failed to process ${image.uuid}:`, error);
        failed++;
        errors.push({ uuid: image.uuid, error: error.message });
      }

      processed++;
    }

    console.log(`[Thumbnail Regeneration] Complete. Succeeded: ${succeeded}, Failed: ${failed}`);

    res.json({
      success: true,
      total: imagesToProcess.length,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Thumbnail Regeneration] Error:', error);
    res.status(500).json({ error: 'Failed to regenerate thumbnails', details: error.message });
  }
});

export default router;

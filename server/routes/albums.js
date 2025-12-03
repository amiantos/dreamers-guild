import express from 'express';
import { Album, ImageAlbum } from '../db/models.js';

const router = express.Router();

// ============================================================================
// USER ALBUM CRUD ROUTES
// ============================================================================

/**
 * GET /api/albums
 * Get all user-created albums
 * Query params:
 *   - includeHidden: Include hidden albums (requires auth)
 */
router.get('/', (req, res) => {
  try {
    const includeHidden = req.query.includeHidden === 'true';

    // Get user albums with count and thumbnail in single efficient query
    const userAlbums = Album.findAllWithDetails(includeHidden).map(album => ({
      ...album,
      type: 'user'
    }));

    res.json(userAlbums);
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

/**
 * POST /api/albums
 * Create a new user album
 */
router.post('/', (req, res) => {
  try {
    const { title, isHidden } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Album title is required' });
    }

    const album = Album.create({
      title: title.trim(),
      isHidden: isHidden || false
    });

    res.status(201).json(album);
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

/**
 * GET /api/albums/:slug
 * Get a single album by slug
 */
router.get('/:slug', (req, res) => {
  try {
    const album = Album.findBySlug(req.params.slug);

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const coverImage = Album.getCoverImage(album.id);
    res.json({
      ...album,
      type: 'user',
      count: Album.getImageCount(album.id),
      thumbnail: coverImage?.uuid || null
    });
  } catch (error) {
    console.error('Error fetching album:', error);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

/**
 * PATCH /api/albums/:id
 * Update an album
 */
router.patch('/:id', (req, res) => {
  try {
    const albumId = parseInt(req.params.id, 10);
    const { title, isHidden, coverImageUuid, sortOrder } = req.body;

    const existing = Album.findById(albumId);
    if (!existing) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (isHidden !== undefined) updates.isHidden = isHidden;
    if (coverImageUuid !== undefined) updates.coverImageUuid = coverImageUuid;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const album = Album.update(albumId, updates);

    const coverImage = Album.getCoverImage(album.id);
    res.json({
      ...album,
      type: 'user',
      count: Album.getImageCount(album.id),
      thumbnail: coverImage?.uuid || null
    });
  } catch (error) {
    console.error('Error updating album:', error);
    res.status(500).json({ error: 'Failed to update album' });
  }
});

/**
 * DELETE /api/albums/:id
 * Delete an album
 */
router.delete('/:id', (req, res) => {
  try {
    const albumId = parseInt(req.params.id, 10);

    const existing = Album.findById(albumId);
    if (!existing) {
      return res.status(404).json({ error: 'Album not found' });
    }

    Album.delete(albumId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting album:', error);
    res.status(500).json({ error: 'Failed to delete album' });
  }
});

/**
 * GET /api/albums/:id/images
 * Get images in an album
 */
router.get('/:id/images', (req, res) => {
  try {
    const albumId = parseInt(req.params.id, 10);
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
    const showFavorites = req.query.favorites === 'true';
    const showHiddenOnly = req.query.showHiddenOnly === 'true';
    const keywords = req.query.keywords ? req.query.keywords.split(',') : [];

    const existing = Album.findById(albumId);
    if (!existing) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const images = ImageAlbum.findImagesInAlbum(albumId, limit, offset, {
      showFavorites,
      showHiddenOnly,
      keywords
    });

    const total = ImageAlbum.countImagesInAlbum(albumId, {
      showFavorites,
      showHiddenOnly,
      keywords
    });

    res.json({
      images,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching album images:', error);
    res.status(500).json({ error: 'Failed to fetch album images' });
  }
});

/**
 * POST /api/albums/:id/images
 * Add images to an album
 */
router.post('/:id/images', (req, res) => {
  try {
    const albumId = parseInt(req.params.id, 10);
    const { imageIds } = req.body;

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'imageIds array is required' });
    }

    const existing = Album.findById(albumId);
    if (!existing) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const results = ImageAlbum.addImagesToAlbum(imageIds, albumId);

    res.json({
      success: true,
      added: results.length,
      albumId
    });
  } catch (error) {
    console.error('Error adding images to album:', error);
    res.status(500).json({ error: 'Failed to add images to album' });
  }
});

/**
 * DELETE /api/albums/:id/images/:imageId
 * Remove an image from an album
 */
router.delete('/:id/images/:imageId', (req, res) => {
  try {
    const albumId = parseInt(req.params.id, 10);
    const imageId = req.params.imageId;

    const existing = Album.findById(albumId);
    if (!existing) {
      return res.status(404).json({ error: 'Album not found' });
    }

    ImageAlbum.removeImageFromAlbum(imageId, albumId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing image from album:', error);
    res.status(500).json({ error: 'Failed to remove image from album' });
  }
});

// ============================================================================
// IMAGE-ALBUM LOOKUP ROUTE (under /api/images)
// This is registered separately in server.js
// ============================================================================

/**
 * Get albums for a specific image
 * This is exported to be mounted at /api/images/:imageId/albums
 */
export function getAlbumsForImageHandler(req, res) {
  try {
    const imageId = req.params.imageId;
    const includeHidden = req.query.includeHidden === 'true';

    const albums = ImageAlbum.findAlbumsForImage(imageId, includeHidden);

    res.json(albums);
  } catch (error) {
    console.error('Error fetching albums for image:', error);
    res.status(500).json({ error: 'Failed to fetch albums for image' });
  }
}

export default router;

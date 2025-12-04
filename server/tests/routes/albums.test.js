import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, closeTestDatabase } from '../helpers/testDb.js';
import { sampleImage, sampleAlbum } from '../helpers/fixtures.js';

// Mock external dependencies before importing the route
vi.mock('../../db/models.js', () => ({
  Album: {
    findAll: vi.fn(),
    findAllWithDetails: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getImageCount: vi.fn(),
    getCoverImage: vi.fn()
  },
  ImageAlbum: {
    addImageToAlbum: vi.fn(),
    addImagesToAlbum: vi.fn(),
    removeImageFromAlbum: vi.fn(),
    findAlbumsForImage: vi.fn(),
    findImagesInAlbum: vi.fn(),
    countImagesInAlbum: vi.fn()
  }
}));

// Import after mocks are set up
import { Album, ImageAlbum } from '../../db/models.js';

describe('Albums Routes', () => {
  let app;
  let testDb;
  let testModels;

  beforeEach(async () => {
    // Create fresh in-memory database
    const { db, models } = createTestDatabase();
    testDb = db;
    testModels = models;

    // Reset all mocks
    vi.clearAllMocks();

    // Configure Album mocks to use test database
    Album.findAllWithDetails.mockImplementation((includeHidden) =>
      testModels.Album.findAllWithDetails(includeHidden));
    Album.findById.mockImplementation((id) =>
      testModels.Album.findById(id));
    Album.findBySlug.mockImplementation((slug) =>
      testModels.Album.findBySlug(slug));
    Album.create.mockImplementation((data) =>
      testModels.Album.create(data));
    Album.update.mockImplementation((id, data) =>
      testModels.Album.update(id, data));
    Album.delete.mockImplementation((id) =>
      testModels.Album.delete(id));
    Album.getImageCount.mockImplementation((id) =>
      testModels.Album.getImageCount(id));
    Album.getCoverImage.mockImplementation((id) =>
      testModels.Album.getCoverImage(id));

    // Configure ImageAlbum mocks
    ImageAlbum.addImageToAlbum.mockImplementation((imageUuid, albumId, autoHide) =>
      testModels.ImageAlbum.addImageToAlbum(imageUuid, albumId, autoHide));
    ImageAlbum.addImagesToAlbum.mockImplementation((imageUuids, albumId) =>
      testModels.ImageAlbum.addImagesToAlbum(imageUuids, albumId));
    ImageAlbum.removeImageFromAlbum.mockImplementation((imageUuid, albumId) =>
      testModels.ImageAlbum.removeImageFromAlbum(imageUuid, albumId));
    ImageAlbum.findAlbumsForImage.mockImplementation((imageId, includeHidden) =>
      testModels.ImageAlbum.findAlbumsForImage(imageId, includeHidden));
    ImageAlbum.findImagesInAlbum.mockImplementation((albumId, limit, offset, filters) =>
      testModels.ImageAlbum.findImagesInAlbum(albumId, limit, offset, filters));
    ImageAlbum.countImagesInAlbum.mockImplementation((albumId, filters) =>
      testModels.ImageAlbum.countImagesInAlbum(albumId, filters));

    // Create Express app and import route dynamically
    app = express();
    app.use(express.json());

    const albumsRouter = (await import('../../routes/albums.js')).default;
    app.use('/api/albums', albumsRouter);
  });

  afterEach(() => {
    closeTestDatabase(testDb);
  });

  describe('GET /api/albums', () => {
    it('should return empty array when no albums exist', async () => {
      const response = await request(app).get('/api/albums');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all non-hidden albums by default', async () => {
      testModels.Album.create(sampleAlbum({ title: 'Visible Album' }));
      testModels.Album.create(sampleAlbum({ title: 'Hidden Album', isHidden: true }));

      const response = await request(app).get('/api/albums');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Visible Album');
      expect(response.body[0].type).toBe('user');
    });

    it('should include hidden albums when includeHidden=true', async () => {
      testModels.Album.create(sampleAlbum({ title: 'Visible Album' }));
      testModels.Album.create(sampleAlbum({ title: 'Hidden Album', isHidden: true }));

      const response = await request(app).get('/api/albums?includeHidden=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should include count and thumbnail for each album', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test Album' }));
      const image = testModels.GeneratedImage.create(sampleImage());
      testModels.ImageAlbum.addImageToAlbum(image.uuid, album.id);

      const response = await request(app).get('/api/albums');

      expect(response.status).toBe(200);
      expect(response.body[0].count).toBe(1);
      expect(response.body[0].thumbnail).toBe(image.uuid);
    });
  });

  describe('POST /api/albums', () => {
    it('should create album with valid title', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: 'New Album' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Album');
      expect(response.body.slug).toBeDefined();
      expect(response.body.is_hidden).toBe(0);
    });

    it('should create hidden album when isHidden=true', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: 'Hidden Album', isHidden: true });

      expect(response.status).toBe(201);
      expect(response.body.is_hidden).toBe(1);
    });

    it('should return 400 when title is empty', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Album title is required');
    });

    it('should return 400 when title is whitespace only', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Album title is required');
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Album title is required');
    });

    it('should trim whitespace from title', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: '  My Album  ' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('My Album');
    });
  });

  describe('GET /api/albums/:slug', () => {
    it('should return album by slug', async () => {
      const created = testModels.Album.create(sampleAlbum({ title: 'Test Album' }));

      const response = await request(app).get(`/api/albums/${created.slug}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(created.id);
      expect(response.body.title).toBe('Test Album');
      expect(response.body.type).toBe('user');
      expect(response.body.count).toBeDefined();
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app).get('/api/albums/non-existent-slug');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Album not found');
    });

    it('should include thumbnail when album has images', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test Album' }));
      const image = testModels.GeneratedImage.create(sampleImage());
      testModels.ImageAlbum.addImageToAlbum(image.uuid, album.id);

      const response = await request(app).get(`/api/albums/${album.slug}`);

      expect(response.status).toBe(200);
      expect(response.body.thumbnail).toBe(image.uuid);
    });
  });

  describe('PATCH /api/albums/:id', () => {
    it('should update album title', async () => {
      const created = testModels.Album.create(sampleAlbum({ title: 'Original' }));

      const response = await request(app)
        .patch(`/api/albums/${created.id}`)
        .send({ title: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated');
      // Slug should remain unchanged
      expect(response.body.slug).toBe(created.slug);
    });

    it('should update isHidden status', async () => {
      const created = testModels.Album.create(sampleAlbum({ title: 'Test' }));

      const response = await request(app)
        .patch(`/api/albums/${created.id}`)
        .send({ isHidden: true });

      expect(response.status).toBe(200);
      expect(response.body.is_hidden).toBe(1);
    });

    it('should update coverImageUuid', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const image = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app)
        .patch(`/api/albums/${album.id}`)
        .send({ coverImageUuid: image.uuid });

      expect(response.status).toBe(200);
      expect(response.body.cover_image_uuid).toBe(image.uuid);
    });

    it('should return 404 for non-existent album', async () => {
      const response = await request(app)
        .patch('/api/albums/99999')
        .send({ title: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Album not found');
    });
  });

  describe('DELETE /api/albums/:id', () => {
    it('should delete album', async () => {
      const created = testModels.Album.create(sampleAlbum({ title: 'To Delete' }));

      const response = await request(app).delete(`/api/albums/${created.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      expect(testModels.Album.findById(created.id)).toBeUndefined();
    });

    it('should remove image associations when deleting album', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const image = testModels.GeneratedImage.create(sampleImage());
      testModels.ImageAlbum.addImageToAlbum(image.uuid, album.id);

      await request(app).delete(`/api/albums/${album.id}`);

      // Image should still exist, but not be in any album
      const imageAlbums = testModels.ImageAlbum.findAlbumsForImage(image.uuid, true);
      expect(imageAlbums).toHaveLength(0);
    });

    it('should return 404 for non-existent album', async () => {
      const response = await request(app).delete('/api/albums/99999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Album not found');
    });
  });

  describe('GET /api/albums/:id/images', () => {
    it('should return images in album', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const image1 = testModels.GeneratedImage.create(sampleImage({ promptSimple: 'image 1' }));
      const image2 = testModels.GeneratedImage.create(sampleImage({ promptSimple: 'image 2' }));
      testModels.ImageAlbum.addImageToAlbum(image1.uuid, album.id);
      testModels.ImageAlbum.addImageToAlbum(image2.uuid, album.id);

      const response = await request(app).get(`/api/albums/${album.id}/images`);

      expect(response.status).toBe(200);
      expect(response.body.images).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should respect limit and offset', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      for (let i = 0; i < 5; i++) {
        const image = testModels.GeneratedImage.create(sampleImage());
        testModels.ImageAlbum.addImageToAlbum(image.uuid, album.id);
      }

      const response = await request(app).get(`/api/albums/${album.id}/images?limit=2&offset=1`);

      expect(response.status).toBe(200);
      expect(response.body.images).toHaveLength(2);
      expect(response.body.limit).toBe(2);
      expect(response.body.offset).toBe(1);
    });

    it('should filter by favorites', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const favImage = testModels.GeneratedImage.create(sampleImage({ isFavorite: true }));
      const normalImage = testModels.GeneratedImage.create(sampleImage());
      testModels.ImageAlbum.addImageToAlbum(favImage.uuid, album.id);
      testModels.ImageAlbum.addImageToAlbum(normalImage.uuid, album.id);

      const response = await request(app).get(`/api/albums/${album.id}/images?favorites=true`);

      expect(response.status).toBe(200);
      expect(response.body.images).toHaveLength(1);
      expect(response.body.images[0].is_favorite).toBe(1);
    });

    it('should filter by keywords', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const matchingImage = testModels.GeneratedImage.create(sampleImage({ promptSimple: 'sunset beach' }));
      const otherImage = testModels.GeneratedImage.create(sampleImage({ promptSimple: 'mountain' }));
      testModels.ImageAlbum.addImageToAlbum(matchingImage.uuid, album.id);
      testModels.ImageAlbum.addImageToAlbum(otherImage.uuid, album.id);

      const response = await request(app).get(`/api/albums/${album.id}/images?keywords=sunset`);

      expect(response.status).toBe(200);
      expect(response.body.images).toHaveLength(1);
      expect(response.body.images[0].prompt_simple).toContain('sunset');
    });

    it('should return 404 for non-existent album', async () => {
      const response = await request(app).get('/api/albums/99999/images');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Album not found');
    });
  });

  describe('POST /api/albums/:id/images', () => {
    it('should add images to album', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const image1 = testModels.GeneratedImage.create(sampleImage());
      const image2 = testModels.GeneratedImage.create(sampleImage());

      const response = await request(app)
        .post(`/api/albums/${album.id}/images`)
        .send({ imageIds: [image1.uuid, image2.uuid] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.added).toBe(2);
      expect(response.body.albumId).toBe(album.id);
    });

    it('should auto-hide images when adding to hidden album', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Hidden', isHidden: true }));
      const image = testModels.GeneratedImage.create(sampleImage({ isHidden: false }));

      await request(app)
        .post(`/api/albums/${album.id}/images`)
        .send({ imageIds: [image.uuid] });

      // Check image is now hidden
      const updatedImage = testModels.GeneratedImage.findById(image.uuid);
      expect(updatedImage.is_hidden).toBe(1);
    });

    it('should handle duplicate adds gracefully', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const image = testModels.GeneratedImage.create(sampleImage());
      testModels.ImageAlbum.addImageToAlbum(image.uuid, album.id);

      // Try to add again
      const response = await request(app)
        .post(`/api/albums/${album.id}/images`)
        .send({ imageIds: [image.uuid] });

      expect(response.status).toBe(200);
      // Count should still be 1
      expect(testModels.Album.getImageCount(album.id)).toBe(1);
    });

    it('should return 400 when imageIds is empty', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));

      const response = await request(app)
        .post(`/api/albums/${album.id}/images`)
        .send({ imageIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('imageIds array is required');
    });

    it('should return 400 when imageIds is missing', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));

      const response = await request(app)
        .post(`/api/albums/${album.id}/images`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('imageIds array is required');
    });

    it('should return 404 for non-existent album', async () => {
      const response = await request(app)
        .post('/api/albums/99999/images')
        .send({ imageIds: ['uuid-1'] });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Album not found');
    });
  });

  describe('DELETE /api/albums/:id/images/:imageId', () => {
    it('should remove single image from album', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const image = testModels.GeneratedImage.create(sampleImage());
      testModels.ImageAlbum.addImageToAlbum(image.uuid, album.id);

      const response = await request(app).delete(`/api/albums/${album.id}/images/${image.uuid}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify removal
      expect(testModels.Album.getImageCount(album.id)).toBe(0);
    });

    it('should return 404 for non-existent album', async () => {
      const response = await request(app).delete('/api/albums/99999/images/some-uuid');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Album not found');
    });
  });

  describe('DELETE /api/albums/:id/images (bulk)', () => {
    it('should remove multiple images from album', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));
      const image1 = testModels.GeneratedImage.create(sampleImage());
      const image2 = testModels.GeneratedImage.create(sampleImage());
      const image3 = testModels.GeneratedImage.create(sampleImage());
      testModels.ImageAlbum.addImageToAlbum(image1.uuid, album.id);
      testModels.ImageAlbum.addImageToAlbum(image2.uuid, album.id);
      testModels.ImageAlbum.addImageToAlbum(image3.uuid, album.id);

      const response = await request(app)
        .delete(`/api/albums/${album.id}/images`)
        .send({ imageIds: [image1.uuid, image2.uuid] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.removed).toBe(2);

      // One image should remain
      expect(testModels.Album.getImageCount(album.id)).toBe(1);
    });

    it('should return 400 when imageIds is empty', async () => {
      const album = testModels.Album.create(sampleAlbum({ title: 'Test' }));

      const response = await request(app)
        .delete(`/api/albums/${album.id}/images`)
        .send({ imageIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('imageIds array is required');
    });

    it('should return 404 for non-existent album', async () => {
      const response = await request(app)
        .delete('/api/albums/99999/images')
        .send({ imageIds: ['uuid-1'] });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Album not found');
    });
  });
});

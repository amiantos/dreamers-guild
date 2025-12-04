import db from './database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { imagesDir } from './database.js';
import { generateSlug } from '../utils/slugify.js';

// HordeRequest model
export const HordeRequest = {
  create(data) {
    const uuid = data.uuid || uuidv4();
    const stmt = db.prepare(`
      INSERT INTO horde_requests
      (uuid, date_created, prompt, full_request, status, message, n, queue_position, wait_time, total_kudos_cost, album_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuid,
      data.dateCreated || Date.now(),
      data.prompt || null,
      data.fullRequest || null,
      data.status || 'pending',
      data.message || null,
      data.n || 0,
      data.queuePosition || 0,
      data.waitTime || 0,
      data.totalKudosCost || 0,
      data.albumId || null
    );

    return this.findById(uuid);
  },

  findById(uuid) {
    const stmt = db.prepare('SELECT * FROM horde_requests WHERE uuid = ?');
    return stmt.get(uuid);
  },

  findAll(limit = 100) {
    const stmt = db.prepare('SELECT * FROM horde_requests ORDER BY date_created DESC LIMIT ?');
    return stmt.all(limit);
  },

  findPending() {
    const stmt = db.prepare(`
      SELECT * FROM horde_requests
      WHERE status IN ('pending', 'submitting', 'processing', 'waiting', 'downloading')
      ORDER BY date_created ASC
    `);
    return stmt.all();
  },

  update(uuid, data) {
    const fields = [];
    const values = [];

    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.message !== undefined) { fields.push('message = ?'); values.push(data.message); }
    if (data.queuePosition !== undefined) { fields.push('queue_position = ?'); values.push(data.queuePosition); }
    if (data.waitTime !== undefined) { fields.push('wait_time = ?'); values.push(data.waitTime); }
    if (data.totalKudosCost !== undefined) { fields.push('total_kudos_cost = ?'); values.push(data.totalKudosCost); }
    if (data.hordeId !== undefined) { fields.push('horde_id = ?'); values.push(data.hordeId); }
    if (data.finished !== undefined) { fields.push('finished = ?'); values.push(data.finished); }
    if (data.waiting !== undefined) { fields.push('waiting = ?'); values.push(data.waiting); }
    if (data.processing !== undefined) { fields.push('processing = ?'); values.push(data.processing); }

    if (fields.length === 0) return this.findById(uuid);

    values.push(uuid);
    const stmt = db.prepare(`UPDATE horde_requests SET ${fields.join(', ')} WHERE uuid = ?`);
    stmt.run(...values);

    return this.findById(uuid);
  },

  delete(uuid) {
    const stmt = db.prepare('DELETE FROM horde_requests WHERE uuid = ?');
    return stmt.run(uuid);
  }
};

// GeneratedImage model
export const GeneratedImage = {
  create(data) {
    const uuid = data.uuid || uuidv4();
    const stmt = db.prepare(`
      INSERT INTO generated_images
      (uuid, request_id, date_created, backend, prompt_simple, full_request, full_response,
       image_path, thumbnail_path, is_favorite, is_hidden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuid,
      data.requestId || null,
      data.dateCreated || Date.now(),
      data.backend || 'AI Horde',
      data.promptSimple || null,
      data.fullRequest || null,
      data.fullResponse || null,
      data.imagePath || null,
      data.thumbnailPath || null,
      data.isFavorite ? 1 : 0,
      data.isHidden ? 1 : 0
    );

    return this.findById(uuid);
  },

  findById(uuid) {
    const stmt = db.prepare('SELECT * FROM generated_images WHERE uuid = ?');
    return stmt.get(uuid);
  },

  findAll(limit = 100, offset = 0, filters = {}) {
    let query = `SELECT * FROM generated_images WHERE 1=1`;
    const params = [];

    // Apply filters
    if (filters.showFavorites) {
      query += ` AND is_favorite = 1`;
    }

    // Filter by hidden status
    if (filters.showHiddenOnly) {
      query += ` AND is_hidden = 1`;
    } else {
      query += ` AND is_hidden = 0`;
    }

    query += ` ORDER BY date_created DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  countAll(filters = {}) {
    let query = `SELECT COUNT(*) as count FROM generated_images WHERE 1=1`;

    if (filters.showFavorites) {
      query += ` AND is_favorite = 1`;
    }

    if (filters.showHiddenOnly) {
      query += ` AND is_hidden = 1`;
    } else {
      query += ` AND is_hidden = 0`;
    }

    const stmt = db.prepare(query);
    const result = stmt.get();
    return result.count;
  },

  findByRequestId(requestId, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM generated_images
      WHERE request_id = ?
      ORDER BY date_created DESC
      LIMIT ?
    `);
    return stmt.all(requestId, limit);
  },

  countByRequestId(requestId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM generated_images
      WHERE request_id = ?
    `);
    const result = stmt.get(requestId);
    return result.count;
  },

  findByKeywords(keywords, limit = 100, offset = 0, filters = {}) {
    let query = `SELECT * FROM generated_images WHERE 1=1`;
    const params = [];

    // Split keywords by comma and add AND conditions for each
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    keywordList.forEach(keyword => {
      query += ` AND prompt_simple LIKE ?`;
      params.push(`%${keyword}%`);
    });

    if (filters.showFavorites) {
      query += ` AND is_favorite = 1`;
    }

    if (filters.showHiddenOnly) {
      query += ` AND is_hidden = 1`;
    } else {
      query += ` AND is_hidden = 0`;
    }

    query += ` ORDER BY date_created DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  countByKeywords(keywords, filters = {}) {
    let query = `SELECT COUNT(*) as count FROM generated_images WHERE 1=1`;
    const params = [];

    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    keywordList.forEach(keyword => {
      query += ` AND prompt_simple LIKE ?`;
      params.push(`%${keyword}%`);
    });

    if (filters.showFavorites) {
      query += ` AND is_favorite = 1`;
    }

    if (filters.showHiddenOnly) {
      query += ` AND is_hidden = 1`;
    } else {
      query += ` AND is_hidden = 0`;
    }

    const stmt = db.prepare(query);
    const result = stmt.get(...params);
    return result.count;
  },

  /**
   * Find images by flexible filter criteria
   * @param {Array} filterCriteria - Array of {type, value} filters
   *   Supported types: 'keyword', 'lora_id', 'model', 'request_id'
   * @param {number} limit - Max results
   * @param {number} offset - Pagination offset
   * @param {Object} globalFilters - Global filters (showFavorites, showHiddenOnly)
   */
  findByFilters(filterCriteria, limit = 100, offset = 0, globalFilters = {}) {
    if (!filterCriteria || filterCriteria.length === 0) {
      return this.findAll(limit, offset, globalFilters);
    }

    let query = `SELECT * FROM generated_images WHERE 1=1`;
    const params = [];

    for (const filter of filterCriteria) {
      switch (filter.type) {
        case 'keyword':
          query += ` AND prompt_simple LIKE ?`;
          params.push(`%${filter.value}%`);
          break;
        case 'lora_id':
          query += ` AND full_request LIKE ?`;
          params.push(`%"name":"${filter.value}"%`);
          break;
        case 'model':
          query += ` AND full_request LIKE ?`;
          params.push(`%"models":["${filter.value}"%`);
          break;
        case 'request_id':
          query += ` AND request_id = ?`;
          params.push(filter.value);
          break;
      }
    }

    if (globalFilters.showFavorites) {
      query += ` AND is_favorite = 1`;
    }
    if (globalFilters.showHiddenOnly) {
      query += ` AND is_hidden = 1`;
    } else if (!globalFilters.includeHidden) {
      query += ` AND is_hidden = 0`;
    }
    // If includeHidden is true, don't add any hidden filter (include all)

    query += ` ORDER BY date_created DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  /**
   * Count images matching flexible filter criteria
   */
  countByFilters(filterCriteria, globalFilters = {}) {
    if (!filterCriteria || filterCriteria.length === 0) {
      return this.countAll(globalFilters);
    }

    let query = `SELECT COUNT(*) as count FROM generated_images WHERE 1=1`;
    const params = [];

    for (const filter of filterCriteria) {
      switch (filter.type) {
        case 'keyword':
          query += ` AND prompt_simple LIKE ?`;
          params.push(`%${filter.value}%`);
          break;
        case 'lora_id':
          query += ` AND full_request LIKE ?`;
          params.push(`%"name":"${filter.value}"%`);
          break;
        case 'model':
          query += ` AND full_request LIKE ?`;
          params.push(`%"models":["${filter.value}"%`);
          break;
        case 'request_id':
          query += ` AND request_id = ?`;
          params.push(filter.value);
          break;
      }
    }

    if (globalFilters.showFavorites) {
      query += ` AND is_favorite = 1`;
    }
    if (globalFilters.showHiddenOnly) {
      query += ` AND is_hidden = 1`;
    } else if (!globalFilters.includeHidden) {
      query += ` AND is_hidden = 0`;
    }
    // If includeHidden is true, don't add any hidden filter (include all)

    const stmt = db.prepare(query);
    const result = stmt.get(...params);
    return result.count;
  },

  update(uuid, data) {
    const fields = [];
    const values = [];

    if (data.requestId !== undefined) { fields.push('request_id = ?'); values.push(data.requestId); }
    if (data.isFavorite !== undefined) { fields.push('is_favorite = ?'); values.push(data.isFavorite ? 1 : 0); }
    if (data.isHidden !== undefined) { fields.push('is_hidden = ?'); values.push(data.isHidden ? 1 : 0); }

    if (fields.length === 0) return this.findById(uuid);

    values.push(uuid);
    const stmt = db.prepare(`UPDATE generated_images SET ${fields.join(', ')} WHERE uuid = ?`);
    stmt.run(...values);

    return this.findById(uuid);
  },

  delete(uuid) {
    // Get image info before deleting from database
    const image = this.findById(uuid);

    if (image) {
      // Delete image file if it exists
      if (image.image_path) {
        const imagePath = path.join(imagesDir, image.image_path);
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Deleted image file: ${image.image_path}`);
          }
        } catch (error) {
          console.error(`Error deleting image file ${image.image_path}:`, error.message);
        }
      }

      // Delete thumbnail file if it exists
      if (image.thumbnail_path) {
        const thumbnailPath = path.join(imagesDir, image.thumbnail_path);
        try {
          if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
            console.log(`Deleted thumbnail file: ${image.thumbnail_path}`);
          }
        } catch (error) {
          console.error(`Error deleting thumbnail file ${image.thumbnail_path}:`, error.message);
        }
      }
    }

    // Delete album associations
    const deleteAlbumAssocStmt = db.prepare('DELETE FROM image_albums WHERE image_uuid = ?');
    deleteAlbumAssocStmt.run(uuid);

    // Delete database record
    const stmt = db.prepare('DELETE FROM generated_images WHERE uuid = ?');
    return stmt.run(uuid);
  }
};

// HordePendingDownload model
export const HordePendingDownload = {
  create(data) {
    const uuid = data.uuid || uuidv4();

    // Use INSERT OR IGNORE to silently skip duplicates (unique constraint on request_id, uri)
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO horde_pending_downloads
      (uuid, request_id, uri, full_request, full_response)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      uuid,
      data.requestId || null,
      data.uri || null,
      data.fullRequest || null,
      data.fullResponse || null
    );

    // If no row was inserted (duplicate), return existing record
    if (result.changes === 0) {
      const existing = this.findByRequestAndUri(data.requestId, data.uri);
      if (existing) {
        console.log(`[Download] Skipping duplicate download for request ${data.requestId?.substring(0, 8)}...`);
        return existing;
      }
    }

    return this.findById(uuid);
  },

  findById(uuid) {
    const stmt = db.prepare('SELECT * FROM horde_pending_downloads WHERE uuid = ?');
    return stmt.get(uuid);
  },

  findByRequestAndUri(requestId, uri) {
    const stmt = db.prepare('SELECT * FROM horde_pending_downloads WHERE request_id = ? AND uri = ?');
    return stmt.get(requestId, uri);
  },

  findAll() {
    const stmt = db.prepare('SELECT * FROM horde_pending_downloads');
    return stmt.all();
  },

  findByRequestId(requestId) {
    const stmt = db.prepare('SELECT * FROM horde_pending_downloads WHERE request_id = ?');
    return stmt.all(requestId);
  },

  delete(uuid) {
    const stmt = db.prepare('DELETE FROM horde_pending_downloads WHERE uuid = ?');
    return stmt.run(uuid);
  },

  deleteByRequestId(requestId) {
    const stmt = db.prepare('DELETE FROM horde_pending_downloads WHERE request_id = ?');
    return stmt.run(requestId);
  }
};

// Album model (user-created albums)
export const Album = {
  create(data) {
    const now = Date.now();
    const slug = generateSlug(data.title);

    const stmt = db.prepare(`
      INSERT INTO albums (slug, title, is_hidden, cover_image_uuid, date_created, date_modified)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      slug,
      data.title,
      data.isHidden ? 1 : 0,
      data.coverImageUuid || null,
      now,
      now
    );

    return this.findById(result.lastInsertRowid);
  },

  findById(id) {
    const stmt = db.prepare('SELECT * FROM albums WHERE id = ?');
    return stmt.get(id);
  },

  findBySlug(slug) {
    const stmt = db.prepare('SELECT * FROM albums WHERE slug = ?');
    return stmt.get(slug);
  },

  findAll(includeHidden = false) {
    let query = 'SELECT * FROM albums';
    if (!includeHidden) {
      query += ' WHERE is_hidden = 0';
    }
    query += ' ORDER BY date_created DESC';

    const stmt = db.prepare(query);
    return stmt.all();
  },

  /**
   * Get all albums with count and thumbnail in a single efficient query
   * Avoids N+1 problem by using subqueries
   */
  findAllWithDetails(includeHidden = false) {
    const whereClause = includeHidden ? '' : 'WHERE a.is_hidden = 0';

    const stmt = db.prepare(`
      SELECT
        a.*,
        COALESCE(counts.count, 0) as count,
        COALESCE(
          a.cover_image_uuid,
          (
            SELECT ia2.image_uuid
            FROM image_albums ia2
            WHERE ia2.album_id = a.id
            ORDER BY ia2.date_added DESC
            LIMIT 1
          )
        ) as thumbnail
      FROM albums a
      LEFT JOIN (
        SELECT album_id, COUNT(*) as count
        FROM image_albums
        GROUP BY album_id
      ) counts ON counts.album_id = a.id
      ${whereClause}
      ORDER BY a.date_created DESC
    `);

    return stmt.all();
  },

  update(id, data) {
    const fields = [];
    const values = [];

    // Update title only - slug remains unchanged to preserve URLs
    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.isHidden !== undefined) { fields.push('is_hidden = ?'); values.push(data.isHidden ? 1 : 0); }
    if (data.coverImageUuid !== undefined) { fields.push('cover_image_uuid = ?'); values.push(data.coverImageUuid); }

    if (fields.length === 0) return this.findById(id);

    fields.push('date_modified = ?');
    values.push(Date.now());

    values.push(id);
    const stmt = db.prepare(`UPDATE albums SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  },

  delete(id) {
    // Delete all image associations first
    const deleteAssocStmt = db.prepare('DELETE FROM image_albums WHERE album_id = ?');
    deleteAssocStmt.run(id);

    // Delete the album
    const stmt = db.prepare('DELETE FROM albums WHERE id = ?');
    return stmt.run(id);
  },

  getImageCount(id) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM image_albums WHERE album_id = ?');
    const result = stmt.get(id);
    return result.count;
  },

  getCoverImage(id) {
    // First check if album has an explicit cover
    const album = this.findById(id);
    if (album && album.cover_image_uuid) {
      const imageStmt = db.prepare('SELECT * FROM generated_images WHERE uuid = ?');
      return imageStmt.get(album.cover_image_uuid);
    }

    // Fall back to most recent image in album
    const stmt = db.prepare(`
      SELECT gi.* FROM generated_images gi
      INNER JOIN image_albums ia ON gi.uuid = ia.image_uuid
      WHERE ia.album_id = ?
      ORDER BY ia.date_added DESC
      LIMIT 1
    `);
    return stmt.get(id);
  }
};

// ImageAlbum model (junction table for images in albums)
export const ImageAlbum = {
  addImageToAlbum(imageUuid, albumId, autoHide = true) {
    const now = Date.now();

    // Check if the album is hidden and auto-hide the image
    const album = Album.findById(albumId);
    const albumIsHidden = album && (album.is_hidden === 1 || album.is_hidden === true);
    if (albumIsHidden && autoHide) {
      const updateStmt = db.prepare('UPDATE generated_images SET is_hidden = 1 WHERE uuid = ?');
      updateStmt.run(imageUuid);
    }

    // Check if already exists
    const existingStmt = db.prepare('SELECT id FROM image_albums WHERE image_uuid = ? AND album_id = ?');
    const existing = existingStmt.get(imageUuid, albumId);
    if (existing) {
      return existing;
    }

    const stmt = db.prepare(`
      INSERT INTO image_albums (image_uuid, album_id, date_added)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(imageUuid, albumId, now);
    return { id: result.lastInsertRowid, image_uuid: imageUuid, album_id: albumId, date_added: now };
  },

  addImagesToAlbum(imageUuids, albumId) {
    const results = [];
    for (const imageUuid of imageUuids) {
      results.push(this.addImageToAlbum(imageUuid, albumId));
    }
    return results;
  },

  removeImageFromAlbum(imageUuid, albumId) {
    const stmt = db.prepare('DELETE FROM image_albums WHERE image_uuid = ? AND album_id = ?');
    return stmt.run(imageUuid, albumId);
  },

  findAlbumsForImage(imageUuid, includeHidden = false) {
    let query = `
      SELECT a.* FROM albums a
      INNER JOIN image_albums ia ON a.id = ia.album_id
      WHERE ia.image_uuid = ?
    `;
    if (!includeHidden) {
      query += ' AND a.is_hidden = 0';
    }
    query += ' ORDER BY a.date_created DESC';

    const stmt = db.prepare(query);
    return stmt.all(imageUuid);
  },

  findImagesInAlbum(albumId, limit = 100, offset = 0, filters = {}) {
    let query = `
      SELECT gi.* FROM generated_images gi
      INNER JOIN image_albums ia ON gi.uuid = ia.image_uuid
      WHERE ia.album_id = ?
    `;
    const params = [albumId];

    if (filters.showFavorites) {
      query += ' AND gi.is_favorite = 1';
    }

    // For album view, we show all images in the album regardless of hidden status
    // unless specifically filtering for hidden only
    if (filters.showHiddenOnly) {
      query += ' AND gi.is_hidden = 1';
    }

    // Keyword search - search in prompt_simple
    if (filters.keywords && filters.keywords.length > 0) {
      for (const keyword of filters.keywords) {
        query += ' AND gi.prompt_simple LIKE ?';
        params.push(`%${keyword}%`);
      }
    }

    query += ' ORDER BY gi.date_created DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  countImagesInAlbum(albumId, filters = {}) {
    let query = `
      SELECT COUNT(*) as count FROM generated_images gi
      INNER JOIN image_albums ia ON gi.uuid = ia.image_uuid
      WHERE ia.album_id = ?
    `;
    const params = [albumId];

    if (filters.showFavorites) {
      query += ' AND gi.is_favorite = 1';
    }

    if (filters.showHiddenOnly) {
      query += ' AND gi.is_hidden = 1';
    }

    // Keyword search - search in prompt_simple
    if (filters.keywords && filters.keywords.length > 0) {
      for (const keyword of filters.keywords) {
        query += ' AND gi.prompt_simple LIKE ?';
        params.push(`%${keyword}%`);
      }
    }

    const stmt = db.prepare(query);
    const result = stmt.get(...params);
    return result.count;
  }
};

// UserSettings model
export const UserSettings = {
  get() {
    // For now, we'll just use a single settings record (id = 1)
    const selectStmt = db.prepare('SELECT * FROM user_settings WHERE id = 1');
    let settings = selectStmt.get();

    // Create default settings if none exist
    if (!settings) {
      const insertStmt = db.prepare(`
        INSERT INTO user_settings (id, api_key, default_params, favorite_models, favorite_styles, last_used_settings, worker_preferences, hidden_pin_hash, hidden_pin_enabled, date_modified)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        null,
        JSON.stringify({}),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify({}),
        JSON.stringify({ slowWorkers: true, trustedWorkers: false, nsfw: false, allowDowngrade: true, replacementFilter: true }),
        null,
        null,
        Date.now()
      );

      // Fetch the newly created record
      settings = selectStmt.get();
    }

    return settings;
  },

  update(data) {
    const fields = [];
    const values = [];

    if (data.apiKey !== undefined) { fields.push('api_key = ?'); values.push(data.apiKey); }
    if (data.defaultParams !== undefined) { fields.push('default_params = ?'); values.push(JSON.stringify(data.defaultParams)); }
    if (data.favoriteModels !== undefined) { fields.push('favorite_models = ?'); values.push(JSON.stringify(data.favoriteModels)); }
    if (data.favoriteStyles !== undefined) { fields.push('favorite_styles = ?'); values.push(JSON.stringify(data.favoriteStyles)); }
    if (data.lastUsedSettings !== undefined) { fields.push('last_used_settings = ?'); values.push(JSON.stringify(data.lastUsedSettings)); }
    if (data.workerPreferences !== undefined) { fields.push('worker_preferences = ?'); values.push(JSON.stringify(data.workerPreferences)); }
    if (data.hiddenPinHash !== undefined) { fields.push('hidden_pin_hash = ?'); values.push(data.hiddenPinHash); }
    if (data.hiddenPinEnabled !== undefined) { fields.push('hidden_pin_enabled = ?'); values.push(data.hiddenPinEnabled); }
    if (data.favoriteLoras !== undefined) { fields.push('favorite_loras = ?'); values.push(JSON.stringify(data.favoriteLoras)); }
    if (data.recentLoras !== undefined) { fields.push('recent_loras = ?'); values.push(JSON.stringify(data.recentLoras)); }
    if (data.favoriteTis !== undefined) { fields.push('favorite_tis = ?'); values.push(JSON.stringify(data.favoriteTis)); }
    if (data.recentTis !== undefined) { fields.push('recent_tis = ?'); values.push(JSON.stringify(data.recentTis)); }

    if (fields.length === 0) return this.get();

    fields.push('date_modified = ?');
    values.push(Date.now());

    const stmt = db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE id = 1`);
    stmt.run(...values);

    return this.get();
  }
};

// LoraCache model
export const LoraCache = {
  get(versionId) {
    const stmt = db.prepare('SELECT * FROM lora_cache WHERE version_id = ?');
    const cached = stmt.get(versionId);

    if (cached) {
      // Update last accessed timestamp
      const updateStmt = db.prepare('UPDATE lora_cache SET last_accessed = ? WHERE version_id = ?');
      updateStmt.run(Date.now(), versionId);

      return {
        ...cached,
        full_metadata: JSON.parse(cached.full_metadata)
      };
    }

    return null;
  },

  getMultiple(versionIds) {
    if (!versionIds || versionIds.length === 0) return [];

    const placeholders = versionIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM lora_cache WHERE version_id IN (${placeholders})`);
    const results = stmt.all(...versionIds);

    // Update last accessed for all found items
    const now = Date.now();
    const updateStmt = db.prepare('UPDATE lora_cache SET last_accessed = ? WHERE version_id = ?');

    return results.map(cached => {
      updateStmt.run(now, cached.version_id);
      return {
        ...cached,
        full_metadata: JSON.parse(cached.full_metadata)
      };
    });
  },

  set(versionId, modelId, metadata) {
    const now = Date.now();

    // Check if exists
    const existing = db.prepare('SELECT version_id FROM lora_cache WHERE version_id = ?').get(versionId);

    if (existing) {
      // Update existing
      const stmt = db.prepare(`
        UPDATE lora_cache
        SET model_id = ?, full_metadata = ?, last_accessed = ?
        WHERE version_id = ?
      `);
      stmt.run(modelId, JSON.stringify(metadata), now, versionId);
    } else {
      // Insert new
      const stmt = db.prepare(`
        INSERT INTO lora_cache (version_id, model_id, full_metadata, date_cached, last_accessed)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(versionId, modelId, JSON.stringify(metadata), now, now);
    }

    return this.get(versionId);
  },

  cleanup(maxAgeMs = 90 * 24 * 60 * 60 * 1000) { // Default: 90 days
    const cutoff = Date.now() - maxAgeMs;
    const stmt = db.prepare('DELETE FROM lora_cache WHERE last_accessed < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }
};

// TiCache model
export const TiCache = {
  get(versionId) {
    const stmt = db.prepare('SELECT * FROM ti_cache WHERE version_id = ?');
    const cached = stmt.get(versionId);

    if (cached) {
      // Update last accessed timestamp
      const updateStmt = db.prepare('UPDATE ti_cache SET last_accessed = ? WHERE version_id = ?');
      updateStmt.run(Date.now(), versionId);

      return {
        ...cached,
        full_metadata: JSON.parse(cached.full_metadata)
      };
    }

    return null;
  },

  getMultiple(versionIds) {
    if (!versionIds || versionIds.length === 0) return [];

    const placeholders = versionIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM ti_cache WHERE version_id IN (${placeholders})`);
    const results = stmt.all(...versionIds);

    // Update last accessed for all found items
    const now = Date.now();
    const updateStmt = db.prepare('UPDATE ti_cache SET last_accessed = ? WHERE version_id = ?');

    return results.map(cached => {
      updateStmt.run(now, cached.version_id);
      return {
        ...cached,
        full_metadata: JSON.parse(cached.full_metadata)
      };
    });
  },

  set(versionId, modelId, metadata) {
    const now = Date.now();

    // Check if exists
    const existing = db.prepare('SELECT version_id FROM ti_cache WHERE version_id = ?').get(versionId);

    if (existing) {
      // Update existing
      const stmt = db.prepare(`
        UPDATE ti_cache
        SET model_id = ?, full_metadata = ?, last_accessed = ?
        WHERE version_id = ?
      `);
      stmt.run(modelId, JSON.stringify(metadata), now, versionId);
    } else {
      // Insert new
      const stmt = db.prepare(`
        INSERT INTO ti_cache (version_id, model_id, full_metadata, date_cached, last_accessed)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(versionId, modelId, JSON.stringify(metadata), now, now);
    }

    return this.get(versionId);
  },

  cleanup(maxAgeMs = 90 * 24 * 60 * 60 * 1000) { // Default: 90 days
    const cutoff = Date.now() - maxAgeMs;
    const stmt = db.prepare('DELETE FROM ti_cache WHERE last_accessed < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }
};

// CivitAI Search Cache model
export const CivitaiSearchCache = {
  get(cacheKey) {
    const stmt = db.prepare('SELECT * FROM civitai_search_cache WHERE cache_key = ?');
    const cached = stmt.get(cacheKey);

    if (cached) {
      return {
        ...cached,
        result_data: JSON.parse(cached.result_data)
      };
    }

    return null;
  },

  set(cacheKey, resultData) {
    const now = Date.now();

    // Check if exists
    const existing = db.prepare('SELECT cache_key FROM civitai_search_cache WHERE cache_key = ?').get(cacheKey);

    if (existing) {
      // Update existing
      const stmt = db.prepare(`
        UPDATE civitai_search_cache
        SET result_data = ?, cached_at = ?
        WHERE cache_key = ?
      `);
      stmt.run(JSON.stringify(resultData), now, cacheKey);
    } else {
      // Insert new
      const stmt = db.prepare(`
        INSERT INTO civitai_search_cache (cache_key, result_data, cached_at)
        VALUES (?, ?, ?)
      `);
      stmt.run(cacheKey, JSON.stringify(resultData), now);
    }

    return this.get(cacheKey);
  },

  cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // Default: 7 days
    const cutoff = Date.now() - maxAgeMs;
    const stmt = db.prepare('DELETE FROM civitai_search_cache WHERE cached_at < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }
};

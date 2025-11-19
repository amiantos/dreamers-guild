import db from './database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { imagesDir } from './database.js';

// HordeRequest model
export const HordeRequest = {
  create(data) {
    const uuid = data.uuid || uuidv4();
    const stmt = db.prepare(`
      INSERT INTO horde_requests
      (uuid, date_created, prompt, full_request, status, message, n, queue_position, wait_time, total_kudos_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.totalKudosCost || 0
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
       image_path, thumbnail_path, is_favorite, is_hidden, is_trashed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.isHidden ? 1 : 0,
      data.isTrashed ? 1 : 0
    );

    return this.findById(uuid);
  },

  findById(uuid) {
    const stmt = db.prepare('SELECT * FROM generated_images WHERE uuid = ?');
    return stmt.get(uuid);
  },

  findAll(limit = 100, offset = 0, filters = {}) {
    let query = `
      SELECT * FROM generated_images
      WHERE is_trashed = 0
    `;

    const params = [];

    // Apply filters
    if (filters.showFavorites) {
      // Show favorited images
      query += ` AND is_favorite = 1`;
    }

    // Exclude hidden images unless includeHidden is true
    if (!filters.includeHidden) {
      query += ` AND is_hidden = 0`;
    }

    query += `
      ORDER BY date_created DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  countAll(filters = {}) {
    let query = `
      SELECT COUNT(*) as count FROM generated_images
      WHERE is_trashed = 0
    `;

    // Apply same filters as findAll
    if (filters.showFavorites) {
      query += ` AND is_favorite = 1`;
    }

    if (!filters.includeHidden) {
      query += ` AND is_hidden = 0`;
    }

    const stmt = db.prepare(query);
    const result = stmt.get();
    return result.count;
  },

  findByRequestId(requestId, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM generated_images
      WHERE request_id = ? AND is_trashed = 0
      ORDER BY date_created DESC
      LIMIT ?
    `);
    return stmt.all(requestId, limit);
  },

  countByRequestId(requestId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM generated_images
      WHERE request_id = ? AND is_trashed = 0
    `);
    const result = stmt.get(requestId);
    return result.count;
  },

  findByKeywords(keywords, limit = 100, filters = {}) {
    let query = `
      SELECT * FROM generated_images
      WHERE is_trashed = 0
    `;

    const params = [];

    // Split keywords by comma and add AND conditions for each
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    keywordList.forEach(keyword => {
      query += ` AND prompt_simple LIKE ?`;
      params.push(`%${keyword}%`);
    });

    // Apply filters
    if (filters.showFavorites) {
      // Show favorited images
      query += ` AND is_favorite = 1`;
    }

    // Exclude hidden images unless includeHidden is true
    if (!filters.includeHidden) {
      query += ` AND is_hidden = 0`;
    }

    query += `
      ORDER BY date_created DESC
      LIMIT ?
    `;

    params.push(limit);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  countByKeywords(keywords, filters = {}) {
    let query = `
      SELECT COUNT(*) as count FROM generated_images
      WHERE is_trashed = 0
    `;

    const params = [];

    // Split keywords by comma and add AND conditions for each (same as findByKeywords)
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    keywordList.forEach(keyword => {
      query += ` AND prompt_simple LIKE ?`;
      params.push(`%${keyword}%`);
    });

    // Apply same filters as findByKeywords
    if (filters.showFavorites) {
      query += ` AND is_favorite = 1`;
    }

    if (!filters.includeHidden) {
      query += ` AND is_hidden = 0`;
    }

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
    if (data.isTrashed !== undefined) { fields.push('is_trashed = ?'); values.push(data.isTrashed ? 1 : 0); }
    if (data.dateTrashed !== undefined) { fields.push('date_trashed = ?'); values.push(data.dateTrashed); }

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

    // Delete database record
    const stmt = db.prepare('DELETE FROM generated_images WHERE uuid = ?');
    return stmt.run(uuid);
  }
};

// HordePendingDownload model
export const HordePendingDownload = {
  create(data) {
    const uuid = data.uuid || uuidv4();
    const stmt = db.prepare(`
      INSERT INTO horde_pending_downloads
      (uuid, request_id, uri, full_request, full_response)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuid,
      data.requestId || null,
      data.uri || null,
      data.fullRequest || null,
      data.fullResponse || null
    );

    return this.findById(uuid);
  },

  findById(uuid) {
    const stmt = db.prepare('SELECT * FROM horde_pending_downloads WHERE uuid = ?');
    return stmt.get(uuid);
  },

  findAll() {
    const stmt = db.prepare('SELECT * FROM horde_pending_downloads');
    return stmt.all();
  },

  delete(uuid) {
    const stmt = db.prepare('DELETE FROM horde_pending_downloads WHERE uuid = ?');
    return stmt.run(uuid);
  }
};

// KeywordAlbum model
export const KeywordAlbum = {
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO keyword_albums (title, keywords)
      VALUES (?, ?)
    `);

    const result = stmt.run(data.title || null, data.keywords || null);
    return this.findById(result.lastInsertRowid);
  },

  findById(id) {
    const stmt = db.prepare('SELECT * FROM keyword_albums WHERE id = ?');
    return stmt.get(id);
  },

  findAll() {
    const stmt = db.prepare('SELECT * FROM keyword_albums');
    return stmt.all();
  },

  delete(id) {
    const stmt = db.prepare('DELETE FROM keyword_albums WHERE id = ?');
    return stmt.run(id);
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

    if (fields.length === 0) return this.get();

    fields.push('date_modified = ?');
    values.push(Date.now());

    const stmt = db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE id = 1`);
    stmt.run(...values);

    return this.get();
  }
};

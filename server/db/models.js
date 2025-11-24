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
    if (data.hordeId !== undefined) { fields.push('horde_id = ?'); values.push(data.hordeId); }

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

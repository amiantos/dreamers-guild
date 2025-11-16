import db from './database.js';
import { v4 as uuidv4 } from 'uuid';

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

  findAll(limit = 100, offset = 0) {
    const stmt = db.prepare(`
      SELECT * FROM generated_images
      WHERE is_trashed = 0
      ORDER BY date_created DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
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

  findByKeywords(keywords, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM generated_images
      WHERE is_trashed = 0 AND prompt_simple LIKE ?
      ORDER BY date_created DESC
      LIMIT ?
    `);
    return stmt.all(`%${keywords}%`, limit);
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

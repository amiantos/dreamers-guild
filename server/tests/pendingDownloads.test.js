import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tests for the HordePendingDownload unique constraint and duplicate handling
 *
 * These tests verify:
 * 1. The unique constraint on (request_id, uri) prevents duplicate downloads
 * 2. INSERT OR IGNORE gracefully handles duplicates
 * 3. Existing records are returned when duplicates are attempted
 */

// Create an in-memory test database
function createTestDatabase() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  // Create the horde_pending_downloads table
  db.exec(`
    CREATE TABLE horde_pending_downloads (
      uuid TEXT PRIMARY KEY,
      request_id TEXT,
      uri TEXT,
      full_request TEXT,
      full_response TEXT
    )
  `);

  // Add the unique constraint
  db.exec(`
    CREATE UNIQUE INDEX idx_pending_downloads_request_uri
    ON horde_pending_downloads(request_id, uri)
  `);

  return db;
}

// Model implementation matching the production code
function createHordePendingDownloadModel(db) {
  return {
    create(data) {
      const uuid = data.uuid || uuidv4();

      // Use INSERT OR IGNORE to silently skip duplicates
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

    delete(uuid) {
      const stmt = db.prepare('DELETE FROM horde_pending_downloads WHERE uuid = ?');
      return stmt.run(uuid);
    },

    deleteAll() {
      const stmt = db.prepare('DELETE FROM horde_pending_downloads');
      return stmt.run();
    }
  };
}

describe('HordePendingDownload Unique Constraint', () => {
  let db;
  let HordePendingDownload;

  beforeEach(() => {
    db = createTestDatabase();
    HordePendingDownload = createHordePendingDownloadModel(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('CREATE with INSERT OR IGNORE', () => {
    it('should create a new download record', () => {
      const result = HordePendingDownload.create({
        requestId: 'req-123',
        uri: 'https://example.com/image1.png',
        fullResponse: JSON.stringify({ id: 1 })
      });

      expect(result).toBeDefined();
      expect(result.request_id).toBe('req-123');
      expect(result.uri).toBe('https://example.com/image1.png');
    });

    it('should return existing record when duplicate is attempted', () => {
      // Create first record
      const first = HordePendingDownload.create({
        requestId: 'req-123',
        uri: 'https://example.com/image1.png',
        fullResponse: JSON.stringify({ id: 1 })
      });

      // Attempt to create duplicate
      const second = HordePendingDownload.create({
        requestId: 'req-123',
        uri: 'https://example.com/image1.png',
        fullResponse: JSON.stringify({ id: 2 }) // Different response
      });

      // Should return the same record (first one)
      expect(second.uuid).toBe(first.uuid);

      // Should only have one record in database
      const all = HordePendingDownload.findAll();
      expect(all.length).toBe(1);
    });

    it('should allow same URI with different request_id', () => {
      const first = HordePendingDownload.create({
        requestId: 'req-123',
        uri: 'https://example.com/image1.png'
      });

      const second = HordePendingDownload.create({
        requestId: 'req-456', // Different request
        uri: 'https://example.com/image1.png' // Same URI
      });

      // Should be different records
      expect(second.uuid).not.toBe(first.uuid);

      // Should have two records
      const all = HordePendingDownload.findAll();
      expect(all.length).toBe(2);
    });

    it('should allow different URI with same request_id', () => {
      const first = HordePendingDownload.create({
        requestId: 'req-123',
        uri: 'https://example.com/image1.png'
      });

      const second = HordePendingDownload.create({
        requestId: 'req-123', // Same request
        uri: 'https://example.com/image2.png' // Different URI
      });

      // Should be different records
      expect(second.uuid).not.toBe(first.uuid);

      // Should have two records
      const all = HordePendingDownload.findAll();
      expect(all.length).toBe(2);
    });
  });

  describe('Simulated Race Condition', () => {
    it('should handle concurrent duplicate inserts gracefully', () => {
      const requestId = 'req-race-test';
      const uri = 'https://example.com/race-image.png';

      // Simulate what happens when handleCompletedRequest is called multiple times
      // for the same request (the original bug scenario)
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = HordePendingDownload.create({
          requestId,
          uri,
          fullResponse: JSON.stringify({ attempt: i })
        });
        results.push(result);
      }

      // All results should have the same UUID (first insert wins)
      const uniqueUuids = [...new Set(results.map(r => r.uuid))];
      expect(uniqueUuids.length).toBe(1);

      // Database should only have one record
      const all = HordePendingDownload.findAll();
      expect(all.length).toBe(1);

      // The record should be from the first insert
      expect(JSON.parse(all[0].full_response).attempt).toBe(0);
    });

    it('should handle multiple images per request correctly', () => {
      const requestId = 'req-multi-image';
      const images = [
        'https://example.com/image1.png',
        'https://example.com/image2.png',
        'https://example.com/image3.png'
      ];

      // Simulate creating downloads for multiple images
      // This should work normally (different URIs)
      for (const uri of images) {
        HordePendingDownload.create({ requestId, uri });
      }

      // Simulate race condition - try to create all again
      for (const uri of images) {
        HordePendingDownload.create({ requestId, uri });
      }

      // Should still only have 3 records (one per unique URI)
      const all = HordePendingDownload.findAll();
      expect(all.length).toBe(3);
    });
  });

  describe('Migration: Duplicate Cleanup', () => {
    it('should handle pre-existing duplicates with migration query', () => {
      // Temporarily remove unique constraint to insert duplicates
      db.exec('DROP INDEX idx_pending_downloads_request_uri');

      // Insert duplicate records (simulating pre-migration state)
      const insertStmt = db.prepare(`
        INSERT INTO horde_pending_downloads
        (uuid, request_id, uri, full_response)
        VALUES (?, ?, ?, ?)
      `);

      insertStmt.run(uuidv4(), 'req-1', 'uri-1', 'response-1');
      insertStmt.run(uuidv4(), 'req-1', 'uri-1', 'response-2'); // Duplicate
      insertStmt.run(uuidv4(), 'req-1', 'uri-1', 'response-3'); // Duplicate
      insertStmt.run(uuidv4(), 'req-2', 'uri-2', 'response-4'); // Different

      // Verify duplicates exist
      expect(HordePendingDownload.findAll().length).toBe(4);

      // Run migration cleanup query (matching production code)
      const duplicates = db.prepare(`
        SELECT request_id, uri, COUNT(*) as count
        FROM horde_pending_downloads
        GROUP BY request_id, uri
        HAVING count > 1
      `).all();

      expect(duplicates.length).toBe(1);
      expect(duplicates[0].count).toBe(3);

      // Clean up duplicates
      for (const dup of duplicates) {
        const toDelete = db.prepare(`
          SELECT uuid FROM horde_pending_downloads
          WHERE request_id = ? AND uri = ?
          ORDER BY uuid
          LIMIT -1 OFFSET 1
        `).all(dup.request_id, dup.uri);

        for (const record of toDelete) {
          db.prepare('DELETE FROM horde_pending_downloads WHERE uuid = ?').run(record.uuid);
        }
      }

      // Should now have only 2 records (one for each unique request_id/uri pair)
      expect(HordePendingDownload.findAll().length).toBe(2);

      // Re-add unique constraint (should succeed now)
      db.exec(`
        CREATE UNIQUE INDEX idx_pending_downloads_request_uri
        ON horde_pending_downloads(request_id, uri)
      `);

      // Verify constraint works
      const result = HordePendingDownload.create({
        requestId: 'req-1',
        uri: 'uri-1'
      });

      // Should return existing record, not create duplicate
      expect(HordePendingDownload.findAll().length).toBe(2);
    });
  });
});

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '../../data');
const imagesDir = join(dataDir, 'images');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const dbPath = join(dataDir, 'dreamers-guild.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Migration helper: Add column if it doesn't exist
function addColumnIfNotExists(table, column, type, description = '') {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`Migration: Added ${column} column to ${table} table${description ? ` (${description})` : ''}`);
    return true;
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('duplicate column name')) {
      console.error(`Migration error adding ${column} to ${table}:`, error.message);
    }
    return false;
  }
}

// Initialize database schema
function initDatabase() {
  // HordeRequest table
  db.exec(`
    CREATE TABLE IF NOT EXISTS horde_requests (
      uuid TEXT PRIMARY KEY,
      date_created INTEGER NOT NULL,
      prompt TEXT,
      full_request TEXT,
      status TEXT,
      message TEXT,
      n INTEGER DEFAULT 0,
      queue_position INTEGER DEFAULT 0,
      wait_time INTEGER DEFAULT 0,
      total_kudos_cost INTEGER DEFAULT 0
    )
  `);

  // GeneratedImage table
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_images (
      uuid TEXT PRIMARY KEY,
      request_id TEXT,
      date_created INTEGER NOT NULL,
      backend TEXT,
      prompt_simple TEXT,
      full_request TEXT,
      full_response TEXT,
      image_path TEXT,
      thumbnail_path TEXT,
      is_favorite INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0
    )
  `);

  // HordePendingDownload table
  db.exec(`
    CREATE TABLE IF NOT EXISTS horde_pending_downloads (
      uuid TEXT PRIMARY KEY,
      request_id TEXT,
      uri TEXT,
      full_request TEXT,
      full_response TEXT
    )
  `);

  // KeywordAlbum table (legacy - used by Smart Albums clustering)
  db.exec(`
    CREATE TABLE IF NOT EXISTS keyword_albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      keywords TEXT
    )
  `);

  // User Albums table
  db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      is_hidden INTEGER DEFAULT 0,
      cover_image_uuid TEXT,
      date_created INTEGER NOT NULL,
      date_modified INTEGER NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Image-Albums junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS image_albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_uuid TEXT NOT NULL,
      album_id INTEGER NOT NULL,
      date_added INTEGER NOT NULL,
      UNIQUE(image_uuid, album_id)
    )
  `);

  // UserSettings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key TEXT,
      default_params TEXT,
      favorite_models TEXT,
      favorite_styles TEXT,
      last_used_settings TEXT,
      worker_preferences TEXT,
      date_modified INTEGER
    )
  `);

  // Run migrations for user_settings table
  addColumnIfNotExists('user_settings', 'worker_preferences', 'TEXT');
  addColumnIfNotExists('user_settings', 'hidden_pin_hash', 'TEXT');
  addColumnIfNotExists('user_settings', 'hidden_pin_enabled', 'INTEGER', 'NULL=not configured, 1=enabled, 0=declined');
  addColumnIfNotExists('user_settings', 'favorite_loras', 'TEXT', 'JSON array of favorite LoRA IDs');
  addColumnIfNotExists('user_settings', 'recent_loras', 'TEXT', 'JSON array of recently used LoRAs');
  addColumnIfNotExists('user_settings', 'favorite_tis', 'TEXT', 'JSON array of favorite TI IDs');
  addColumnIfNotExists('user_settings', 'recent_tis', 'TEXT', 'JSON array of recently used TIs');

  // Run migrations for horde_requests table
  addColumnIfNotExists('horde_requests', 'horde_id', 'TEXT', 'AI Horde request ID for status checking');
  addColumnIfNotExists('horde_requests', 'finished', 'INTEGER DEFAULT 0', 'Number of finished images');
  addColumnIfNotExists('horde_requests', 'waiting', 'INTEGER DEFAULT 0', 'Number of images waiting in queue');
  addColumnIfNotExists('horde_requests', 'processing', 'INTEGER DEFAULT 0', 'Number of images being processed');

  // Migration: Delete any trashed images (soft-delete cleanup)
  // This permanently removes images that were previously soft-deleted
  try {
    // Check if is_trashed column exists (for existing databases)
    const tableInfo = db.prepare("PRAGMA table_info(generated_images)").all();
    const hasTrashedColumn = tableInfo.some(col => col.name === 'is_trashed');

    if (hasTrashedColumn) {
      const trashedImages = db.prepare('SELECT uuid, image_path, thumbnail_path FROM generated_images WHERE is_trashed = 1').all();

      if (trashedImages.length > 0) {
        console.log(`Migration: Permanently deleting ${trashedImages.length} trashed images...`);

        for (const image of trashedImages) {
          // Delete image file
          if (image.image_path) {
            const imagePath = join(imagesDir, image.image_path);
            try {
              if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
              }
            } catch (err) {
              console.error(`Error deleting image file ${image.image_path}:`, err.message);
            }
          }

          // Delete thumbnail file
          if (image.thumbnail_path) {
            const thumbnailPath = join(imagesDir, image.thumbnail_path);
            try {
              if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
              }
            } catch (err) {
              console.error(`Error deleting thumbnail file ${image.thumbnail_path}:`, err.message);
            }
          }
        }

        // Delete all trashed records from database
        const deleteResult = db.prepare('DELETE FROM generated_images WHERE is_trashed = 1').run();
        console.log(`Migration: Deleted ${deleteResult.changes} trashed image records`);
      }
    }
  } catch (error) {
    console.error('Migration error cleaning up trashed images:', error.message);
  }

  // LoRA metadata cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lora_cache (
      version_id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      full_metadata TEXT NOT NULL,
      date_cached INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL
    )
  `);

  // Textual Inversion metadata cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ti_cache (
      version_id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      full_metadata TEXT NOT NULL,
      date_cached INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL
    )
  `);

  // CivitAI search cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS civitai_search_cache (
      cache_key TEXT PRIMARY KEY,
      result_data TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lora_cache_version
    ON lora_cache(version_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ti_cache_version
    ON ti_cache(version_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_images_date_created
    ON generated_images(date_created DESC)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_images_request_id
    ON generated_images(request_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_requests_date_created
    ON horde_requests(date_created DESC)
  `);

  // Albums indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_albums_slug
    ON albums(slug)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_albums_hidden
    ON albums(is_hidden)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_albums_sort_order
    ON albums(sort_order)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_albums_image
    ON image_albums(image_uuid)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_albums_album
    ON image_albums(album_id)
  `);

  console.log('Database initialized at', dbPath);
}

initDatabase();

export default db;
export { imagesDir };

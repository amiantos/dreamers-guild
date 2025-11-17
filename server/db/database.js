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

const dbPath = join(dataDir, 'aislingeach.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

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
      date_trashed INTEGER,
      backend TEXT,
      prompt_simple TEXT,
      full_request TEXT,
      full_response TEXT,
      image_path TEXT,
      thumbnail_path TEXT,
      is_favorite INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      is_trashed INTEGER DEFAULT 0,
      FOREIGN KEY (request_id) REFERENCES horde_requests(uuid)
    )
  `);

  // HordePendingDownload table
  db.exec(`
    CREATE TABLE IF NOT EXISTS horde_pending_downloads (
      uuid TEXT PRIMARY KEY,
      request_id TEXT,
      uri TEXT,
      full_request TEXT,
      full_response TEXT,
      FOREIGN KEY (request_id) REFERENCES horde_requests(uuid)
    )
  `);

  // KeywordAlbum table
  db.exec(`
    CREATE TABLE IF NOT EXISTS keyword_albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      keywords TEXT
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

  // Migration: Add worker_preferences column if it doesn't exist
  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN worker_preferences TEXT`);
    console.log('Migration: Added worker_preferences column to user_settings table');
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('duplicate column name')) {
      console.error('Migration error:', error.message);
    }
  }

  // Migration: Add hidden_pin_hash column if it doesn't exist
  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN hidden_pin_hash TEXT`);
    console.log('Migration: Added hidden_pin_hash column to user_settings table');
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('duplicate column name')) {
      console.error('Migration error:', error.message);
    }
  }

  // Migration: Add hidden_pin_enabled column if it doesn't exist
  // Values: NULL = not configured, 1 = enabled, 0 = explicitly declined
  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN hidden_pin_enabled INTEGER`);
    console.log('Migration: Added hidden_pin_enabled column to user_settings table');
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('duplicate column name')) {
      console.error('Migration error:', error.message);
    }
  }

  // Create indexes
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

  console.log('Database initialized at', dbPath);
}

initDatabase();

export default db;
export { imagesDir };

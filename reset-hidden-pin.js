#!/usr/bin/env node

/**
 * Admin script to reset the hidden gallery PIN
 *
 * Usage: node reset-hidden-pin.js
 *
 * This script will remove the PIN protection from the hidden gallery.
 * Use this if you've forgotten your PIN and need to reset it.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'data', 'aislingeach.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('========================================');
  console.log('  Hidden Gallery PIN Reset Tool');
  console.log('========================================');
  console.log('');
  console.log('This script will remove PIN protection from your hidden gallery.');
  console.log('You will be able to set a new PIN the next time you access the hidden gallery.');
  console.log('');

  const confirm = await question('Are you sure you want to reset the PIN? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('PIN reset cancelled.');
    rl.close();
    return;
  }

  try {
    const db = new Database(dbPath);

    // Check if settings table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'"
    ).get();

    if (!tableExists) {
      console.error('Error: user_settings table does not exist.');
      rl.close();
      db.close();
      return;
    }

    // Check if there's a PIN set
    const settings = db.prepare('SELECT * FROM user_settings WHERE id = 1').get();

    if (!settings) {
      console.log('No settings found. Nothing to reset.');
      rl.close();
      db.close();
      return;
    }

    if (!settings.hidden_pin_hash) {
      console.log('No PIN is currently set. Nothing to reset.');
      rl.close();
      db.close();
      return;
    }

    // Reset the PIN
    const stmt = db.prepare(
      'UPDATE user_settings SET hidden_pin_hash = NULL, hidden_pin_enabled = NULL, date_modified = ? WHERE id = 1'
    );

    stmt.run(Date.now());

    console.log('');
    console.log('✓ PIN has been successfully reset!');
    console.log('');
    console.log('You can now:');
    console.log('  1. Access the hidden gallery without a PIN');
    console.log('  2. Set a new PIN from the Settings menu');
    console.log('  3. Or set a new PIN the next time you access the hidden gallery');
    console.log('');

    db.close();
  } catch (error) {
    console.error('Error resetting PIN:', error.message);
    console.error('');
    console.error('If the error persists, you may need to manually edit the database.');
  }

  rl.close();
}

main().catch(console.error);

#!/usr/bin/env node

/**
 * Admin script to clean up orphaned image files
 *
 * Usage:
 *   node cleanup-orphaned-images.js           # Dry run (shows what would be deleted)
 *   node cleanup-orphaned-images.js --delete  # Actually delete orphaned files
 *
 * This script finds image files in the data/images directory that don't have
 * corresponding database records and optionally removes them.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'data', 'aislingeach.db');
const imagesDir = join(__dirname, 'data', 'images');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function main() {
  const shouldDelete = process.argv.includes('--delete');

  console.log('========================================');
  console.log('  Orphaned Image Cleanup Tool');
  console.log('========================================');
  console.log('');

  if (!shouldDelete) {
    console.log('Mode: DRY RUN (no files will be deleted)');
    console.log('Use --delete flag to actually remove orphaned files');
  } else {
    console.log('Mode: DELETE (orphaned files will be removed)');
  }
  console.log('');

  // Check if images directory exists
  if (!fs.existsSync(imagesDir)) {
    console.log('Images directory does not exist:', imagesDir);
    rl.close();
    return;
  }

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.error('Database does not exist:', dbPath);
    rl.close();
    return;
  }

  try {
    const db = new Database(dbPath);

    // Get all image records from database
    const images = db.prepare('SELECT image_path, thumbnail_path FROM generated_images').all();

    // Create a Set of all files that should exist
    const validFiles = new Set();
    images.forEach(img => {
      if (img.image_path) validFiles.add(img.image_path);
      if (img.thumbnail_path) validFiles.add(img.thumbnail_path);
    });

    console.log(`Database contains ${images.length} image records`);
    console.log(`Expected files: ${validFiles.size}`);
    console.log('');

    // Read all files from images directory
    const allFiles = fs.readdirSync(imagesDir);

    // Filter to only image files (ignore .gitkeep, etc.)
    const imageFiles = allFiles.filter(file => {
      const ext = file.toLowerCase();
      return ext.endsWith('.png') ||
             ext.endsWith('.jpg') ||
             ext.endsWith('.jpeg') ||
             ext.endsWith('.webp') ||
             ext.endsWith('.gif');
    });

    console.log(`Found ${imageFiles.length} image files in directory`);
    console.log('');

    // Find orphaned files
    const orphanedFiles = [];
    let totalOrphanedSize = 0;

    imageFiles.forEach(file => {
      if (!validFiles.has(file)) {
        const filePath = join(imagesDir, file);
        const stats = fs.statSync(filePath);
        orphanedFiles.push({
          name: file,
          path: filePath,
          size: stats.size
        });
        totalOrphanedSize += stats.size;
      }
    });

    if (orphanedFiles.length === 0) {
      console.log('✓ No orphaned files found! Directory is clean.');
      console.log('');
      db.close();
      rl.close();
      return;
    }

    console.log(`Found ${orphanedFiles.length} orphaned files:`);
    console.log('');

    // Show first 20 orphaned files
    const showCount = Math.min(20, orphanedFiles.length);
    orphanedFiles.slice(0, showCount).forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.name} (${formatBytes(file.size)})`);
    });

    if (orphanedFiles.length > showCount) {
      console.log(`  ... and ${orphanedFiles.length - showCount} more`);
    }

    console.log('');
    console.log(`Total orphaned files: ${orphanedFiles.length}`);
    console.log(`Total space used: ${formatBytes(totalOrphanedSize)}`);
    console.log('');

    if (!shouldDelete) {
      console.log('To delete these orphaned files, run:');
      console.log('  node cleanup-orphaned-images.js --delete');
      console.log('');
      db.close();
      rl.close();
      return;
    }

    // Confirm deletion
    console.log('⚠️  WARNING: You are about to delete these files permanently!');
    console.log('');
    const confirm = await question('Are you sure you want to delete all orphaned files? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Deletion cancelled.');
      db.close();
      rl.close();
      return;
    }

    console.log('');
    console.log('Deleting orphaned files...');
    console.log('');

    let deletedCount = 0;
    let deletedSize = 0;
    let errorCount = 0;

    orphanedFiles.forEach(file => {
      try {
        fs.unlinkSync(file.path);
        deletedCount++;
        deletedSize += file.size;
        if (deletedCount <= 10 || deletedCount % 50 === 0) {
          console.log(`  ✓ Deleted: ${file.name}`);
        }
      } catch (error) {
        console.error(`  ✗ Error deleting ${file.name}: ${error.message}`);
        errorCount++;
      }
    });

    console.log('');
    console.log('========================================');
    console.log('  Cleanup Complete');
    console.log('========================================');
    console.log(`Files deleted: ${deletedCount}`);
    console.log(`Space freed: ${formatBytes(deletedSize)}`);
    if (errorCount > 0) {
      console.log(`Errors: ${errorCount}`);
    }
    console.log('');

    db.close();
  } catch (error) {
    console.error('Error during cleanup:', error.message);
    console.error('');
  }

  rl.close();
}

main().catch(console.error);

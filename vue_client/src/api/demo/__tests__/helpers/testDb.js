/**
 * IndexedDB test utilities for demo mode API tests
 * Provides helpers for setting up and tearing down test databases
 */

import * as db from '../../db.js'

/**
 * Clear all IndexedDB stores for a fresh test state
 * Call this in beforeEach to ensure test isolation
 */
export async function clearDatabase() {
  try {
    await db.clearAllStores()
  } catch (error) {
    // Database might not exist yet, which is fine
    if (!error.message?.includes('database')) {
      throw error
    }
  }
}

/**
 * Seed the requests store with test data
 * @param {Array} requests - Array of request objects
 */
export async function seedRequests(requests) {
  for (const request of requests) {
    await db.put('requests', request)
  }
}

/**
 * Seed the images store with test data
 * @param {Array} images - Array of image objects
 */
export async function seedImages(images) {
  for (const image of images) {
    await db.put('images', image)
  }
}

/**
 * Seed the imageBlobs store with test data
 * @param {Array} blobs - Array of blob objects
 */
export async function seedImageBlobs(blobs) {
  for (const blob of blobs) {
    await db.put('imageBlobs', blob)
  }
}

/**
 * Get all records from a store
 * @param {string} storeName - Name of the store
 * @returns {Promise<Array>} All records
 */
export async function getAllFromStore(storeName) {
  return db.getAll(storeName)
}

/**
 * Get a single record by key
 * @param {string} storeName - Name of the store
 * @param {string} key - Record key
 * @returns {Promise<Object|undefined>} The record or undefined
 */
export async function getFromStore(storeName, key) {
  return db.get(storeName, key)
}

/**
 * Count records in a store
 * @param {string} storeName - Name of the store
 * @returns {Promise<number>} Record count
 */
export async function countInStore(storeName) {
  return db.count(storeName)
}

/**
 * Delete the test database completely
 * Use this in afterAll for complete cleanup
 */
export async function deleteDatabase() {
  return new Promise((resolve, reject) => {
    // Close any open connections first
    const request = indexedDB.deleteDatabase('dreamers-guild-demo')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      // Database is blocked, try again after a short delay
      setTimeout(() => {
        indexedDB.deleteDatabase('dreamers-guild-demo')
        resolve()
      }, 100)
    }
  })
}

/**
 * Wait for database to be ready
 */
export async function waitForDatabase() {
  await db.openDatabase()
}

// Re-export db functions for convenience
export { db }

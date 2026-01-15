const DB_NAME = 'dreamers-guild-demo'
const DB_VERSION = 2

let dbInstance = null

const DB_SCHEMA = {
  requests: {
    keyPath: 'uuid',
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'date_created', keyPath: 'date_created' }
    ]
  },
  images: {
    keyPath: 'uuid',
    indexes: [
      { name: 'request_id', keyPath: 'request_id' },
      { name: 'date_created', keyPath: 'date_created' },
      { name: 'is_favorite', keyPath: 'is_favorite' },
      { name: 'is_hidden', keyPath: 'is_hidden' }
    ]
  },
  imageBlobs: {
    keyPath: 'uuid'
  },
  sourceImages: {
    keyPath: 'id'
  }
}

export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = (event) => {
      console.error('[DB] Failed to open database:', event.target.error)
      reject(new Error('Failed to open database'))
    }

    request.onsuccess = (event) => {
      dbInstance = event.target.result
      // Handle database connection closing unexpectedly
      dbInstance.onversionchange = () => {
        dbInstance.close()
        dbInstance = null
        console.log('[DB] Database version changed, connection closed')
      }
      resolve(dbInstance)
    }

    request.onblocked = () => {
      console.warn('[DB] Database upgrade blocked - please close other tabs')
    }

    request.onupgradeneeded = (event) => {
      console.log('[DB] Upgrading database from version', event.oldVersion, 'to', event.newVersion)
      const db = event.target.result

      for (const [storeName, config] of Object.entries(DB_SCHEMA)) {
        if (!db.objectStoreNames.contains(storeName)) {
          console.log('[DB] Creating object store:', storeName)
          const store = db.createObjectStore(storeName, { keyPath: config.keyPath })

          if (config.indexes) {
            for (const index of config.indexes) {
              store.createIndex(index.name, index.keyPath, index.options || {})
            }
          }
        }
      }
    }
  })
}

export async function getAll(storeName, indexName = null, query = null) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const source = indexName ? store.index(indexName) : store
    const request = query ? source.getAll(query) : source.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function get(storeName, key) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function put(storeName, value) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(value)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function add(storeName, value) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.add(value)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function remove(storeName, key) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function clear(storeName) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function count(storeName, indexName = null, query = null) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const source = indexName ? store.index(indexName) : store
    const request = query ? source.count(query) : source.count()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllWithCursor(storeName, options = {}) {
  const db = await openDatabase()
  const { indexName, direction = 'prev', limit, offset = 0, filter } = options

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const source = indexName ? store.index(indexName) : store
    const request = source.openCursor(null, direction)

    const results = []
    let skipped = 0
    let counted = 0

    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (!cursor) {
        resolve(results)
        return
      }

      const value = cursor.value
      const passesFilter = !filter || filter(value)

      if (passesFilter) {
        if (skipped < offset) {
          skipped++
        } else if (!limit || counted < limit) {
          results.push(value)
          counted++
        } else {
          resolve(results)
          return
        }
      }

      cursor.continue()
    }

    request.onerror = () => reject(request.error)
  })
}

export async function countWithFilter(storeName, filter) {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.openCursor()

    let count = 0

    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (!cursor) {
        resolve(count)
        return
      }

      if (filter(cursor.value)) {
        count++
      }

      cursor.continue()
    }

    request.onerror = () => reject(request.error)
  })
}

export async function clearAllStores() {
  const db = await openDatabase()
  const storeNames = Array.from(db.objectStoreNames)

  for (const storeName of storeNames) {
    await clear(storeName)
  }
}

export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      usagePercent: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
    }
  }
  return { usage: 0, quota: 0, usagePercent: 0 }
}

// Source image storage helpers for img2img

/**
 * Save a source image blob to IndexedDB.
 * @param {string} id - Unique identifier for the source image
 * @param {Blob} blob - The image blob to store
 * @returns {Promise<void>}
 */
export async function saveSourceImage(id, blob) {
  await put('sourceImages', { id, blob, date_created: new Date().toISOString() })
}

/**
 * Retrieve a source image blob from IndexedDB.
 * @param {string} id - Unique identifier for the source image
 * @returns {Promise<Blob|null>} - The stored blob or null if not found
 */
export async function getSourceImage(id) {
  const record = await get('sourceImages', id)
  return record ? record.blob : null
}

/**
 * Delete a source image from IndexedDB.
 * @param {string} id - Unique identifier for the source image
 * @returns {Promise<void>}
 */
export async function deleteSourceImage(id) {
  await remove('sourceImages', id)
}

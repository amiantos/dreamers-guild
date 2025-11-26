const DB_NAME = 'aislingeach-demo'
const DB_VERSION = 1

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
  }
}

export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open database'))
    }

    request.onsuccess = (event) => {
      dbInstance = event.target.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      for (const [storeName, config] of Object.entries(DB_SCHEMA)) {
        if (!db.objectStoreNames.contains(storeName)) {
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

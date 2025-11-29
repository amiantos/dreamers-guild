/**
 * Album Cache Service
 *
 * Caches album results for different filter combinations to improve performance.
 * Cache is invalidated when new images are generated.
 */

class AlbumCache {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
  }

  /**
   * Generate a cache key from filter parameters
   */
  getCacheKey(showFavorites, showHiddenOnly) {
    return `favorites:${showFavorites}_hiddenOnly:${showHiddenOnly}`;
  }

  /**
   * Get cached albums for given filters
   */
  get(showFavorites, showHiddenOnly) {
    const key = this.getCacheKey(showFavorites, showHiddenOnly);
    return this.cache.get(key) || null;
  }

  /**
   * Store albums in cache
   */
  set(showFavorites, showHiddenOnly, albums) {
    const key = this.getCacheKey(showFavorites, showHiddenOnly);
    this.cache.set(key, albums);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Invalidate all cached entries
   */
  invalidate() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidateKey(showFavorites, showHiddenOnly) {
    const key = this.getCacheKey(showFavorites, showHiddenOnly);
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      timestamps: Object.fromEntries(this.cacheTimestamps)
    };
  }
}

// Singleton instance
const albumCache = new AlbumCache();

export default albumCache;

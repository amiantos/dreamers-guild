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
  getCacheKey(showFavorites, showHiddenOnly, includeHidden = false) {
    return `favorites:${showFavorites}_hiddenOnly:${showHiddenOnly}_includeHidden:${includeHidden}`;
  }

  /**
   * Get cached albums for given filters
   */
  get(showFavorites, showHiddenOnly, includeHidden = false) {
    const key = this.getCacheKey(showFavorites, showHiddenOnly, includeHidden);
    return this.cache.get(key) || null;
  }

  /**
   * Store albums in cache
   */
  set(showFavorites, showHiddenOnly, albums, includeHidden = false) {
    const key = this.getCacheKey(showFavorites, showHiddenOnly, includeHidden);
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

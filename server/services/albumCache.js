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
  getCacheKey(showFavorites, includeHidden) {
    return `favorites:${showFavorites}_hidden:${includeHidden}`;
  }

  /**
   * Get cached albums for given filters
   */
  get(showFavorites, includeHidden) {
    const key = this.getCacheKey(showFavorites, includeHidden);
    const cached = this.cache.get(key);

    if (cached) {
      console.log(`[AlbumCache] Cache HIT for ${key}`);
      return cached;
    }

    console.log(`[AlbumCache] Cache MISS for ${key}`);
    return null;
  }

  /**
   * Store albums in cache
   */
  set(showFavorites, includeHidden, albums) {
    const key = this.getCacheKey(showFavorites, includeHidden);
    this.cache.set(key, albums);
    this.cacheTimestamps.set(key, Date.now());
    console.log(`[AlbumCache] Cached ${albums.length} albums for ${key}`);
  }

  /**
   * Invalidate all cached entries
   */
  invalidate() {
    const size = this.cache.size;
    this.cache.clear();
    this.cacheTimestamps.clear();
    console.log(`[AlbumCache] Invalidated ${size} cache entries`);
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidateKey(showFavorites, includeHidden) {
    const key = this.getCacheKey(showFavorites, includeHidden);
    const deleted = this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    if (deleted) {
      console.log(`[AlbumCache] Invalidated cache for ${key}`);
    }
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

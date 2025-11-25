import express from 'express';
import db from '../db/database.js';
import albumCache from '../services/albumCache.js';

const router = express.Router();

/**
 * Boilerplate keywords to exclude from album analysis
 */
const BOILERPLATE_KEYWORDS = new Set([
  'masterpiece', 'best quality', 'amazing quality', 'very aesthetic',
  'high resolution', 'ultra-detailed', 'absurdres', 'intricate',
  'detailed', 'highly detailed', 'extremely detailed', 'insane details',
  'hyper detailed', 'ultra detailed', 'very detailed', 'intricate details',
  'hyperdetailed', 'maximum details', 'meticulous', 'magnificent',
  'score_9', 'score_8_up', 'score_7_up', 'score_6_up', 'score_5_up',
  'score_4_up', 'score_3_up', 'score_2_up', 'score_1_up',
  'looking at viewer', 'solo', 'depth of field', 'volumetric lighting',
  'scenery', 'newest', 'sharp focus', 'elegant', 'cinematic look',
  'soothing tones', 'soft cinematic light', 'low contrast', 'dim colors',
  'exposure blend', 'hdr', 'faded'
]);

/**
 * Extract and count keywords from prompts using TF-IDF scoring
 * @param {Array} promptData - Array of objects with {prompt, isFavorite}
 * @param {number} limit - Number of top keywords to return
 */
function extractKeywords(promptData, limit = 20) {
  const keywordCounts = new Map(); // Total occurrences of each keyword
  const documentFrequency = new Map(); // Number of prompts containing each keyword
  const favoriteKeywords = new Set(); // Keywords that appear in favorite images

  promptData.forEach(({ prompt, isFavorite }) => {
    if (!prompt) return;

    // Get positive prompts (before "###")
    let positivePrompt = prompt.split('###')[0];

    // Remove parentheses and their content (including nested ones)
    positivePrompt = positivePrompt.replace(/\([^)]*\)/g, '');

    // Remove weight numbers like :1.2
    positivePrompt = positivePrompt.replace(/:\d+\.?\d*/g, '');

    // Split by commas and process each keyword
    const keywords = positivePrompt.split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .filter(k => !k.startsWith('score_')); // Filter out score_ keywords

    // Track unique keywords in this prompt for document frequency
    const uniqueKeywords = new Set(keywords);

    keywords.forEach(keyword => {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);

      // Track if this keyword appears in a favorite
      if (isFavorite) {
        favoriteKeywords.add(keyword);
      }
    });

    // Update document frequency
    uniqueKeywords.forEach(keyword => {
      documentFrequency.set(keyword, (documentFrequency.get(keyword) || 0) + 1);
    });
  });

  const totalPrompts = promptData.length;

  // Dynamic minimum threshold: require keywords to appear in at least 3% of images
  // but with a minimum of 5 occurrences (for small datasets) and max of 100 (for very large datasets)
  const minThreshold = Math.max(5, Math.min(100, Math.floor(totalPrompts * 0.03)));

  // Calculate TF-IDF scores with balanced scoring
  const keywordScores = Array.from(keywordCounts.entries())
    .filter(([keyword, count]) => count >= minThreshold) // Filter out rare keywords
    .map(([keyword, count]) => {
      const df = documentFrequency.get(keyword) || 1;
      const idf = Math.log(totalPrompts / df);

      // Use sublinear TF scaling to dampen high-frequency terms
      // Keep IDF linear for balanced distinctiveness boost
      let tfidf = Math.log(1 + count) * idf;

      // Boost keywords from favorite images by 2x
      if (favoriteKeywords.has(keyword)) {
        tfidf *= 2;
      }

      return { keyword, count, tfidf };
    });

  // Sort by TF-IDF score and return top keywords
  return keywordScores
    .sort((a, b) => b.tfidf - a.tfidf)
    .slice(0, limit)
    .map(({ keyword, count }) => ({ keyword, count }));
}

/**
 * Group keywords that appear in the same images together
 * @param {Array} keywords - Array of {keyword, count} objects
 * @param {string} baseWhere - SQL WHERE clause for filtering
 */
function groupKeywordsByOverlap(keywords, baseWhere) {
  const groups = [];
  const processed = new Set();

  // For each keyword, get the UUIDs of images containing it
  const keywordImageSets = keywords.map(({ keyword, count }) => {
    const images = db.prepare(`
      SELECT uuid FROM generated_images
      WHERE ${baseWhere} AND prompt_simple LIKE ?
    `).all(`%${keyword}%`).map(row => row.uuid);

    return {
      keyword,
      count,
      imageSet: new Set(images)
    };
  });

  // Group keywords with high overlap (>80% Jaccard similarity)
  for (let i = 0; i < keywordImageSets.length; i++) {
    if (processed.has(i)) continue;

    const group = {
      keywords: [keywordImageSets[i].keyword],
      count: keywordImageSets[i].count,
      imageSet: keywordImageSets[i].imageSet
    };
    processed.add(i);

    // Find all keywords with high overlap
    for (let j = i + 1; j < keywordImageSets.length; j++) {
      if (processed.has(j)) continue;

      const set1 = group.imageSet;
      const set2 = keywordImageSets[j].imageSet;

      // Calculate Jaccard similarity
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      const jaccard = intersection.size / union.size;

      // If >80% overlap, merge into this group
      if (jaccard > 0.8) {
        group.keywords.push(keywordImageSets[j].keyword);
        processed.add(j);
      }
    }

    groups.push({
      keywords: group.keywords,
      count: group.imageSet.size,
      imageSet: group.imageSet
    });
  }

  // Filter out single-keyword groups that are fully covered by multi-keyword groups
  // Build a set of all images covered by multi-keyword groups
  const multiKeywordGroups = groups.filter(g => g.keywords.length > 1);
  const coveredImages = new Set();
  multiKeywordGroups.forEach(group => {
    group.imageSet.forEach(uuid => coveredImages.add(uuid));
  });

  // Only keep single-keyword groups if they have unique images
  const filteredGroups = groups.filter(group => {
    if (group.keywords.length > 1) {
      // Keep all multi-keyword groups
      return true;
    }

    // For single-keyword groups, check if they have any unique images
    const uniqueImages = [...group.imageSet].filter(uuid => !coveredImages.has(uuid));
    if (uniqueImages.length > 0) {
      // Keep the group, but count stays as total images (not just unique)
      return true;
    }

    return false;
  });

  // Remove imageSet from final output (no longer needed)
  return filteredGroups.map(({ keywords, count }) => ({ keywords, count }));
}

/**
 * Generate albums from filters
 * @param {boolean} showFavorites - Only show favorite images
 * @param {boolean} includeHidden - Include hidden images
 * @returns {Array} Array of album objects
 */
function generateAlbumsForFilters(showFavorites, includeHidden) {
  const albums = [];

  // Build base query for filtering
  let baseWhere = 'is_trashed = 0';
  if (showFavorites) {
    baseWhere += ' AND is_favorite = 1';
  }
  if (!includeHidden) {
    baseWhere += ' AND is_hidden = 0';
  }

  // Get prompts for analysis
  const promptData = db.prepare(`
    SELECT prompt_simple, is_favorite FROM generated_images
    WHERE ${baseWhere}
  `).all().map(row => ({
    prompt: row.prompt_simple,
    isFavorite: row.is_favorite === 1
  }));

  // Skip if no data
  if (promptData.length === 0) {
    return albums;
  }

  // Simple frequency-based albums: show any keyword with ≥50 images
  const totalImages = promptData.length;
  const minThreshold = Math.max(20, Math.min(50, Math.floor(totalImages * 0.02)));

  // Extract keywords with TF-IDF but use it only for ordering, not filtering
  const topKeywords = extractKeywords(promptData, 100);

  // Filter by frequency threshold and exclude boilerplate
  const eligibleKeywords = topKeywords
    .filter(({ keyword, count }) =>
      count >= minThreshold && !BOILERPLATE_KEYWORDS.has(keyword.toLowerCase())
    );

  // Group keywords by image overlap
  const keywordGroups = groupKeywordsByOverlap(eligibleKeywords, baseWhere);

  // Sort groups by image count (highest first)
  keywordGroups.sort((a, b) => b.count - a.count);

  // Create albums from groups
  keywordGroups.forEach(group => {
    // Get most recent image for this keyword group
    const thumbnail = db.prepare(`
      SELECT uuid FROM generated_images
      WHERE ${baseWhere} AND prompt_simple LIKE ?
      ORDER BY date_created DESC
      LIMIT 1
    `).get(`%${group.keywords[0]}%`);

    albums.push({
      id: `keyword:${group.keywords.join('+')}`,
      name: group.keywords.join(', '),
      type: 'keyword',
      keywords: group.keywords,
      count: group.count,
      thumbnail: thumbnail ? thumbnail.uuid : null
    });
  });

  return albums;
}

/**
 * GET /api/albums
 * Get all keyword albums extracted from image prompts
 */
router.get('/', (req, res) => {
  try {
    // Parse filter params for context-aware keyword albums
    const showFavorites = req.query.favorites === 'true';
    const includeHidden = req.query.includeHidden === 'true';

    // Check cache first
    const cachedAlbums = albumCache.get(showFavorites, includeHidden);
    if (cachedAlbums) {
      return res.json(cachedAlbums);
    }

    // Cache miss - generate albums
    const albums = generateAlbumsForFilters(showFavorites, includeHidden);

    // Store in cache
    albumCache.set(showFavorites, includeHidden, albums);

    res.json(albums);
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

/**
 * Warm up the album cache on server startup
 * Pre-generates albums for all common filter combinations
 */
export async function warmAlbumCache() {
  const filterCombinations = [
    { favorites: false, includeHidden: false }, // Default view
    { favorites: false, includeHidden: true },  // With hidden
    { favorites: true, includeHidden: false },  // Favorites only
    { favorites: true, includeHidden: true }    // Favorites with hidden
  ];

  for (const filters of filterCombinations) {
    try {
      // Generate and cache albums for this filter combination
      const albums = generateAlbumsForFilters(filters.favorites, filters.includeHidden);

      // Only cache if we generated albums
      if (albums.length > 0) {
        albumCache.set(filters.favorites, filters.includeHidden, albums);
      }
    } catch (error) {
      console.error(`[AlbumCache] Error warming cache for favorites=${filters.favorites}, includeHidden=${filters.includeHidden}:`, error.message);
    }
  }
}

export default router;

import express from 'express';
import db from '../db/database.js';
import { LoraCache, TiCache, GeneratedImage } from '../db/models.js';
import albumCache from '../services/albumCache.js';
import {
  extractIdentityKeywords,
  jaccardSimilarity,
  formatLoraName,
  BOILERPLATE_KEYWORDS
} from '../utils/keywordCategories.js';

const router = express.Router();

/**
 * Minimum number of images required to create an album
 */
const MIN_ALBUM_SIZE = 5;

/**
 * Similarity threshold for clustering (0-1)
 */
const SIMILARITY_THRESHOLD = 0.6;

/**
 * Threshold for considering a LoRA as "utility" (general purpose)
 * If a LoRA appears with more than this many different co-LoRAs, it's likely utility
 */
const UTILITY_LORA_COLORA_THRESHOLD = 10;

/**
 * Threshold for keyword variance to detect utility LoRAs
 * If Jaccard similarity of keywords across images is below this, it's utility
 */
const UTILITY_LORA_KEYWORD_VARIANCE_THRESHOLD = 0.3;

/**
 * Extract identity fingerprint from an image
 * @param {Object} image - Image row from database
 * @returns {Object} Fingerprint with uuid, loras, tis, model, identityKeywords
 */
function extractFingerprint(image) {
  let fullRequest = {};
  try {
    fullRequest = JSON.parse(image.full_request || '{}');
  } catch {
    // Invalid JSON, use empty object
  }

  const params = fullRequest.params || {};
  const prompt = fullRequest.prompt || image.prompt_simple || '';

  return {
    uuid: image.uuid,
    loras: new Set((params.loras || []).map(l => l.name)),
    tis: new Set((params.tis || []).map(t => t.name)),
    model: fullRequest.models?.[0] || 'unknown',
    identityKeywords: extractIdentityKeywords(prompt),
    dateCreated: image.date_created
  };
}

/**
 * Detect utility LoRAs that shouldn't be used for grouping
 * A utility LoRA is one that:
 * - Is used with many different other LoRAs (style/quality enhancers)
 * - Has high variance in identity keywords across its images (not character-specific)
 * @param {Array} fingerprints - All image fingerprints
 * @returns {Set} Set of LoRA IDs that are considered utility
 */
function detectUtilityLoras(fingerprints) {
  const utilityLoras = new Set();

  // Build LoRA usage statistics
  const loraStats = new Map(); // loraId -> { coLoras: Set, keywordSets: Array<Set> }

  for (const fp of fingerprints) {
    for (const loraId of fp.loras) {
      if (!loraStats.has(loraId)) {
        loraStats.set(loraId, { coLoras: new Set(), keywordSets: [], imageCount: 0 });
      }

      const stats = loraStats.get(loraId);
      stats.imageCount++;

      // Track co-LoRAs (other LoRAs used in same image)
      for (const otherLora of fp.loras) {
        if (otherLora !== loraId) {
          stats.coLoras.add(otherLora);
        }
      }

      // Track identity keywords for this image
      if (fp.identityKeywords.size > 0) {
        stats.keywordSets.push(fp.identityKeywords);
      }
    }
  }

  // Analyze each LoRA
  for (const [loraId, stats] of loraStats) {
    // Skip LoRAs with few images
    if (stats.imageCount < MIN_ALBUM_SIZE) continue;

    // Check 1: Too many co-LoRAs suggests it's a utility/style LoRA
    if (stats.coLoras.size >= UTILITY_LORA_COLORA_THRESHOLD) {
      utilityLoras.add(loraId);
      continue;
    }

    // Check 2: High keyword variance suggests it's not character-specific
    if (stats.keywordSets.length >= 2) {
      // Calculate average pairwise Jaccard similarity of keywords
      let totalSimilarity = 0;
      let pairCount = 0;

      for (let i = 0; i < Math.min(stats.keywordSets.length, 20); i++) {
        for (let j = i + 1; j < Math.min(stats.keywordSets.length, 20); j++) {
          totalSimilarity += jaccardSimilarity(stats.keywordSets[i], stats.keywordSets[j]);
          pairCount++;
        }
      }

      const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 1;

      // Low similarity = high variance = utility LoRA
      if (avgSimilarity < UTILITY_LORA_KEYWORD_VARIANCE_THRESHOLD) {
        utilityLoras.add(loraId);
      }
    }
  }

  return utilityLoras;
}

/**
 * Calculate similarity between two fingerprints
 * Uses weighted scoring: LoRAs (3), TIs (2), Model (1), Keywords (3)
 * @param {Object} fp1 - First fingerprint
 * @param {Object} fp2 - Second fingerprint
 * @param {Set} utilityLoras - Set of LoRA IDs to exclude from similarity
 * @returns {number} Similarity score between 0 and 1
 */
function calculateSimilarity(fp1, fp2, utilityLoras = new Set()) {
  let score = 0;
  let maxScore = 0;

  // Filter out utility LoRAs for comparison
  const loras1 = new Set([...fp1.loras].filter(l => !utilityLoras.has(l)));
  const loras2 = new Set([...fp2.loras].filter(l => !utilityLoras.has(l)));

  // LoRA overlap (weight: 3)
  if (loras1.size > 0 || loras2.size > 0) {
    score += jaccardSimilarity(loras1, loras2) * 3;
    maxScore += 3;
  }

  // TI overlap (weight: 2)
  if (fp1.tis.size > 0 || fp2.tis.size > 0) {
    score += jaccardSimilarity(fp1.tis, fp2.tis) * 2;
    maxScore += 2;
  }

  // Model match (weight: 1)
  maxScore += 1;
  if (fp1.model === fp2.model) {
    score += 1;
  }

  // Identity keyword overlap (weight: 3)
  if (fp1.identityKeywords.size > 0 || fp2.identityKeywords.size > 0) {
    score += jaccardSimilarity(fp1.identityKeywords, fp2.identityKeywords) * 3;
    maxScore += 3;
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Cluster images by fingerprint similarity
 * Uses greedy clustering algorithm
 * @param {Array} fingerprints - Array of fingerprint objects
 * @param {Set} utilityLoras - Set of utility LoRA IDs to exclude
 * @returns {Array} Array of clusters, each containing fingerprints
 */
function clusterImages(fingerprints, utilityLoras) {
  const clusters = [];
  const assigned = new Set();

  // Sort by number of identity features (more features = better cluster seed)
  const sorted = [...fingerprints].sort((a, b) => {
    const aLoras = [...a.loras].filter(l => !utilityLoras.has(l)).length;
    const bLoras = [...b.loras].filter(l => !utilityLoras.has(l)).length;
    const aFeatures = aLoras + a.tis.size + a.identityKeywords.size;
    const bFeatures = bLoras + b.tis.size + b.identityKeywords.size;
    return bFeatures - aFeatures;
  });

  for (const fp of sorted) {
    if (assigned.has(fp.uuid)) continue;

    const cluster = [fp];
    assigned.add(fp.uuid);

    // Find all similar images
    for (const other of sorted) {
      if (assigned.has(other.uuid)) continue;

      if (calculateSimilarity(fp, other, utilityLoras) >= SIMILARITY_THRESHOLD) {
        cluster.push(other);
        assigned.add(other.uuid);
      }
    }

    // Only keep clusters meeting minimum size
    if (cluster.length >= MIN_ALBUM_SIZE) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Merge clusters that share the same dominant LoRA
 * This fixes the issue where the same LoRA ends up in multiple albums
 * @param {Array} clusters - Array of clusters
 * @param {Set} utilityLoras - Set of utility LoRA IDs to exclude
 * @returns {Array} Merged clusters
 */
function mergeClustersWithSameLora(clusters, utilityLoras) {
  // Find dominant non-utility LoRA for each cluster
  const clusterDominantLoras = clusters.map(cluster => {
    const loraCounts = new Map();
    for (const fp of cluster) {
      for (const lora of fp.loras) {
        if (!utilityLoras.has(lora)) {
          loraCounts.set(lora, (loraCounts.get(lora) || 0) + 1);
        }
      }
    }

    // Find LoRA that appears in majority of cluster
    let dominantLora = null;
    let maxCount = 0;
    for (const [lora, count] of loraCounts) {
      if (count > maxCount && count >= cluster.length * 0.5) {
        dominantLora = lora;
        maxCount = count;
      }
    }

    return dominantLora;
  });

  // Group clusters by dominant LoRA
  const loraToClusterIndices = new Map();
  for (let i = 0; i < clusters.length; i++) {
    const dominantLora = clusterDominantLoras[i];
    if (dominantLora) {
      if (!loraToClusterIndices.has(dominantLora)) {
        loraToClusterIndices.set(dominantLora, []);
      }
      loraToClusterIndices.get(dominantLora).push(i);
    }
  }

  // Merge clusters with same dominant LoRA
  const mergedClusters = [];
  const processedIndices = new Set();

  for (const [lora, indices] of loraToClusterIndices) {
    if (indices.length > 1) {
      // Merge these clusters
      const mergedCluster = [];
      const seenUuids = new Set();

      for (const idx of indices) {
        for (const fp of clusters[idx]) {
          if (!seenUuids.has(fp.uuid)) {
            mergedCluster.push(fp);
            seenUuids.add(fp.uuid);
          }
        }
        processedIndices.add(idx);
      }

      mergedClusters.push(mergedCluster);
    }
  }

  // Add unmerged clusters
  for (let i = 0; i < clusters.length; i++) {
    if (!processedIndices.has(i)) {
      mergedClusters.push(clusters[i]);
    }
  }

  return mergedClusters;
}

/**
 * Count occurrences of features across a cluster
 * @param {Array} cluster - Array of fingerprints
 * @param {string} featureKey - Key of feature set to count ('loras', 'tis', 'identityKeywords')
 * @param {Set} excludeSet - Optional set of values to exclude
 * @returns {Map} Map of feature -> count
 */
function countFeatures(cluster, featureKey, excludeSet = new Set()) {
  const counts = new Map();

  for (const fp of cluster) {
    const features = fp[featureKey];
    if (features instanceof Set) {
      for (const feature of features) {
        if (!excludeSet.has(feature)) {
          counts.set(feature, (counts.get(feature) || 0) + 1);
        }
      }
    }
  }

  return counts;
}

/**
 * Get top N features by count
 * @param {Map} countMap - Map of feature -> count
 * @param {number} n - Number of features to return
 * @returns {Array} Array of {name, count} sorted by count desc
 */
function getTopFeatures(countMap, n = 3) {
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Hydrate LoRA names from cache
 * @param {Array} loraIds - Array of LoRA version IDs
 * @returns {Map} Map of loraId -> display name
 */
function hydrateLoraNames(loraIds) {
  const nameMap = new Map();

  if (loraIds.length === 0) return nameMap;

  try {
    const cachedLoras = LoraCache.getMultiple(loraIds);

    for (const cached of cachedLoras) {
      const metadata = cached.full_metadata;
      // Try to get name from metadata (CivitAI structure)
      const name = metadata?.model?.name || metadata?.name || formatLoraName(cached.version_id);
      nameMap.set(cached.version_id, name);
    }
  } catch (error) {
    console.error('Error hydrating LoRA names:', error);
  }

  // Fill in any missing names with formatted version
  for (const loraId of loraIds) {
    if (!nameMap.has(loraId)) {
      nameMap.set(loraId, formatLoraName(loraId));
    }
  }

  return nameMap;
}

/**
 * Generate a descriptive name for a cluster
 * @param {Array} cluster - Array of fingerprints
 * @param {Set} utilityLoras - Set of utility LoRA IDs
 * @param {Map} loraNameMap - Map of loraId -> display name
 * @returns {string} Human-readable album name
 */
function generateClusterName(cluster, utilityLoras, loraNameMap) {
  const clusterSize = cluster.length;

  // Count features (excluding utility LoRAs)
  const loraCounts = countFeatures(cluster, 'loras', utilityLoras);
  const keywordCounts = countFeatures(cluster, 'identityKeywords');

  // Get top features
  const topLoras = getTopFeatures(loraCounts, 1);
  const topKeywords = getTopFeatures(keywordCounts, 3);

  // If there's a LoRA shared by most images, use it as the name
  if (topLoras.length > 0 && topLoras[0].count >= clusterSize * 0.5) {
    const loraId = topLoras[0].name;
    return loraNameMap.get(loraId) || formatLoraName(loraId);
  }

  // Otherwise use top identity keywords
  if (topKeywords.length > 0) {
    // Filter to keywords appearing in majority of cluster
    const majorityKeywords = topKeywords
      .filter(k => k.count >= clusterSize * 0.5)
      .slice(0, 2);

    if (majorityKeywords.length > 0) {
      return majorityKeywords.map(k => k.name).join(', ');
    }
  }

  // Fallback: use model name if consistent
  const modelCounts = new Map();
  for (const fp of cluster) {
    modelCounts.set(fp.model, (modelCounts.get(fp.model) || 0) + 1);
  }
  const topModel = getTopFeatures(modelCounts, 1)[0];
  if (topModel && topModel.count >= clusterSize * 0.8) {
    return `${topModel.name} images`;
  }

  return 'Unnamed Group';
}

/**
 * Generate a unique cluster ID
 * @param {Array} cluster - Array of fingerprints
 * @param {Set} utilityLoras - Set of utility LoRA IDs
 * @returns {string} Unique cluster identifier
 */
function generateClusterId(cluster, utilityLoras) {
  // Use characteristics of cluster for ID
  const loraCounts = countFeatures(cluster, 'loras', utilityLoras);
  const keywordCounts = countFeatures(cluster, 'identityKeywords');

  const topLoras = getTopFeatures(loraCounts, 2).map(l => l.name);
  const topKeywords = getTopFeatures(keywordCounts, 2).map(k => k.name);

  const idParts = [...topLoras, ...topKeywords].slice(0, 3);

  if (idParts.length === 0) {
    // Fallback to using first image UUID
    return `cluster:${cluster[0].uuid.substring(0, 8)}`;
  }

  return `cluster:${idParts.join('+')}`;
}

/**
 * Build filter criteria for a cluster
 * Returns an array of filters that can be used to query images in this cluster
 * Strategy: Use the SINGLE most defining characteristic to avoid over-filtering
 * @param {Array} cluster - Array of fingerprints
 * @param {Set} utilityLoras - Set of utility LoRA IDs
 * @returns {Array} Array of filter objects {type, value}
 */
function buildClusterFilters(cluster, utilityLoras) {
  const filters = [];
  const clusterSize = cluster.length;

  // Get feature counts
  const loraCounts = countFeatures(cluster, 'loras', utilityLoras);
  const keywordCounts = countFeatures(cluster, 'identityKeywords');
  const modelCounts = new Map();
  for (const fp of cluster) {
    modelCounts.set(fp.model, (modelCounts.get(fp.model) || 0) + 1);
  }

  const topLoras = getTopFeatures(loraCounts, 1);
  const topKeywords = getTopFeatures(keywordCounts, 2);
  const topModel = getTopFeatures(modelCounts, 1)[0];

  // Strategy: Pick ONE primary filter type to avoid AND-combining too many conditions

  // If there's a dominant LoRA (70%+), use ONLY that
  if (topLoras.length > 0 && topLoras[0].count >= clusterSize * 0.7) {
    filters.push({ type: 'lora_id', value: topLoras[0].name });
    return filters;
  }

  // If there's a very dominant keyword (80%+), use that alone
  if (topKeywords.length > 0 && topKeywords[0].count >= clusterSize * 0.8) {
    filters.push({ type: 'keyword', value: topKeywords[0].name });
    return filters;
  }

  // If there's a somewhat dominant LoRA (50%+), combine with top keyword if it's also common
  if (topLoras.length > 0 && topLoras[0].count >= clusterSize * 0.5) {
    filters.push({ type: 'lora_id', value: topLoras[0].name });
    // Only add a keyword if it appears in most images WITH that LoRA
    if (topKeywords.length > 0 && topKeywords[0].count >= clusterSize * 0.7) {
      filters.push({ type: 'keyword', value: topKeywords[0].name });
    }
    return filters;
  }

  // No dominant LoRA - use top 1-2 keywords if they're common enough
  for (const keyword of topKeywords) {
    if (keyword.count >= clusterSize * 0.6) {
      filters.push({ type: 'keyword', value: keyword.name });
    }
  }

  // If we have keyword filters, return them
  if (filters.length > 0) {
    return filters;
  }

  // Last resort: use model if very consistent
  if (topModel && topModel.count >= clusterSize * 0.9) {
    filters.push({ type: 'model', value: topModel.name });
  }

  return filters;
}

/**
 * Get optional metadata about cluster features
 * @param {Array} cluster - Array of fingerprints
 * @param {Set} utilityLoras - Set of utility LoRA IDs
 * @param {Map} loraNameMap - Map of loraId -> display name
 * @returns {Object} Feature metadata
 */
function getClusterFeatures(cluster, utilityLoras, loraNameMap) {
  const loraCounts = countFeatures(cluster, 'loras', utilityLoras);
  const keywordCounts = countFeatures(cluster, 'identityKeywords');

  const topLoras = getTopFeatures(loraCounts, 3).map(l => ({
    id: l.name,
    name: loraNameMap.get(l.name) || formatLoraName(l.name),
    count: l.count
  }));
  const topKeywords = getTopFeatures(keywordCounts, 5).map(k => k.name);

  // Get dominant model
  const modelCounts = new Map();
  for (const fp of cluster) {
    modelCounts.set(fp.model, (modelCounts.get(fp.model) || 0) + 1);
  }
  const topModel = getTopFeatures(modelCounts, 1)[0];

  return {
    loras: topLoras,
    keywords: topKeywords,
    model: topModel?.name || 'unknown'
  };
}

/**
 * Generate album name directly from filters
 * This ensures the name matches what the user sees in filter chips
 * @param {Array} filters - Array of filter objects {type, value}
 * @param {Map} loraNameMap - Map of loraId -> display name
 * @returns {string} Human-readable album name
 */
function generateAlbumNameFromFilters(filters, loraNameMap) {
  if (!filters || filters.length === 0) {
    return 'Unnamed Group';
  }

  const nameParts = [];

  for (const filter of filters) {
    switch (filter.type) {
      case 'lora_id':
        nameParts.push(loraNameMap.get(filter.value) || formatLoraName(filter.value));
        break;
      case 'keyword':
        nameParts.push(filter.value);
        break;
      case 'model':
        nameParts.push(`${filter.value} images`);
        break;
    }
  }

  return nameParts.join(', ') || 'Unnamed Group';
}

/**
 * Generate album ID from filters
 * This creates a unique, deterministic ID based on the filter criteria
 * @param {Array} filters - Array of filter objects {type, value}
 * @returns {string} Unique album identifier
 */
function generateAlbumIdFromFilters(filters) {
  if (!filters || filters.length === 0) {
    return 'cluster:empty';
  }

  // Sort filters for consistent ID generation
  const sortedFilters = [...filters].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.value.localeCompare(b.value);
  });

  const idParts = sortedFilters.map(f => `${f.type}:${f.value}`);
  return `cluster:${idParts.join('+')}`;
}

/**
 * Generate albums from filters using multi-factor clustering
 * @param {boolean} showFavorites - Only show favorite images
 * @param {boolean} includeHidden - Include hidden images
 * @returns {Array} Array of album objects
 */
function generateAlbumsForFilters(showFavorites, includeHidden) {
  // Build base query for filtering
  let baseWhere = 'is_trashed = 0';
  if (showFavorites) {
    baseWhere += ' AND is_favorite = 1';
  }
  if (!includeHidden) {
    baseWhere += ' AND is_hidden = 0';
  }

  // Get all images for analysis
  const images = db.prepare(`
    SELECT uuid, prompt_simple, full_request, date_created
    FROM generated_images
    WHERE ${baseWhere}
  `).all();

  // Skip if not enough data
  if (images.length < MIN_ALBUM_SIZE) {
    return [];
  }

  // Extract fingerprints for all images
  const fingerprints = images.map(extractFingerprint);

  // Detect utility LoRAs
  const utilityLoras = detectUtilityLoras(fingerprints);

  // Cluster images by similarity
  let clusters = clusterImages(fingerprints, utilityLoras);

  // Merge clusters with same dominant LoRA
  clusters = mergeClustersWithSameLora(clusters, utilityLoras);

  // Collect all LoRA IDs for name hydration
  const allLoraIds = new Set();
  for (const cluster of clusters) {
    for (const fp of cluster) {
      for (const loraId of fp.loras) {
        if (!utilityLoras.has(loraId)) {
          allLoraIds.add(loraId);
        }
      }
    }
  }

  // Hydrate LoRA names from cache
  const loraNameMap = hydrateLoraNames([...allLoraIds]);

  // Build global filters for count queries
  const globalFilters = { showFavorites, includeHidden };

  // Convert clusters to albums
  const albums = clusters.map(cluster => {
    // Get most recent image for thumbnail
    const sortedByDate = [...cluster].sort((a, b) => b.dateCreated - a.dateCreated);
    const thumbnailUuid = sortedByDate[0].uuid;

    // Build filter criteria for this cluster
    const filters = buildClusterFilters(cluster, utilityLoras);

    // Recalculate count based on actual filter results
    // This ensures the displayed count matches what the user will see when clicking the album
    let actualCount = cluster.length;
    if (filters.length > 0) {
      actualCount = GeneratedImage.countByFilters(filters, globalFilters);
    }

    // Generate album name from the actual filters (not the cluster features)
    // This ensures the name matches what the user will see in the filter chips
    const albumName = generateAlbumNameFromFilters(filters, loraNameMap);

    // Generate a unique ID based on the filters
    const albumId = generateAlbumIdFromFilters(filters);

    return {
      id: albumId,
      name: albumName,
      type: 'cluster',
      count: actualCount,
      thumbnail: thumbnailUuid,
      filters: filters,
      features: getClusterFeatures(cluster, utilityLoras, loraNameMap)
    };
  });

  // Filter out albums that ended up with fewer than MIN_ALBUM_SIZE after recalculation
  const validAlbums = albums.filter(album => album.count >= MIN_ALBUM_SIZE);

  // Deduplicate albums with identical filters
  const seenFilterKeys = new Set();
  const uniqueAlbums = validAlbums.filter(album => {
    const filterKey = album.id; // ID is based on filters, so same ID = same filters
    if (seenFilterKeys.has(filterKey)) {
      return false;
    }
    seenFilterKeys.add(filterKey);
    return true;
  });

  // Sort by count (descending)
  uniqueAlbums.sort((a, b) => b.count - a.count);

  return uniqueAlbums;
}

/**
 * GET /api/albums
 * Get all albums extracted from image analysis
 */
router.get('/', (req, res) => {
  try {
    // Parse filter params for context-aware albums
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

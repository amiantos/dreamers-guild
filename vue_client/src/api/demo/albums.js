import * as db from './db.js'

/**
 * Minimum number of images required to create an album
 */
const MIN_ALBUM_SIZE = 5

/**
 * Similarity threshold for clustering (0-1)
 */
const SIMILARITY_THRESHOLD = 0.6

/**
 * Identity keyword categories - keywords that define WHO a character is
 */
const IDENTITY_KEYWORDS = {
  hair_color: [
    'blonde hair', 'black hair', 'brown hair', 'red hair', 'white hair',
    'pink hair', 'blue hair', 'green hair', 'silver hair', 'purple hair',
    'orange hair', 'grey hair', 'gray hair', 'golden hair', 'platinum blonde',
    'light brown hair', 'dark brown hair', 'multicolored hair', 'two-tone hair'
  ],
  eye_color: [
    'blue eyes', 'green eyes', 'brown eyes', 'red eyes', 'yellow eyes',
    'purple eyes', 'pink eyes', 'orange eyes', 'golden eyes', 'silver eyes',
    'grey eyes', 'gray eyes', 'black eyes', 'white eyes', 'heterochromia',
    'multicolored eyes', 'aqua eyes', 'amber eyes', 'violet eyes'
  ],
  hair_style: [
    'long hair', 'short hair', 'medium hair', 'very long hair',
    'twintails', 'twin tails', 'ponytail', 'side ponytail', 'high ponytail',
    'braid', 'braids', 'braided hair', 'twin braids', 'side braid',
    'bob cut', 'pixie cut', 'drill hair', 'hime cut', 'messy hair',
    'straight hair', 'curly hair', 'wavy hair', 'spiky hair',
    'hair bun', 'double bun', 'odango', 'ahoge', 'antenna hair',
    'bangs', 'blunt bangs', 'side bangs', 'parted bangs', 'swept bangs'
  ],
  gender_count: [
    '1girl', '2girls', '3girls', '4girls', '5girls', '6+girls', 'multiple girls',
    '1boy', '2boys', '3boys', '4boys', '5boys', '6+boys', 'multiple boys'
  ],
  species_features: [
    'elf', 'dark elf', 'demon', 'demon girl', 'demon horns', 'succubus',
    'angel', 'angel wings', 'halo',
    'cat ears', 'cat tail', 'cat girl', 'nekomimi',
    'fox ears', 'fox tail', 'kitsune',
    'wolf ears', 'wolf tail', 'wolf girl',
    'rabbit ears', 'bunny ears', 'bunny girl',
    'animal ears', 'kemonomimi',
    'horns', 'dragon horns', 'oni horns',
    'wings', 'feathered wings', 'bat wings', 'fairy wings',
    'tail', 'dragon tail',
    'pointy ears', 'vampire', 'fangs', 'mermaid'
  ]
}

// Build flattened set of all identity keywords
const ALL_IDENTITY_KEYWORDS = new Set()
for (const category of Object.values(IDENTITY_KEYWORDS)) {
  for (const keyword of category) {
    ALL_IDENTITY_KEYWORDS.add(keyword.toLowerCase())
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extract identity keywords from a prompt
 */
function extractIdentityKeywords(prompt) {
  if (!prompt) return new Set()

  // Get positive prompt only (before "###")
  let positivePrompt = prompt.split('###')[0].toLowerCase()

  // Remove parentheses content and weights
  positivePrompt = positivePrompt.replace(/\([^)]*\)/g, '')
  positivePrompt = positivePrompt.replace(/:\d+\.?\d*/g, '')

  const foundKeywords = new Set()

  for (const keyword of ALL_IDENTITY_KEYWORDS) {
    const regex = new RegExp(`(^|,\\s*)${escapeRegex(keyword)}(\\s*,|\\s*$)`, 'i')
    if (regex.test(positivePrompt)) {
      foundKeywords.add(keyword)
    }
  }

  return foundKeywords
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1, set2) {
  if (set1.size === 0 && set2.size === 0) return 0

  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])

  return intersection.size / union.size
}

/**
 * Extract fingerprint from an image
 */
function extractFingerprint(image) {
  let fullRequest = {}
  try {
    fullRequest = JSON.parse(image.full_request || '{}')
  } catch {
    // Invalid JSON
  }

  const params = fullRequest.params || {}
  const prompt = fullRequest.prompt || image.prompt_simple || ''

  return {
    uuid: image.uuid,
    loras: new Set((params.loras || []).map(l => l.name)),
    tis: new Set((params.tis || []).map(t => t.name)),
    model: fullRequest.models?.[0] || 'unknown',
    identityKeywords: extractIdentityKeywords(prompt),
    dateCreated: image.date_created
  }
}

/**
 * Calculate similarity between two fingerprints
 */
function calculateSimilarity(fp1, fp2) {
  let score = 0
  let maxScore = 0

  // LoRA overlap (weight: 3)
  if (fp1.loras.size > 0 || fp2.loras.size > 0) {
    score += jaccardSimilarity(fp1.loras, fp2.loras) * 3
    maxScore += 3
  }

  // TI overlap (weight: 2)
  if (fp1.tis.size > 0 || fp2.tis.size > 0) {
    score += jaccardSimilarity(fp1.tis, fp2.tis) * 2
    maxScore += 2
  }

  // Model match (weight: 1)
  maxScore += 1
  if (fp1.model === fp2.model) {
    score += 1
  }

  // Identity keyword overlap (weight: 3)
  if (fp1.identityKeywords.size > 0 || fp2.identityKeywords.size > 0) {
    score += jaccardSimilarity(fp1.identityKeywords, fp2.identityKeywords) * 3
    maxScore += 3
  }

  return maxScore > 0 ? score / maxScore : 0
}

/**
 * Cluster images by fingerprint similarity
 */
function clusterImages(fingerprints) {
  const clusters = []
  const assigned = new Set()

  // Sort by number of features (more features = better cluster seed)
  const sorted = [...fingerprints].sort((a, b) => {
    const aFeatures = a.loras.size + a.tis.size + a.identityKeywords.size
    const bFeatures = b.loras.size + b.tis.size + b.identityKeywords.size
    return bFeatures - aFeatures
  })

  for (const fp of sorted) {
    if (assigned.has(fp.uuid)) continue

    const cluster = [fp]
    assigned.add(fp.uuid)

    for (const other of sorted) {
      if (assigned.has(other.uuid)) continue

      if (calculateSimilarity(fp, other) >= SIMILARITY_THRESHOLD) {
        cluster.push(other)
        assigned.add(other.uuid)
      }
    }

    if (cluster.length >= MIN_ALBUM_SIZE) {
      clusters.push(cluster)
    }
  }

  return clusters
}

/**
 * Count feature occurrences across a cluster
 */
function countFeatures(cluster, featureKey, excludeSet = new Set()) {
  const counts = new Map()

  for (const fp of cluster) {
    const features = fp[featureKey]
    if (features instanceof Set) {
      for (const feature of features) {
        if (!excludeSet.has(feature)) {
          counts.set(feature, (counts.get(feature) || 0) + 1)
        }
      }
    }
  }

  return counts
}

/**
 * Build filter criteria for a cluster
 * Strategy: Use the SINGLE most defining characteristic to avoid over-filtering
 */
function buildClusterFilters(cluster) {
  const filters = []
  const clusterSize = cluster.length

  const loraCounts = countFeatures(cluster, 'loras')
  const keywordCounts = countFeatures(cluster, 'identityKeywords')
  const modelCounts = new Map()
  for (const fp of cluster) {
    modelCounts.set(fp.model, (modelCounts.get(fp.model) || 0) + 1)
  }

  const topLoras = getTopFeatures(loraCounts, 1)
  const topKeywords = getTopFeatures(keywordCounts, 2)
  const topModel = getTopFeatures(modelCounts, 1)[0]

  // Strategy: Pick ONE primary filter type to avoid AND-combining too many conditions

  // If there's a dominant LoRA (70%+), use ONLY that
  if (topLoras.length > 0 && topLoras[0].count >= clusterSize * 0.7) {
    filters.push({ type: 'lora_id', value: topLoras[0].name })
    return filters
  }

  // If there's a very dominant keyword (80%+), use that alone
  if (topKeywords.length > 0 && topKeywords[0].count >= clusterSize * 0.8) {
    filters.push({ type: 'keyword', value: topKeywords[0].name })
    return filters
  }

  // If there's a somewhat dominant LoRA (50%+), combine with top keyword if it's also common
  if (topLoras.length > 0 && topLoras[0].count >= clusterSize * 0.5) {
    filters.push({ type: 'lora_id', value: topLoras[0].name })
    if (topKeywords.length > 0 && topKeywords[0].count >= clusterSize * 0.7) {
      filters.push({ type: 'keyword', value: topKeywords[0].name })
    }
    return filters
  }

  // No dominant LoRA - use top 1-2 keywords if they're common enough
  for (const keyword of topKeywords) {
    if (keyword.count >= clusterSize * 0.6) {
      filters.push({ type: 'keyword', value: keyword.name })
    }
  }

  if (filters.length > 0) {
    return filters
  }

  // Last resort: use model if very consistent
  if (topModel && topModel.count >= clusterSize * 0.9) {
    filters.push({ type: 'model', value: topModel.name })
  }

  return filters
}

/**
 * Get top N features by count
 */
function getTopFeatures(countMap, n = 3) {
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))
}

/**
 * Format a LoRA name for display
 */
function formatLoraName(loraName) {
  if (!loraName) return 'Unknown LoRA'

  if (/^\d+$/.test(loraName)) {
    return `LoRA #${loraName}`
  }

  return loraName
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Generate a descriptive name for a cluster
 */
function generateClusterName(cluster) {
  const clusterSize = cluster.length

  const loraCounts = countFeatures(cluster, 'loras')
  const keywordCounts = countFeatures(cluster, 'identityKeywords')

  const topLoras = getTopFeatures(loraCounts, 1)
  const topKeywords = getTopFeatures(keywordCounts, 3)

  // If there's a LoRA shared by most images, use it
  if (topLoras.length > 0 && topLoras[0].count >= clusterSize * 0.8) {
    return formatLoraName(topLoras[0].name)
  }

  // Otherwise use top identity keywords
  if (topKeywords.length > 0) {
    const majorityKeywords = topKeywords
      .filter(k => k.count >= clusterSize * 0.5)
      .slice(0, 2)

    if (majorityKeywords.length > 0) {
      return majorityKeywords.map(k => k.name).join(', ')
    }
  }

  // Fallback: use model name
  const modelCounts = new Map()
  for (const fp of cluster) {
    modelCounts.set(fp.model, (modelCounts.get(fp.model) || 0) + 1)
  }
  const topModel = getTopFeatures(modelCounts, 1)[0]
  if (topModel && topModel.count >= clusterSize * 0.8) {
    return `${topModel.name} images`
  }

  return 'Unnamed Group'
}

/**
 * Generate a unique cluster ID
 */
function generateClusterId(cluster) {
  const loraCounts = countFeatures(cluster, 'loras')
  const keywordCounts = countFeatures(cluster, 'identityKeywords')

  const topLoras = getTopFeatures(loraCounts, 2).map(l => l.name)
  const topKeywords = getTopFeatures(keywordCounts, 2).map(k => k.name)

  const idParts = [...topLoras, ...topKeywords].slice(0, 3)

  if (idParts.length === 0) {
    return `cluster:${cluster[0].uuid.substring(0, 8)}`
  }

  return `cluster:${idParts.join('+')}`
}

/**
 * Get cluster features metadata
 */
function getClusterFeatures(cluster) {
  const loraCounts = countFeatures(cluster, 'loras')
  const keywordCounts = countFeatures(cluster, 'identityKeywords')

  const topLoras = getTopFeatures(loraCounts, 3).map(l => l.name)
  const topKeywords = getTopFeatures(keywordCounts, 5).map(k => k.name)

  const modelCounts = new Map()
  for (const fp of cluster) {
    modelCounts.set(fp.model, (modelCounts.get(fp.model) || 0) + 1)
  }
  const topModel = getTopFeatures(modelCounts, 1)[0]

  return {
    loras: topLoras,
    keywords: topKeywords,
    model: topModel?.name || 'unknown'
  }
}

/**
 * Generate album name from filters
 */
function generateAlbumNameFromFilters(filters) {
  if (!filters || filters.length === 0) {
    return 'Unnamed Group'
  }

  const nameParts = []

  for (const filter of filters) {
    switch (filter.type) {
      case 'lora_id':
        nameParts.push(formatLoraName(filter.value))
        break
      case 'keyword':
        nameParts.push(filter.value)
        break
      case 'model':
        nameParts.push(`${filter.value} images`)
        break
    }
  }

  return nameParts.join(', ') || 'Unnamed Group'
}

/**
 * Generate album ID from filters
 */
function generateAlbumIdFromFilters(filters) {
  if (!filters || filters.length === 0) {
    return 'cluster:empty'
  }

  const sortedFilters = [...filters].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type)
    return a.value.localeCompare(b.value)
  })

  const idParts = sortedFilters.map(f => `${f.type}:${f.value}`)
  return `cluster:${idParts.join('+')}`
}

export const albumsApi = {
  async getAll(filters = {}) {
    const allImages = await db.getAll('images')

    // Filter images based on user filters
    const filteredImages = allImages.filter(img => {
      if (filters.showFavoritesOnly && !img.is_favorite) return false
      if (!filters.showHidden && img.is_hidden) return false
      return true
    })

    // Skip if not enough images
    if (filteredImages.length < MIN_ALBUM_SIZE) {
      return { data: [] }
    }

    // Extract fingerprints
    const fingerprints = filteredImages.map(extractFingerprint)

    // Cluster images by similarity
    const clusters = clusterImages(fingerprints)

    // Convert clusters to albums
    const albumsRaw = clusters.map(cluster => {
      // Get most recent image for thumbnail
      const sortedByDate = [...cluster].sort((a, b) => b.dateCreated - a.dateCreated)
      const thumbnailUuid = sortedByDate[0].uuid

      // Build filter criteria for this cluster
      const clusterFilters = buildClusterFilters(cluster)

      // Generate ID and name from filters (not cluster features)
      const albumId = generateAlbumIdFromFilters(clusterFilters)
      const albumName = generateAlbumNameFromFilters(clusterFilters)

      return {
        id: albumId,
        name: albumName,
        type: 'cluster',
        count: cluster.length,
        thumbnail: thumbnailUuid,
        filters: clusterFilters,
        features: getClusterFeatures(cluster)
      }
    })

    // Deduplicate albums with same filters
    const seenIds = new Set()
    const albums = []
    for (const album of albumsRaw) {
      if (!seenIds.has(album.id)) {
        seenIds.add(album.id)
        albums.push(album)
      }
    }

    // Sort by count (descending)
    albums.sort((a, b) => b.count - a.count)

    return { data: albums }
  }
}

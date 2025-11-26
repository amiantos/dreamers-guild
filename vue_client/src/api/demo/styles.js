import { getHordeStyles } from './horde.js'

const STYLES_CACHE_KEY = 'demoStyles'
const STYLES_CACHE_VERSION = 2 // Increment to invalidate old caches
const CACHE_TTL = 60 * 60 * 1000 // 1 hour
const PREVIEWS_URL = 'https://raw.githubusercontent.com/amiantos/AI-Horde-Styles-Previews/refs/heads/main/previews.json'

function getCachedStyles() {
  const cached = localStorage.getItem(STYLES_CACHE_KEY)
  if (cached) {
    try {
      const { data, timestamp, version } = JSON.parse(cached)
      // Invalidate cache if version doesn't match or is missing
      if (version !== STYLES_CACHE_VERSION) {
        console.log('[Demo] Styles cache version mismatch, invalidating')
        localStorage.removeItem(STYLES_CACHE_KEY)
        return null
      }
      if (Date.now() - timestamp < CACHE_TTL) {
        return data
      }
    } catch (e) {
      localStorage.removeItem(STYLES_CACHE_KEY)
      return null
    }
  }
  return null
}

function cacheStyles(styles) {
  localStorage.setItem(STYLES_CACHE_KEY, JSON.stringify({
    data: styles,
    timestamp: Date.now(),
    version: STYLES_CACHE_VERSION
  }))
}

async function fetchPreviews() {
  try {
    const response = await fetch(PREVIEWS_URL)
    if (!response.ok) {
      console.warn('[Demo] Failed to fetch style previews')
      return {}
    }
    return await response.json()
  } catch (error) {
    console.warn('[Demo] Error fetching style previews:', error)
    return {}
  }
}

async function fetchAndProcessStyles() {
  console.log('[Demo] Fetching styles and previews...')

  // Fetch both styles and previews in parallel
  const [rawStyles, previews] = await Promise.all([
    getHordeStyles(),
    fetchPreviews()
  ])

  const previewCount = Object.keys(previews).length
  const styleCount = Object.keys(rawStyles).length
  console.log(`[Demo] Fetched ${styleCount} styles and ${previewCount} previews`)

  const styles = Object.entries(rawStyles).map(([name, style]) => ({
    name,
    prompt: style.prompt || '',
    negative_prompt: style.negative_prompt || '',
    model: style.model || null,
    sampler_name: style.sampler_name || null,
    width: style.width || null,
    height: style.height || null,
    steps: style.steps || null,
    cfg_scale: style.cfg_scale || null,
    loras: style.loras || [],
    category: categorizeStyle(name),
    preview: previews[name] || null
  }))

  // Count styles with previews
  const stylesWithPreviews = styles.filter(s => s.preview !== null).length
  console.log(`[Demo] ${stylesWithPreviews}/${styles.length} styles have previews`)

  // Sort alphabetically
  styles.sort((a, b) => a.name.localeCompare(b.name))

  return styles
}

function categorizeStyle(name) {
  const lowerName = name.toLowerCase()
  if (lowerName.includes('anime') || lowerName.includes('manga')) return 'Anime'
  if (lowerName.includes('photo') || lowerName.includes('realistic')) return 'Photorealistic'
  if (lowerName.includes('art') || lowerName.includes('painting')) return 'Artistic'
  if (lowerName.includes('3d') || lowerName.includes('render')) return '3D'
  if (lowerName.includes('pixel')) return 'Pixel Art'
  return 'Other'
}

export const stylesApi = {
  async getAll() {
    let styles = getCachedStyles()

    if (!styles) {
      try {
        styles = await fetchAndProcessStyles()
        cacheStyles(styles)
      } catch (error) {
        console.error('Failed to fetch styles:', error)
        styles = []
      }
    }

    // Match server format: { data: { allStyles: [...] } }
    return { data: { allStyles: styles } }
  },

  async refresh() {
    localStorage.removeItem(STYLES_CACHE_KEY)
    const styles = await fetchAndProcessStyles()
    cacheStyles(styles)
    return { data: { allStyles: styles } }
  }
}

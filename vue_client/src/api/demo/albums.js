import * as db from './db.js'

function extractKeywords(prompt) {
  if (!prompt) return []

  const cleaned = prompt
    .toLowerCase()
    .replace(/[,()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ').filter(word =>
    word.length > 2 &&
    !isStopWord(word) &&
    !isNumberWeight(word)
  )

  return [...new Set(words)]
}

function isStopWord(word) {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was',
    'has', 'have', 'had', 'been', 'will', 'would', 'could', 'should',
    'into', 'onto', 'upon', 'very', 'just', 'only', 'also', 'more',
    'most', 'some', 'such', 'than', 'then', 'when', 'where', 'which',
    'while', 'about', 'after', 'before', 'between', 'under', 'over',
    'through', 'during', 'without', 'within', 'along', 'among'
  ])
  return stopWords.has(word)
}

function isNumberWeight(word) {
  return /^\d+(\.\d+)?$/.test(word) || /^[\d.]+:[\d.]+$/.test(word)
}

export const albumsApi = {
  async getAll(filters = {}) {
    const allImages = await db.getAll('images')

    const filteredImages = allImages.filter(img => {
      if (filters.showFavoritesOnly && !img.is_favorite) return false
      if (!filters.showHidden && img.is_hidden) return false
      return true
    })

    const keywordCounts = new Map()
    const keywordThumbnails = new Map()

    for (const image of filteredImages) {
      const keywords = extractKeywords(image.prompt_simple)
      for (const keyword of keywords) {
        const count = (keywordCounts.get(keyword) || 0) + 1
        keywordCounts.set(keyword, count)

        if (!keywordThumbnails.has(keyword)) {
          keywordThumbnails.set(keyword, image.uuid)
        }
      }
    }

    const albums = Array.from(keywordCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name, count], index) => ({
        id: index,
        name,
        count,
        thumbnail: keywordThumbnails.get(name) || null,
        type: 'keyword'
      }))

    return { data: albums }
  }
}

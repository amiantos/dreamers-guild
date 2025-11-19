import express from 'express';
import db from '../db/database.js';

const router = express.Router();

/**
 * Extract and count keywords from prompts
 */
function extractKeywords(prompts, limit = 20) {
  const keywordCounts = new Map();

  prompts.forEach(prompt => {
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

    keywords.forEach(keyword => {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    });
  });

  // Sort by count and return top keywords
  return Array.from(keywordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}

/**
 * GET /api/albums
 * Get all keyword albums extracted from image prompts
 */
router.get('/', (req, res) => {
  try {
    const albums = [];

    // Parse filter params for context-aware keyword albums
    const showFavorites = req.query.favorites === 'true';
    const includeHidden = req.query.includeHidden === 'true';

    // Build base query for filtering
    let baseWhere = 'is_trashed = 0';
    if (showFavorites) {
      baseWhere += ' AND is_favorite = 1';
    }
    if (!includeHidden) {
      baseWhere += ' AND is_hidden = 0';
    }

    // Keyword albums - extract from prompts with context-aware filtering
    const prompts = db.prepare(`
      SELECT prompt_simple FROM generated_images
      WHERE ${baseWhere}
    `).all().map(row => row.prompt_simple);

    const topKeywords = extractKeywords(prompts, 50);

    topKeywords.forEach(({ keyword, count }) => {
      // Get most recent image for this keyword
      const thumbnail = db.prepare(`
        SELECT uuid FROM generated_images
        WHERE ${baseWhere} AND prompt_simple LIKE ?
        ORDER BY date_created DESC
        LIMIT 1
      `).get(`%${keyword}%`);

      albums.push({
        id: `keyword:${keyword}`,
        name: keyword,
        type: 'keyword',
        count: count,
        thumbnail: thumbnail ? thumbnail.uuid : null
      });
    });

    res.json(albums);
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

export default router;

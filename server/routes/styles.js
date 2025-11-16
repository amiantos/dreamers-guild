import express from 'express';
import axios from 'axios';

const router = express.Router();

// Cache for styles data
let stylesCache = null;
let stylesCacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Base URL for AI Horde Styles GitHub repo
const STYLES_BASE_URL = 'https://raw.githubusercontent.com/Haidra-Org/AI-Horde-Styles/main';

/**
 * Fetch and cache styles from GitHub
 */
async function fetchStyles() {
  const now = Date.now();

  // Return cached data if still valid
  if (stylesCache && (now - stylesCacheTime) < CACHE_DURATION) {
    console.log('[Styles] Returning cached styles');
    return stylesCache;
  }

  try {
    console.log('[Styles] Fetching styles from GitHub...');

    // Fetch the categories mapping
    const categoriesResponse = await axios.get(`${STYLES_BASE_URL}/categories.json`);
    const categories = categoriesResponse.data;

    // Fetch all style files
    const styleFiles = [];
    const stylesByCategory = {};

    // Create "None" default style
    const noneStyle = {
      name: 'None',
      prompt: '',
      model: null,
      params: {}
    };

    stylesByCategory['Default'] = [noneStyle];

    // Fetch each style file
    for (const [styleName, categoryName] of Object.entries(categories)) {
      try {
        const styleResponse = await axios.get(`${STYLES_BASE_URL}/styles/${styleName}.json`);
        const styleData = {
          name: styleName,
          ...styleResponse.data
        };

        styleFiles.push(styleData);

        if (!stylesByCategory[categoryName]) {
          stylesByCategory[categoryName] = [];
        }
        stylesByCategory[categoryName].push(styleData);
      } catch (error) {
        console.error(`[Styles] Error fetching style ${styleName}:`, error.message);
      }
    }

    // Sort styles within each category by name
    for (const category in stylesByCategory) {
      stylesByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    }

    stylesCache = {
      categories: Object.keys(stylesByCategory).sort(),
      stylesByCategory,
      allStyles: styleFiles
    };
    stylesCacheTime = now;

    console.log(`[Styles] Cached ${styleFiles.length} styles in ${Object.keys(stylesByCategory).length} categories`);

    return stylesCache;
  } catch (error) {
    console.error('[Styles] Error fetching styles:', error.message);
    throw error;
  }
}

// Get all styles
router.get('/', async (req, res) => {
  try {
    const styles = await fetchStyles();
    res.json(styles);
  } catch (error) {
    console.error('Error fetching styles:', error);
    res.status(500).json({ error: 'Failed to fetch styles' });
  }
});

// Get styles by category
router.get('/category/:category', async (req, res) => {
  try {
    const styles = await fetchStyles();
    const category = req.params.category;

    if (!styles.stylesByCategory[category]) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(styles.stylesByCategory[category]);
  } catch (error) {
    console.error('Error fetching styles by category:', error);
    res.status(500).json({ error: 'Failed to fetch styles' });
  }
});

// Force refresh styles cache
router.post('/refresh', async (req, res) => {
  try {
    stylesCache = null;
    const styles = await fetchStyles();
    res.json({ success: true, message: 'Styles cache refreshed', count: styles.allStyles.length });
  } catch (error) {
    console.error('Error refreshing styles cache:', error);
    res.status(500).json({ error: 'Failed to refresh styles cache' });
  }
});

export default router;

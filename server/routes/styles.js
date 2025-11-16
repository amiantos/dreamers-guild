import express from 'express';
import axios from 'axios';

const router = express.Router();

// Cache for styles data
let stylesCache = null;
let stylesCacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// URL for AI Horde Styles JSON file
const STYLES_URL = 'https://raw.githubusercontent.com/Haidra-Org/AI-Horde-Styles/refs/heads/main/styles.json';

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

    // Fetch the styles.json file
    const response = await axios.get(STYLES_URL);
    const stylesData = response.data;

    // Convert object to array with names
    const allStyles = Object.entries(stylesData).map(([name, data]) => ({
      name,
      ...data
    }));

    // Sort alphabetically
    allStyles.sort((a, b) => a.name.localeCompare(b.name));

    stylesCache = {
      allStyles,
      stylesMap: stylesData
    };
    stylesCacheTime = now;

    console.log(`[Styles] Cached ${allStyles.length} styles`);

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

// Get a specific style by name
router.get('/:name', async (req, res) => {
  try {
    const styles = await fetchStyles();
    const styleName = req.params.name;

    if (!styles.stylesMap[styleName]) {
      return res.status(404).json({ error: 'Style not found' });
    }

    res.json({ name: styleName, ...styles.stylesMap[styleName] });
  } catch (error) {
    console.error('Error fetching style:', error);
    res.status(500).json({ error: 'Failed to fetch style' });
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

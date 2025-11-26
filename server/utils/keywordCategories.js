/**
 * Identity keyword categories for character fingerprinting
 * These keywords define WHO a character is (persistent across outfits)
 */
export const IDENTITY_KEYWORDS = {
  hair_color: [
    'blonde hair', 'black hair', 'brown hair', 'red hair', 'white hair',
    'pink hair', 'blue hair', 'green hair', 'silver hair', 'purple hair',
    'orange hair', 'grey hair', 'gray hair', 'golden hair', 'platinum blonde',
    'light brown hair', 'dark brown hair', 'multicolored hair', 'two-tone hair',
    'gradient hair', 'streaked hair'
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
    'bangs', 'blunt bangs', 'side bangs', 'parted bangs', 'swept bangs',
    'hair over one eye', 'hair between eyes', 'sidelocks'
  ],
  gender_count: [
    '1girl', '2girls', '3girls', '4girls', '5girls', '6+girls', 'multiple girls',
    '1boy', '2boys', '3boys', '4boys', '5boys', '6+boys', 'multiple boys',
    '1other', 'androgynous', 'male', 'female'
  ],
  species_features: [
    'elf', 'dark elf', 'high elf',
    'demon', 'demon girl', 'demon horns', 'demon tail', 'succubus',
    'angel', 'angel wings', 'halo',
    'cat ears', 'cat tail', 'cat girl', 'nekomimi',
    'fox ears', 'fox tail', 'kitsune',
    'wolf ears', 'wolf tail', 'wolf girl',
    'dog ears', 'dog tail', 'dog girl',
    'rabbit ears', 'bunny ears', 'bunny girl', 'rabbit tail',
    'animal ears', 'kemonomimi', 'furry',
    'horns', 'dragon horns', 'oni horns',
    'wings', 'feathered wings', 'bat wings', 'fairy wings',
    'tail', 'dragon tail',
    'pointy ears', 'long ears',
    'vampire', 'fangs',
    'mermaid', 'fish tail',
    'centaur', 'lamia', 'harpy', 'slime girl'
  ],
  body_type: [
    'petite', 'slim', 'slender', 'athletic', 'muscular', 'curvy', 'plump',
    'tall', 'short', 'loli', 'milf', 'mature', 'young', 'teen', 'adult',
    'large breasts', 'medium breasts', 'small breasts', 'flat chest',
    'huge breasts', 'gigantic breasts'
  ],
  skin: [
    'pale skin', 'fair skin', 'white skin', 'tan', 'tanned', 'dark skin',
    'dark-skinned', 'brown skin', 'light skin'
  ],
  distinguishing_features: [
    'freckles', 'mole', 'beauty mark', 'scar', 'scars', 'tattoo', 'tattoos',
    'glasses', 'sunglasses', 'eyepatch', 'heterochromia',
    'elf ears', 'pointy ears', 'long ears'
  ]
};

/**
 * Boilerplate/quality keywords to exclude from all analysis
 */
export const BOILERPLATE_KEYWORDS = new Set([
  // Quality tags
  'masterpiece', 'best quality', 'amazing quality', 'very aesthetic',
  'high resolution', 'ultra-detailed', 'absurdres', 'intricate',
  'detailed', 'highly detailed', 'extremely detailed', 'insane details',
  'hyper detailed', 'ultra detailed', 'very detailed', 'intricate details',
  'hyperdetailed', 'maximum details', 'meticulous', 'magnificent',
  'highres', 'hires', '4k', '8k', 'uhd',
  // Score tags
  'score_9', 'score_8_up', 'score_7_up', 'score_6_up', 'score_5_up',
  'score_4_up', 'score_3_up', 'score_2_up', 'score_1_up',
  // Generic style
  'looking at viewer', 'solo', 'depth of field', 'volumetric lighting',
  'scenery', 'newest', 'sharp focus', 'elegant', 'cinematic look',
  'soothing tones', 'soft cinematic light', 'low contrast', 'dim colors',
  'exposure blend', 'hdr', 'faded', 'bokeh', 'blurry background',
  'simple background', 'white background', 'black background',
  'gradient background', 'grey background', 'gray background',
  // Technical
  'source_anime', 'source_cartoon', 'source_pony', 'source_furry',
  'rating_safe', 'rating_questionable', 'rating_explicit'
]);

/**
 * Build a flattened set of all identity keywords for fast lookup
 */
const ALL_IDENTITY_KEYWORDS = new Set();
for (const category of Object.values(IDENTITY_KEYWORDS)) {
  for (const keyword of category) {
    ALL_IDENTITY_KEYWORDS.add(keyword.toLowerCase());
  }
}

/**
 * Extract identity keywords from a prompt
 * @param {string} prompt - The full prompt text
 * @returns {Set<string>} Set of identity keywords found
 */
export function extractIdentityKeywords(prompt) {
  if (!prompt) return new Set();

  // Get positive prompt only (before "###")
  let positivePrompt = prompt.split('###')[0].toLowerCase();

  // Remove parentheses content and weights
  positivePrompt = positivePrompt.replace(/\([^)]*\)/g, '');
  positivePrompt = positivePrompt.replace(/:\d+\.?\d*/g, '');

  const foundKeywords = new Set();

  // Check each identity keyword
  for (const keyword of ALL_IDENTITY_KEYWORDS) {
    // Use word boundary matching to avoid partial matches
    // e.g., "red hair" shouldn't match "red hairband"
    const regex = new RegExp(`(^|,\\s*)${escapeRegex(keyword)}(\\s*,|\\s*$)`, 'i');
    if (regex.test(positivePrompt)) {
      foundKeywords.add(keyword);
    }
  }

  return foundKeywords;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate Jaccard similarity between two sets
 * @param {Set} set1
 * @param {Set} set2
 * @returns {number} Similarity score between 0 and 1
 */
export function jaccardSimilarity(set1, set2) {
  if (set1.size === 0 && set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Format a LoRA name for display
 * Converts version IDs or technical names to readable format
 * @param {string} loraName - The LoRA name/ID
 * @returns {string} Formatted display name
 */
export function formatLoraName(loraName) {
  if (!loraName) return 'Unknown LoRA';

  // If it's a numeric ID, just return it with a prefix
  if (/^\d+$/.test(loraName)) {
    return `LoRA #${loraName}`;
  }

  // Replace underscores/hyphens with spaces and title case
  return loraName
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

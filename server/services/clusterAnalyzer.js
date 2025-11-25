/**
 * Cluster Analyzer - Association Rule Mining for Auto-Folder Discovery
 *
 * Discovers keyword combinations that frequently appear together in prompts
 * using the Apriori algorithm and association rule mining.
 */

// Boilerplate keywords to exclude from analysis
export const BOILERPLATE_KEYWORDS = new Set([
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

class ClusterAnalyzer {
  constructor(minSupport = 0.03, minConfidence = 0.6, minLift = 2.0) {
    this.minSupport = minSupport;
    this.minConfidence = minConfidence;
    this.minLift = minLift;
    this.transactions = [];
    this.totalTransactions = 0;
  }

  /**
   * Clean and extract keywords from a prompt
   */
  cleanKeywords(prompt) {
    if (!prompt) return [];

    // Get positive prompts (before "###")
    let positivePrompt = prompt.split('###')[0];

    // Remove parentheses and their content
    positivePrompt = positivePrompt.replace(/\([^)]*\)/g, '');

    // Remove weight numbers like :1.2
    positivePrompt = positivePrompt.replace(/:\d+\.?\d*/g, '');

    // Split by commas and process
    const keywords = positivePrompt.split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0)
      .filter(k => !k.startsWith('score_'))
      .filter(k => !BOILERPLATE_KEYWORDS.has(k));

    return keywords;
  }

  /**
   * Load transactions from prompt data
   */
  loadTransactions(promptData) {
    this.transactions = promptData
      .map(({ prompt }) => {
        const keywords = this.cleanKeywords(prompt);
        return new Set(keywords);
      })
      .filter(set => set.size > 0);

    this.totalTransactions = this.transactions.length;
    return this.transactions;
  }

  /**
   * Calculate support (frequency) of an itemset
   */
  calculateSupport(itemset) {
    let count = 0;
    for (const transaction of this.transactions) {
      if (itemset.every(item => transaction.has(item))) {
        count++;
      }
    }
    return count / this.totalTransactions;
  }

  /**
   * Get frequent single keywords (1-itemsets)
   */
  getFrequentSingletons() {
    const keywordCounts = new Map();

    for (const transaction of this.transactions) {
      for (const keyword of transaction) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }

    const minCount = this.minSupport * this.totalTransactions;
    const frequent = [];

    for (const [keyword, count] of keywordCounts) {
      if (count >= minCount) {
        frequent.push({
          itemset: [keyword],
          support: count / this.totalTransactions,
          count: count
        });
      }
    }

    return frequent;
  }

  /**
   * Generate candidate k-itemsets from frequent (k-1)-itemsets
   */
  generateCandidates(frequentSets, k) {
    const candidates = [];
    const n = frequentSets.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const set1 = frequentSets[i].itemset;
        const set2 = frequentSets[j].itemset;

        // Check if first k-2 items are the same
        let samePrefix = true;
        for (let idx = 0; idx < k - 2; idx++) {
          if (set1[idx] !== set2[idx]) {
            samePrefix = false;
            break;
          }
        }

        if (samePrefix && set1[k - 2] < set2[k - 2]) {
          // Create new candidate by merging
          const candidate = [...set1, set2[k - 2]].sort();
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  /**
   * Find all frequent itemsets using Apriori algorithm
   */
  findFrequentItemsets(maxSize = 5) {
    const allFrequentSets = [];

    // Start with frequent singletons
    let currentFrequent = this.getFrequentSingletons();
    allFrequentSets.push(...currentFrequent);

    // Build larger itemsets iteratively
    for (let k = 2; k <= maxSize; k++) {
      const candidates = this.generateCandidates(currentFrequent, k);
      if (candidates.length === 0) break;

      const frequentK = [];
      const minCount = this.minSupport * this.totalTransactions;

      for (const candidate of candidates) {
        let count = 0;
        for (const transaction of this.transactions) {
          if (candidate.every(item => transaction.has(item))) {
            count++;
          }
        }

        if (count >= minCount) {
          frequentK.push({
            itemset: candidate,
            support: count / this.totalTransactions,
            count: count
          });
        }
      }

      if (frequentK.length === 0) break;

      allFrequentSets.push(...frequentK);
      currentFrequent = frequentK;
    }

    return allFrequentSets;
  }

  /**
   * Generate association rules from frequent itemsets
   */
  generateRules(frequentSets) {
    const rules = [];

    // Only consider itemsets with 2+ items
    const multiItemSets = frequentSets.filter(set => set.itemset.length >= 2);

    for (const itemsetData of multiItemSets) {
      const itemset = itemsetData.itemset;
      const itemsetSupport = itemsetData.support;

      // For each possible split of the itemset
      const subsets = this.generateSubsets(itemset);

      for (const antecedent of subsets) {
        if (antecedent.length === 0 || antecedent.length === itemset.length) {
          continue;
        }

        const consequent = itemset.filter(item => !antecedent.includes(item));

        // Calculate antecedent support
        const antecedentSupport = this.calculateSupport(antecedent);

        // Calculate confidence: P(consequent | antecedent)
        const confidence = itemsetSupport / antecedentSupport;

        // Calculate consequent support for lift
        const consequentSupport = this.calculateSupport(consequent);

        // Calculate lift: P(antecedent ∩ consequent) / (P(antecedent) * P(consequent))
        const lift = itemsetSupport / (antecedentSupport * consequentSupport);

        if (confidence >= this.minConfidence && lift >= this.minLift) {
          rules.push({
            antecedent,
            consequent,
            itemset,
            support: itemsetSupport,
            confidence,
            lift,
            count: itemsetData.count
          });
        }
      }
    }

    return rules;
  }

  /**
   * Generate all non-empty subsets of an array
   */
  generateSubsets(arr) {
    const subsets = [];
    const n = arr.length;
    const totalSubsets = Math.pow(2, n);

    for (let i = 1; i < totalSubsets - 1; i++) {
      const subset = [];
      for (let j = 0; j < n; j++) {
        if (i & (1 << j)) {
          subset.push(arr[j]);
        }
      }
      subsets.push(subset);
    }

    return subsets;
  }

  /**
   * Score a cluster for ranking
   */
  scoreCluster(rule) {
    const { support, confidence, lift } = rule;

    // Balanced scoring:
    // - Lift is most important (distinctiveness)
    // - Support matters but with diminishing returns (logarithmic)
    // - Confidence ensures reliability
    const score =
      lift * 2.0 +
      Math.log(support * 100 + 1) * 0.5 +
      confidence * 1.0;

    return score;
  }

  /**
   * Generate a readable name for a cluster
   */
  generateClusterName(keywords) {
    return keywords.slice(0, 4).join(', ');
  }

  /**
   * Get indices of transactions matching all keywords
   */
  getMatchingTransactionIndices(keywords) {
    const matchingIndices = [];
    for (let i = 0; i < this.transactions.length; i++) {
      if (keywords.every(kw => this.transactions[i].has(kw))) {
        matchingIndices.push(i);
      }
    }
    return new Set(matchingIndices);
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  jaccardSimilarity(set1, set2) {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  /**
   * Create auto-folders from association rules with overlap detection
   */
  createAutoFolders(rules, limit = 20) {
    const clusters = [];
    const clusterTransactionSets = []; // Track which transactions each cluster covers

    // Deduplicate rules by itemset first (multiple rules can have same itemset)
    const itemsetMap = new Map();
    for (const rule of rules) {
      const itemsetKey = rule.itemset.join('|');
      const existingRule = itemsetMap.get(itemsetKey);

      // Keep the rule with the highest score for this itemset
      if (!existingRule || this.scoreCluster(rule) > this.scoreCluster(existingRule)) {
        itemsetMap.set(itemsetKey, rule);
      }
    }

    // Score and sort unique rules
    const scoredRules = Array.from(itemsetMap.values())
      .map(rule => ({
        ...rule,
        score: this.scoreCluster(rule)
      }))
      .sort((a, b) => b.score - a.score);

    for (const rule of scoredRules) {
      const keywords = rule.itemset;

      // Skip if too many keywords (too specific)
      if (keywords.length > 5) continue;

      // Skip if not enough images
      if (rule.count < 5) continue;

      // Get transactions (images) matching this cluster
      const matchingTransactions = this.getMatchingTransactionIndices(keywords);

      // Check overlap with existing clusters
      let hasSignificantOverlap = false;
      let mergeWithClusterIndex = -1;

      for (let i = 0; i < clusters.length; i++) {
        const existingTransactions = clusterTransactionSets[i];

        // Calculate both Jaccard and subset/superset ratios
        const intersection = new Set([...matchingTransactions].filter(x => existingTransactions.has(x)));
        const jaccard = intersection.size / new Set([...matchingTransactions, ...existingTransactions]).size;

        // Check if one is a subset of the other
        const newIsSubsetOfExisting = intersection.size / matchingTransactions.size;
        const existingIsSubsetOfNew = intersection.size / existingTransactions.size;

        // Significant overlap if: Jaccard > 0.85 OR one is >90% subset of the other
        // More relaxed to allow related but distinct clusters
        const significantOverlap = jaccard > 0.85 ||
                                   newIsSubsetOfExisting > 0.9 ||
                                   existingIsSubsetOfNew > 0.9;

        if (significantOverlap) {
          hasSignificantOverlap = true;

          // Prefer the cluster with MORE images (more general and useful)
          // or if same size, prefer fewer keywords (more general theme)
          if (rule.count > clusters[i].count + 5) {
            // New cluster is significantly larger, replace existing
            mergeWithClusterIndex = i;
          } else if (Math.abs(rule.count - clusters[i].count) <= 5) {
            // Similar size, prefer fewer keywords (more general)
            if (keywords.length < clusters[i].keywords.length) {
              mergeWithClusterIndex = i;
            }
          }
          break;
        }
      }

      if (hasSignificantOverlap && mergeWithClusterIndex === -1) {
        // Skip this cluster, it's too similar to an existing one
        continue;
      }

      const newCluster = {
        id: `cluster:${keywords.join('-').replace(/\s+/g, '_')}`,
        name: this.generateClusterName(keywords),
        type: 'auto-folder',
        keywords: keywords,
        count: rule.count,
        support: rule.support,
        confidence: rule.confidence,
        lift: rule.lift,
        score: rule.score
      };

      if (mergeWithClusterIndex >= 0) {
        // Replace the less specific cluster with the more specific one
        clusters[mergeWithClusterIndex] = newCluster;
        clusterTransactionSets[mergeWithClusterIndex] = matchingTransactions;
      } else {
        // Add new cluster
        clusters.push(newCluster);
        clusterTransactionSets.push(matchingTransactions);
      }

      if (clusters.length >= limit) break;
    }

    return clusters;
  }

  /**
   * Main analysis function
   */
  analyze(promptData, options = {}) {
    const {
      minSupport = this.minSupport,
      minConfidence = this.minConfidence,
      minLift = this.minLift,
      maxSize = 5,
      limit = 20
    } = options;

    // Update parameters
    this.minSupport = minSupport;
    this.minConfidence = minConfidence;
    this.minLift = minLift;

    // Load transactions
    this.loadTransactions(promptData);

    if (this.totalTransactions === 0) {
      return [];
    }

    // Find frequent itemsets
    const frequentSets = this.findFrequentItemsets(maxSize);

    // Generate association rules
    const rules = this.generateRules(frequentSets);

    // Create auto-folders
    const folders = this.createAutoFolders(rules, limit);

    return folders;
  }
}

export default ClusterAnalyzer;

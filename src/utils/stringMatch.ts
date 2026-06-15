/**
 * String similarity utilities for fuzzy matching
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of edits (insertions, deletions, substitutions) needed
 */
export function levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create 2D array
    const dp: number[][] = Array(len1 + 1)
        .fill(null)
        .map(() => Array(len2 + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,      // deletion
                    dp[i][j - 1] + 1,      // insertion
                    dp[i - 1][j - 1] + 1   // substitution
                );
            }
        }
    }

    return dp[len1][len2];
}

/**
 * Normalize SKU for better fuzzy matching
 * Removes common variations that should be ignored
 */
export function normalizeSku(sku: string): string {
    return sku
        .toLowerCase()
        .replace(/\s+/g, '-')        // spaces to dashes
        .replace(/_/g, '-')          // underscores to dashes
        .replace(/--+/g, '-')        // multiple dashes to single
        .replace(/^-|-$/g, '')       // trim dashes
        .replace(/plus/gi, 'plus')   // normalize Plus
        .replace(/\bpro\b/gi, 'pro') // normalize Pro
        .trim();
}

/**
 * Calculate similarity score between two strings (0 to 1)
 * 1 = identical, 0 = completely different
 */
export function getSimilarityScore(str1: string, str2: string): number {
    const s1 = normalizeSku(str1);
    const s2 = normalizeSku(str2);

    if (s1 === s2) return 1;

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;

    const distance = levenshteinDistance(s1, s2);
    return 1 - (distance / maxLen);
}

/**
 * Find best matching key from a record/map
 * @param target The string to match
 * @param candidates Object with candidate strings as keys
 * @param threshold Minimum similarity score (0-1), default 0.8
 * @returns Best matching key or null if no match above threshold
 */
export function findBestMatch<T>(
    target: string,
    candidates: Record<string, T>,
    threshold: number = 0.8
): string | null {
    let bestMatch: string | null = null;
    let bestScore = threshold;

    const keys = Object.keys(candidates);

    for (const key of keys) {
        const score = getSimilarityScore(target, key);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = key;
        }
    }

    return bestMatch;
}

/**
 * Get value from map using fuzzy matching
 * First tries exact match, then fuzzy match if threshold is met
 */
export function fuzzyGet<T>(
    key: string,
    map: Record<string, T>,
    threshold: number = 0.8
): T | undefined {
    // Try exact match first
    if (map[key] !== undefined) {
        return map[key];
    }

    // Try fuzzy match
    const bestMatch = findBestMatch(key, map, threshold);
    return bestMatch ? map[bestMatch] : undefined;
}

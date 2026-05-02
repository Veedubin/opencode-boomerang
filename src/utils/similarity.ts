/**
 * Text Similarity Utilities
 * 
 * Provides text similarity calculation for loop detection in task execution.
 */

/**
 * Calculate text similarity between two strings
 * Uses combined scoring for accurate loop detection
 * Returns value between 0 and 1 (1 = identical)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1;
  if (!text1 || !text2) return 0;
  
  // Normalize strings
  const norm1 = text1.toLowerCase().trim();
  const norm2 = text2.toLowerCase().trim();
  
  if (norm1 === norm2) return 1;
  
  // Check for exact substring match (one contains the other)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length < norm2.length ? norm2 : norm1;
    // Scale by how much of the longer string is covered
    return shorter.length / longer.length;
  }
  
  // Check prefix overlap (how much they share at start)
  let prefixLen = 0;
  const minLen = Math.min(norm1.length, norm2.length);
  for (let i = 0; i < minLen; i++) {
    if (norm1[i] === norm2[i]) {
      prefixLen++;
    } else {
      break;
    }
  }
  const prefixScore = prefixLen / minLen;
  
  // Check suffix overlap
  let suffixLen = 0;
  for (let i = 0; i < minLen; i++) {
    const idx1 = norm1.length - 1 - i;
    const idx2 = norm2.length - 1 - i;
    if (idx1 >= 0 && idx2 >= 0 && norm1[idx1] === norm2[idx2]) {
      suffixLen++;
    } else {
      break;
    }
  }
  const suffixScore = suffixLen / minLen;
  
  // Use Jaccard similarity for word-based comparison
  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;
  
  // Check for shared bigrams
  const getBigrams = (text: string): Set<string> => {
    const words = text.split(/\s+/);
    const bigrams = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
  };
  
  const bigrams1 = getBigrams(norm1);
  const bigrams2 = getBigrams(norm2);
  const bigramIntersection = new Set([...bigrams1].filter(b => bigrams2.has(b)));
  const bigramUnion = new Set([...bigrams1, ...bigrams2]);
  const bigramScore = bigramUnion.size > 0 ? bigramIntersection.size / bigramUnion.size : 0;
  
  // Combined score - take the highest score (for loop detection we care about any high similarity)
  // Weight bigrams and prefix higher for task comparison
  return Math.max(prefixScore, suffixScore, jaccard, bigramScore);
}
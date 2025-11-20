/**
 * Auto-Compression Selection
 * Intelligently selects the best compression algorithm based on payload characteristics
 */

import type { CompressionAlgorithm } from "../types.js";

/**
 * Payload analysis result
 */
export interface PayloadAnalysis {
  /** Size in bytes */
  size: number;
  /** Estimated entropy (0-1, higher = more random/compressed) */
  entropy: number;
  /** Whether payload appears to be already compressed */
  likelyCompressed: boolean;
  /** Recommended compression algorithm */
  recommended: CompressionAlgorithm;
}

/**
 * Compression algorithm characteristics
 */
interface CompressionCharacteristics {
  /** Minimum size where this algorithm is effective */
  minSize: number;
  /** Maximum size where this algorithm is practical */
  maxSize: number;
  /** Speed rating (1-10, higher = faster) */
  speed: number;
  /** Compression ratio rating (1-10, higher = better compression) */
  ratio: number;
  /** Cross-platform availability */
  crossPlatform: boolean;
}

/**
 * Compression algorithm characteristics database
 */
const COMPRESSION_CHARACTERISTICS: Record<CompressionAlgorithm, CompressionCharacteristics> = {
  none: {
    minSize: 0,
    maxSize: Infinity,
    speed: 10,
    ratio: 0,
    crossPlatform: true,
  },
  "lz-string": {
    minSize: 100,
    maxSize: 100_000,
    speed: 8,
    ratio: 6,
    crossPlatform: true,
  },
  brotli: {
    minSize: 1_000,
    maxSize: 10_000_000,
    speed: 5,
    ratio: 9,
    crossPlatform: false, // Node only by default
  },
  zlib: {
    minSize: 500,
    maxSize: 5_000_000,
    speed: 7,
    ratio: 7,
    crossPlatform: false, // Node only
  },
};

/**
 * Calculate Shannon entropy of data
 * Higher entropy (closer to 1) means more randomness/already compressed
 *
 * @param data - Data to analyze
 * @returns Entropy value between 0 and 1
 */
function calculateEntropy(data: string): number {
  if (data.length === 0) return 0;

  // Count character frequencies
  const frequencies = new Map<string, number>();
  for (const char of data) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }

  // Calculate entropy
  let entropy = 0;
  const len = data.length;

  for (const count of frequencies.values()) {
    const probability = count / len;
    entropy -= probability * Math.log2(probability);
  }

  // Normalize to 0-1 (max entropy is log2(256) for byte data)
  const maxEntropy = Math.log2(Math.min(frequencies.size, 256));
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Detect if data is likely already compressed
 * Checks for high entropy and lack of patterns
 *
 * @param data - Data to check
 * @returns true if data appears compressed
 */
function isLikelyCompressed(data: string): boolean {
  // Very small data can't reliably be detected
  if (data.length < 100) return false;

  const entropy = calculateEntropy(data);

  // High entropy suggests compression or encryption
  if (entropy > 0.9) return true;

  // Check for patterns that suggest uncompressed text
  const hasRepeatedSpaces = /\s{3,}/.test(data);
  const hasRepeatedChars = /(.)\1{5,}/.test(data);

  if (hasRepeatedSpaces || hasRepeatedChars) return false;

  // Check character distribution
  const whitespaceRatio = (data.match(/\s/g) ?? []).length / data.length;

  // Natural text has 15-20% whitespace
  if (whitespaceRatio > 0.1 && whitespaceRatio < 0.3) return false;

  return entropy > 0.85;
}

/**
 * Analyze payload to determine best compression strategy
 *
 * @param data - Data to analyze (already JSON serialized)
 * @param preferCrossPlatform - Prefer algorithms that work in both Node and browser
 * @returns Payload analysis with recommendation
 *
 * @example
 * ```ts
 * const json = JSON.stringify(data);
 * const analysis = analyzePayload(json);
 * console.log(`Recommended: ${analysis.recommended}`);
 * ```
 */
export function analyzePayload(data: string, preferCrossPlatform = true): PayloadAnalysis {
  const size = data.length;
  const entropy = calculateEntropy(data);
  const likelyCompressed = isLikelyCompressed(data);

  // Don't compress if already compressed
  if (likelyCompressed) {
    return {
      size,
      entropy,
      likelyCompressed: true,
      recommended: "none",
    };
  }

  // Don't compress very small payloads
  if (size < 100) {
    return {
      size,
      entropy,
      likelyCompressed: false,
      recommended: "none",
    };
  }

  // For cross-platform, use lz-string for small/medium or none for tiny
  if (preferCrossPlatform) {
    if (size < 500) {
      return {
        size,
        entropy,
        likelyCompressed: false,
        recommended: "none",
      };
    }
    return {
      size,
      entropy,
      likelyCompressed: false,
      recommended: "lz-string",
    };
  }

  // For Node environments, optimize based on size
  if (size < 500) {
    return {
      size,
      entropy,
      likelyCompressed: false,
      recommended: "none",
    };
  }

  if (size < 10_000) {
    // Small payloads: lz-string is fast enough
    return {
      size,
      entropy,
      likelyCompressed: false,
      recommended: "lz-string",
    };
  }

  if (size < 100_000) {
    // Medium payloads: zlib is a good balance
    return {
      size,
      entropy,
      likelyCompressed: false,
      recommended: "zlib",
    };
  }

  // Large payloads: brotli gives best compression
  return {
    size,
    entropy,
    likelyCompressed: false,
    recommended: "brotli",
  };
}

/**
 * Select compression algorithm automatically based on data
 *
 * @param data - Data to compress (any type, will be serialized)
 * @param preferCrossPlatform - Prefer cross-platform algorithms
 * @returns Recommended compression algorithm
 *
 * @example
 * ```ts
 * const algorithm = selectCompressionAlgorithm(largeData);
 * const token = await encode(largeData, 'secret', { compression: algorithm });
 * ```
 */
export function selectCompressionAlgorithm(
  data: unknown,
  preferCrossPlatform = true
): CompressionAlgorithm {
  const json = JSON.stringify(data);
  const analysis = analyzePayload(json, preferCrossPlatform);
  return analysis.recommended;
}

/**
 * Compare compression algorithms for given data
 * Returns analysis for each algorithm
 *
 * @param data - Data to analyze
 * @returns Map of algorithm to suitability score (0-100)
 *
 * @example
 * ```ts
 * const scores = compareCompressionAlgorithms(data);
 * for (const [algo, score] of scores) {
 *   console.log(`${algo}: ${score}/100`);
 * }
 * ```
 */
export function compareCompressionAlgorithms(data: unknown): Map<CompressionAlgorithm, number> {
  const json = JSON.stringify(data);
  const size = json.length;
  const entropy = calculateEntropy(json);
  const likelyCompressed = isLikelyCompressed(json);

  const scores = new Map<CompressionAlgorithm, number>();

  // If already compressed, none is best
  if (likelyCompressed) {
    scores.set("none", 100);
    scores.set("lz-string", 10);
    scores.set("zlib", 10);
    scores.set("brotli", 10);
    return scores;
  }

  // Score each algorithm
  for (const [algo, chars] of Object.entries(COMPRESSION_CHARACTERISTICS)) {
    let score = 50; // Base score

    // Size suitability
    if (size < chars.minSize) {
      score -= 30; // Too small for this algorithm
    } else if (size > chars.maxSize) {
      score -= 30; // Too large for this algorithm
    } else {
      // Within range, score based on how well-suited
      const sizeRatio = (size - chars.minSize) / (chars.maxSize - chars.minSize);
      if (sizeRatio > 0.2 && sizeRatio < 0.8) {
        score += 20; // Sweet spot
      }
    }

    // Compression benefit (lower entropy = more benefit)
    const compressionBenefit = (1 - entropy) * chars.ratio * 5;
    score += compressionBenefit;

    // Speed consideration (faster is better for small files)
    if (size < 10_000) {
      score += chars.speed * 2;
    }

    // Cross-platform bonus
    if (chars.crossPlatform) {
      score += 10;
    }

    scores.set(algo as CompressionAlgorithm, Math.max(0, Math.min(100, score)));
  }

  return scores;
}

/**
 * Get the best compression algorithm based on comparison scores
 *
 * @param data - Data to analyze
 * @returns Best compression algorithm
 */
export function getBestCompressionAlgorithm(data: unknown): CompressionAlgorithm {
  const scores = compareCompressionAlgorithms(data);

  let best: CompressionAlgorithm = "none";
  let bestScore = 0;

  for (const [algo, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = algo;
    }
  }

  return best;
}

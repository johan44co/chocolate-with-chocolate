/**
 * Compression layer with pluggable algorithms
 * Supports Brotli, LZ-String, and Zlib compression
 */

import type { Compressor, CompressionAlgorithm } from "../types.js";

/**
 * No compression (pass-through)
 */
class NoneCompressor implements Compressor {
  compress(data: Uint8Array): Uint8Array {
    return data;
  }

  decompress(data: Uint8Array): Uint8Array {
    return data;
  }
}

/**
 * LZ-String compression (pure JavaScript, works everywhere)
 * Best for: Small to medium payloads, browser compatibility
 */
class LZStringCompressor implements Compressor {
  async compress(data: Uint8Array): Promise<Uint8Array> {
    // Handle empty input
    if (data.length === 0) {
      return new Uint8Array(0);
    }

    // Dynamically import lz-string only when needed
    const { default: LZString } = await import("lz-string");

    // Convert to base64 string for lz-string
    const base64 = btoa(String.fromCharCode(...data));
    const compressed = LZString.compressToUint8Array(base64);
    return compressed;
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    // Handle empty input
    if (data.length === 0) {
      return new Uint8Array(0);
    }

    // Dynamically import lz-string only when needed
    const { default: LZString } = await import("lz-string");

    const decompressed = LZString.decompressFromUint8Array(data);
    if (!decompressed) {
      throw new Error("LZ-String decompression failed");
    }
    // Convert from base64 back to bytes
    const binary = atob(decompressed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

/**
 * Brotli compression (Node.js native only)
 * Best for: Large payloads, maximum compression ratio
 * Browser: Uses LZ-String fallback (more reliable than CompressionStream)
 */
class BrotliCompressor implements Compressor {
  async compress(data: Uint8Array): Promise<Uint8Array> {
    // Node.js environment - check for process and process.versions.node
    if (typeof process !== "undefined" && process.versions && process.versions.node) {
      try {
        // Dynamic import for ESM compatibility
        const zlib = await import("zlib");
        return await new Promise<Uint8Array>((resolve, reject) => {
          zlib.brotliCompress(
            Buffer.from(data),
            {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 6, // Balance speed/compression
              },
            },
            (err: Error | null, result: Buffer) => {
              if (err) reject(err);
              else resolve(new Uint8Array(result));
            }
          );
        });
      } catch {
        throw new Error("Brotli compression not available in Node.js");
      }
    }

    // Browser environment - fallback to LZ-String
    // Note: CompressionStream is not reliably available across browsers
    // and can cause hangs in some implementations. LZ-String works everywhere.
    const lzCompressor = new LZStringCompressor();
    return await lzCompressor.compress(data);
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    // Node.js environment
    if (typeof process !== "undefined" && process.versions && process.versions.node) {
      try {
        const zlib = await import("zlib");
        return await new Promise<Uint8Array>((resolve, reject) => {
          zlib.brotliDecompress(Buffer.from(data), (err, result) => {
            if (err) reject(err);
            else resolve(new Uint8Array(result));
          });
        });
      } catch {
        throw new Error("Brotli decompression not available in Node.js");
      }
    }

    // Browser environment - fallback to LZ-String
    // Note: DecompressionStream is not reliably available across browsers
    // and can cause hangs in some implementations. LZ-String works everywhere.
    const lzCompressor = new LZStringCompressor();
    return await lzCompressor.decompress(data);
  }
}

/**
 * Zlib compression (Node.js only, fast and efficient)
 * Best for: Server-side use, good balance of speed and compression
 */
class ZlibCompressor implements Compressor {
  async compress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof process !== "undefined" && process.versions && process.versions.node) {
      try {
        const zlib = await import("zlib");
        return await new Promise<Uint8Array>((resolve, reject) => {
          zlib.deflate(
            Buffer.from(data),
            { level: 6 }, // Balance speed/compression
            (err, result) => {
              if (err) reject(err);
              else resolve(new Uint8Array(result));
            }
          );
        });
      } catch {
        throw new Error("Zlib compression not available");
      }
    }

    throw new Error("Zlib compression is only available in Node.js");
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof process !== "undefined" && process.versions && process.versions.node) {
      try {
        const zlib = await import("zlib");
        return await new Promise<Uint8Array>((resolve, reject) => {
          zlib.inflate(Buffer.from(data), (err, result) => {
            if (err) reject(err);
            else resolve(new Uint8Array(result));
          });
        });
      } catch {
        throw new Error("Zlib decompression not available");
      }
    }

    throw new Error("Zlib decompression is only available in Node.js");
  }
}

/**
 * Get a compressor instance for the specified algorithm
 * @param algorithm - Compression algorithm to use
 * @returns Compressor instance
 */
export function getCompressor(algorithm: CompressionAlgorithm): Compressor {
  switch (algorithm) {
    case "none":
      return new NoneCompressor();
    case "lz-string":
      return new LZStringCompressor();
    case "brotli":
      return new BrotliCompressor();
    case "zlib":
      return new ZlibCompressor();
    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

/**
 * Compress data using the specified algorithm
 * @param data - Data to compress
 * @param algorithm - Compression algorithm
 * @returns Compressed data
 */
export async function compress(
  data: Uint8Array,
  algorithm: CompressionAlgorithm = "brotli"
): Promise<Uint8Array> {
  const compressor = getCompressor(algorithm);
  const result = compressor.compress(data);
  return result instanceof Promise ? await result : result;
}

/**
 * Decompress data using the specified algorithm
 * @param data - Compressed data
 * @param algorithm - Compression algorithm used
 * @returns Decompressed data
 */
export async function decompress(
  data: Uint8Array,
  algorithm: CompressionAlgorithm
): Promise<Uint8Array> {
  const compressor = getCompressor(algorithm);
  const result = compressor.decompress(data);
  return result instanceof Promise ? await result : result;
}

/**
 * Check if a compression algorithm is available in the current environment
 * @param algorithm - Compression algorithm to check
 * @returns true if available, false otherwise
 */
export function isCompressionAvailable(algorithm: CompressionAlgorithm): boolean {
  switch (algorithm) {
    case "none":
    case "lz-string":
      return true; // Always available
    case "brotli":
      // Available in Node.js or browsers with CompressionStream
      return !!(
        (typeof process !== "undefined" && process.versions && process.versions.node) ||
        typeof CompressionStream !== "undefined"
      );
    case "zlib":
      // Only available in Node.js
      return !!(typeof process !== "undefined" && process.versions && process.versions.node);
    default:
      return false;
  }
}

/**
 * Get the best compression algorithm for the current environment
 * @returns Recommended compression algorithm
 */
export function getDefaultCompression(): CompressionAlgorithm {
  // Prefer Brotli if available (best compression)
  if (isCompressionAvailable("brotli")) {
    return "brotli";
  }

  // Fall back to LZ-String (pure JS, works everywhere)
  return "lz-string";
}

/**
 * Calculate compression ratio
 * @param original - Original data size
 * @param compressed - Compressed data size
 * @returns Compression ratio (e.g., 2.5 means 2.5x smaller)
 */
export function getCompressionRatio(original: number, compressed: number): number {
  if (compressed === 0) return 0;
  return original / compressed;
}

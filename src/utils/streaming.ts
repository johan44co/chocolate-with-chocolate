/**
 * Streaming Utilities
 * Provides chunked encoding/decoding for large payloads
 */

import { encode, decode } from "../cwc.js";
import type { EncodeOptions, KeyMaterial } from "../types.js";

/**
 * Default chunk size for streaming (1MB)
 */
export const DEFAULT_CHUNK_SIZE = 1024 * 1024;

/**
 * Chunk metadata for streaming
 */
export interface ChunkMetadata {
  /** Chunk index (0-based) */
  index: number;
  /** Total number of chunks */
  total: number;
  /** Chunk ID for reassembly */
  chunkId: string;
}

/**
 * Encoded chunk with metadata
 */
export interface EncodedChunk {
  /** The encoded token for this chunk */
  token: string;
  /** Chunk metadata */
  metadata: ChunkMetadata;
}

/**
 * Generate a unique chunk ID
 */
function generateChunkId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Split data into chunks for streaming encoding
 * Each chunk is encoded independently
 *
 * @param data - Data to encode
 * @param secret - Encryption secret
 * @param options - Encoding options
 * @param chunkSize - Maximum size of each chunk (default: 1MB)
 * @returns Array of encoded chunks with metadata
 *
 * @example
 * ```ts
 * const largeData = { items: [...] }; // Large dataset
 * const chunks = await encodeStream(largeData, 'secret', {}, 500_000);
 *
 * // Store or transmit chunks independently
 * for (const chunk of chunks) {
 *   console.log(`Chunk ${chunk.metadata.index}/${chunk.metadata.total}`);
 * }
 * ```
 */
export async function encodeStream(
  data: unknown,
  secret: KeyMaterial,
  options: EncodeOptions = {},
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<EncodedChunk[]> {
  // Serialize entire data first
  const json = JSON.stringify(data);
  const totalSize = json.length;

  // Calculate number of chunks needed
  const numChunks = Math.ceil(totalSize / chunkSize);
  const chunkId = generateChunkId();

  const chunks: EncodedChunk[] = [];

  // Split into chunks
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunkData = json.slice(start, end);

    const chunkMetadata: ChunkMetadata = {
      index: i,
      total: numChunks,
      chunkId,
    };

    // Encode chunk with its metadata
    const chunkPayload = {
      data: chunkData,
      meta: chunkMetadata,
    };

    const token = await encode(chunkPayload, secret, options);

    chunks.push({
      token,
      metadata: chunkMetadata,
    });
  }

  return chunks;
}

/**
 * Decode and reassemble chunks from streaming encoding
 * Validates chunk order and completeness
 *
 * @param chunks - Array of encoded chunks (can be in any order)
 * @param secret - Decryption secret
 * @returns Reassembled and decoded data
 * @throws {Error} If chunks are incomplete or invalid
 *
 * @example
 * ```ts
 * const chunks = [...]; // Retrieved chunks
 * const data = await decodeStream(chunks, 'secret');
 * ```
 */
export async function decodeStream(chunks: EncodedChunk[], secret: KeyMaterial): Promise<unknown> {
  if (chunks.length === 0) {
    throw new Error("No chunks provided");
  }

  // Decode all chunks
  const decodedChunks: { data: string; meta: ChunkMetadata }[] = [];

  for (const chunk of chunks) {
    const decoded = await decode<{ data: string; meta: ChunkMetadata }>(chunk.token, secret);
    decodedChunks.push(decoded);
  }

  // Validate chunk ID consistency
  const chunkId = decodedChunks[0]?.meta.chunkId;
  if (!chunkId) {
    throw new Error("Invalid chunk: missing chunk ID");
  }

  for (const chunk of decodedChunks) {
    if (chunk.meta.chunkId !== chunkId) {
      throw new Error("Chunk ID mismatch: chunks are from different streams");
    }
  }

  // Sort chunks by index
  decodedChunks.sort((a, b) => a.meta.index - b.meta.index);

  // Validate completeness
  const total = decodedChunks[0]?.meta.total ?? 0;
  if (decodedChunks.length !== total) {
    throw new Error(`Incomplete chunks: expected ${total}, got ${decodedChunks.length}`);
  }

  // Validate indices are sequential
  for (let i = 0; i < decodedChunks.length; i++) {
    if (decodedChunks[i]?.meta.index !== i) {
      throw new Error(`Missing chunk at index ${i}`);
    }
  }

  // Reassemble data
  const json = decodedChunks.map((chunk) => chunk.data).join("");

  // Parse JSON
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(
      `Failed to parse reassembled data: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }
}

/**
 * Decode chunks from token strings only
 * Convenience wrapper when you only have token strings
 *
 * @param tokens - Array of token strings
 * @param secret - Decryption secret
 * @returns Reassembled and decoded data
 *
 * @example
 * ```ts
 * const tokens = ['token1', 'token2', 'token3'];
 * const data = await decodeStreamFromTokens(tokens, 'secret');
 * ```
 */
export async function decodeStreamFromTokens(
  tokens: string[],
  secret: KeyMaterial
): Promise<unknown> {
  // First decode to get metadata
  const chunks: EncodedChunk[] = [];

  for (const token of tokens) {
    const decoded = await decode<{ data: string; meta: ChunkMetadata }>(token, secret);
    chunks.push({
      token,
      metadata: decoded.meta,
    });
  }

  return decodeStream(chunks, secret);
}

/**
 * Estimate the number of chunks needed for data
 *
 * @param data - Data to estimate
 * @param chunkSize - Chunk size in bytes
 * @returns Estimated number of chunks
 *
 * @example
 * ```ts
 * const numChunks = estimateChunkCount(largeData, 500_000);
 * console.log(`Will create approximately ${numChunks} chunks`);
 * ```
 */
export function estimateChunkCount(data: unknown, chunkSize: number = DEFAULT_CHUNK_SIZE): number {
  const json = JSON.stringify(data);
  return Math.ceil(json.length / chunkSize);
}

/**
 * Check if data should be streamed based on size
 *
 * @param data - Data to check
 * @param threshold - Size threshold in bytes (default: 1MB)
 * @returns true if data should be streamed
 *
 * @example
 * ```ts
 * if (shouldStream(data)) {
 *   const chunks = await encodeStream(data, 'secret');
 * } else {
 *   const token = await encode(data, 'secret');
 * }
 * ```
 */
export function shouldStream(data: unknown, threshold: number = DEFAULT_CHUNK_SIZE): boolean {
  const json = JSON.stringify(data);
  return json.length > threshold;
}

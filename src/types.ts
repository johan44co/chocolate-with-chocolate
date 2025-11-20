/**
 * Core type definitions for CWC (Chocolate With Chocolate)
 * Double-layer encoding: compression + encryption
 */

/**
 * Supported compression algorithms
 */
export type CompressionAlgorithm = "brotli" | "lz-string" | "zlib" | "none";

/**
 * Supported encryption algorithms (currently only AES-GCM)
 */
export type EncryptionAlgorithm = "aes-gcm-256";

/**
 * CWC token version
 */
export type Version = 1;

/**
 * Metadata packed into each CWC token
 */
export interface TokenMetadata {
  /** Token format version */
  version: Version;
  /** Encryption algorithm used */
  algorithm: EncryptionAlgorithm;
  /** Compression algorithm used */
  compression: CompressionAlgorithm;
  /** Timestamp when token was created (optional) */
  timestamp?: number;
  /** Time-to-live in seconds (optional) */
  ttl?: number;
}

/**
 * Options for encoding data into a CWC token
 */
export interface EncodeOptions {
  /** Compression algorithm to use (default: "brotli") */
  compression?: CompressionAlgorithm;
  /** Encryption algorithm to use (default: "aes-gcm-256") */
  algorithm?: EncryptionAlgorithm;
  /** Include timestamp in metadata */
  includeTimestamp?: boolean;
  /** Time-to-live in seconds */
  ttl?: number;
}

/**
 * Decoding result with metadata
 */
export interface DecodeResult<T> {
  /** Decoded data */
  data: T;
  /** Token metadata */
  metadata: TokenMetadata;
}

/**
 * Compression interface for pluggable compression algorithms
 */
export interface Compressor {
  /** Compress data */
  compress(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
  /** Decompress data */
  decompress(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
}

/**
 * Key material - can be a string (will be derived) or direct Uint8Array
 */
export type KeyMaterial = string | Uint8Array;

/**
 * Crypto key for AES-GCM operations
 */
export interface CryptoKey {
  /** The raw key bytes */
  key: Uint8Array;
  /** Algorithm used */
  algorithm: EncryptionAlgorithm;
}

/**
 * Encrypted payload with IV
 */
export interface EncryptedPayload {
  /** Initialization vector */
  iv: Uint8Array;
  /** Encrypted data with authentication tag */
  ciphertext: Uint8Array;
}

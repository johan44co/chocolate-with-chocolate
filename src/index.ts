/**
 * CWC (Chocolate With Chocolate)
 * Double-layer encoding: compression + encryption
 *
 * @module cwc
 */

// Core utilities
export * from "./utils/base64.js";
export * from "./utils/buffers.js";
export * from "./utils/metadata.js";
export * from "./utils/versioning.js";

// Advanced utilities
export * from "./utils/keyRotation.js";
export * from "./utils/ttl.js";
export * from "./utils/customMetadata.js";
export * from "./utils/streaming.js";
export * from "./utils/autoCompress.js";

// Crypto layer
export * from "./core/crypto.js";

// Compression layer
export * from "./core/compression.js";

// Types
export type {
  CompressionAlgorithm,
  EncryptionAlgorithm,
  Version,
  TokenMetadata,
  EncodeOptions,
  DecodeResult,
  Compressor,
  KeyMaterial,
  CryptoKey,
  EncryptedPayload,
} from "./types.js";

// Main API
export { encode, decode, validateToken, extractMetadata } from "./cwc.js";

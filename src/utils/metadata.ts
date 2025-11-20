/**
 * Token metadata packing and unpacking utilities
 * Handles serialization of version, algorithm, compression type into compact binary format
 */

import type {
  TokenMetadata,
  Version,
  EncryptionAlgorithm,
  CompressionAlgorithm,
} from "../types.js";
import { concatBytes, sliceBytes } from "./buffers.js";

/**
 * Metadata format (binary):
 * - Byte 0: Version (1 byte)
 * - Byte 1: Algorithm ID (1 byte)
 * - Byte 2: Compression ID (1 byte)
 * - Byte 3: Flags (1 byte) - bit 0: has timestamp, bit 1: has TTL
 * - Bytes 4-7: Timestamp (4 bytes, uint32) - optional
 * - Bytes 8-11: TTL (4 bytes, uint32) - optional
 */

const ALGORITHM_MAP: Record<EncryptionAlgorithm, number> = {
  "aes-gcm-256": 0x01,
};

const ALGORITHM_REVERSE_MAP: Record<number, EncryptionAlgorithm> = {
  0x01: "aes-gcm-256",
};

const COMPRESSION_MAP: Record<CompressionAlgorithm, number> = {
  none: 0x00,
  brotli: 0x01,
  "lz-string": 0x02,
  zlib: 0x03,
};

const COMPRESSION_REVERSE_MAP: Record<number, CompressionAlgorithm> = {
  0x00: "none",
  0x01: "brotli",
  0x02: "lz-string",
  0x03: "zlib",
};

const FLAG_HAS_TIMESTAMP = 0b00000001;
const FLAG_HAS_TTL = 0b00000010;

/**
 * Pack metadata into compact binary format
 * @param metadata - Token metadata to pack
 * @returns Binary representation of metadata
 */
export function packMetadata(metadata: TokenMetadata): Uint8Array {
  const algorithmId = ALGORITHM_MAP[metadata.algorithm];
  if (algorithmId === undefined) {
    throw new Error(`Unsupported algorithm: ${metadata.algorithm}`);
  }

  const compressionId = COMPRESSION_MAP[metadata.compression];
  if (compressionId === undefined) {
    throw new Error(`Unsupported compression: ${metadata.compression}`);
  }

  // Calculate flags
  let flags = 0;
  if (metadata.timestamp !== undefined) {
    flags |= FLAG_HAS_TIMESTAMP;
  }
  if (metadata.ttl !== undefined) {
    flags |= FLAG_HAS_TTL;
  }

  // Build header (4 bytes)
  const header = new Uint8Array([metadata.version, algorithmId, compressionId, flags]);

  const parts: Uint8Array[] = [header];

  // Add timestamp if present (4 bytes, uint32)
  if (metadata.timestamp !== undefined) {
    const timestampBytes = new Uint8Array(4);
    const view = new DataView(timestampBytes.buffer);
    // Store as seconds since epoch (divide by 1000 if milliseconds)
    const timestampSeconds = Math.floor(metadata.timestamp / 1000);
    view.setUint32(0, timestampSeconds, false); // big-endian
    parts.push(timestampBytes);
  }

  // Add TTL if present (4 bytes, uint32)
  if (metadata.ttl !== undefined) {
    const ttlBytes = new Uint8Array(4);
    const view = new DataView(ttlBytes.buffer);
    view.setUint32(0, metadata.ttl, false); // big-endian
    parts.push(ttlBytes);
  }

  return concatBytes(...parts);
}

/**
 * Unpack metadata from binary format
 * @param data - Binary metadata
 * @returns Parsed token metadata
 * @throws {Error} If metadata is invalid or corrupted
 */
export function unpackMetadata(data: Uint8Array): TokenMetadata {
  if (data.length < 4) {
    throw new Error("Invalid metadata: too short");
  }

  const version = data[0] as Version;
  const algorithmId = data[1];
  const compressionId = data[2];
  const flags = data[3];

  if (algorithmId === undefined || compressionId === undefined || flags === undefined) {
    throw new Error("Invalid metadata: corrupted header");
  }

  const algorithm = ALGORITHM_REVERSE_MAP[algorithmId];
  if (!algorithm) {
    throw new Error(`Unknown algorithm ID: ${algorithmId}`);
  }

  const compression = COMPRESSION_REVERSE_MAP[compressionId];
  if (compression === undefined) {
    throw new Error(`Unknown compression ID: ${compressionId}`);
  }

  const metadata: TokenMetadata = {
    version,
    algorithm,
    compression,
  };

  let offset = 4;

  // Read timestamp if present
  if (flags & FLAG_HAS_TIMESTAMP) {
    if (data.length < offset + 4) {
      throw new Error("Invalid metadata: missing timestamp bytes");
    }
    const timestampBytes = sliceBytes(data, offset, offset + 4);
    const view = new DataView(timestampBytes.buffer);
    const timestampSeconds = view.getUint32(0, false); // big-endian
    metadata.timestamp = timestampSeconds * 1000; // convert to milliseconds
    offset += 4;
  }

  // Read TTL if present
  if (flags & FLAG_HAS_TTL) {
    if (data.length < offset + 4) {
      throw new Error("Invalid metadata: missing TTL bytes");
    }
    const ttlBytes = sliceBytes(data, offset, offset + 4);
    const view = new DataView(ttlBytes.buffer);
    metadata.ttl = view.getUint32(0, false); // big-endian
    offset += 4;
  }

  return metadata;
}

/**
 * Get the size of packed metadata in bytes
 * @param metadata - Token metadata
 * @returns Size in bytes
 */
export function getMetadataSize(metadata: TokenMetadata): number {
  let size = 4; // Header always 4 bytes

  if (metadata.timestamp !== undefined) {
    size += 4;
  }

  if (metadata.ttl !== undefined) {
    size += 4;
  }

  return size;
}

/**
 * Create default metadata for encoding
 * @param compression - Compression algorithm (default: "brotli")
 * @param algorithm - Encryption algorithm (default: "aes-gcm-256")
 * @param includeTimestamp - Whether to include timestamp
 * @param ttl - Time-to-live in seconds
 * @returns Default token metadata
 */
export function createDefaultMetadata(
  compression: CompressionAlgorithm = "brotli",
  algorithm: EncryptionAlgorithm = "aes-gcm-256",
  includeTimestamp = false,
  ttl?: number
): TokenMetadata {
  const metadata: TokenMetadata = {
    version: 1,
    algorithm,
    compression,
  };

  if (includeTimestamp) {
    metadata.timestamp = Date.now();
  }

  if (ttl !== undefined) {
    metadata.ttl = ttl;
  }

  return metadata;
}

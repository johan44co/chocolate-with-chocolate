/**
 * CWC (Chocolate With Chocolate) - Main API
 * Double-layer encoding: compression + encryption
 *
 * Flow:
 * - Encode: data → JSON → compress → encrypt → pack metadata → base64url
 * - Decode: base64url → unpack metadata → decrypt → decompress → JSON → data
 */

import type { EncodeOptions, KeyMaterial, TokenMetadata } from "./types.js";
import { stringToBytes, bytesToString, concatBytes, sliceBytes } from "./utils/buffers.js";
import { encodeBase64Url, decodeBase64Url } from "./utils/base64.js";
import {
  packMetadata,
  unpackMetadata,
  createDefaultMetadata,
  getMetadataSize,
} from "./utils/metadata.js";
import { validateVersion } from "./utils/versioning.js";
import { encrypt, decrypt } from "./core/crypto.js";
import { compress, decompress } from "./core/compression.js";

/**
 * Encode data into a secure CWC token
 *
 * Process:
 * 1. Serialize data to JSON
 * 2. Compress the serialized data
 * 3. Encrypt the compressed data
 * 4. Pack metadata (version, algorithm, compression)
 * 5. Combine metadata + salt (if any) + IV + ciphertext
 * 6. Encode to URL-safe base64
 *
 * @param data - Data to encode (will be JSON serialized)
 * @param secret - Encryption secret (string password or 256-bit key)
 * @param options - Encoding options
 * @returns CWC token (URL-safe base64 string)
 */
export async function encode(
  data: unknown,
  secret: KeyMaterial,
  options: EncodeOptions = {}
): Promise<string> {
  // Step 1: Serialize data to JSON
  const json = JSON.stringify(data);
  const jsonBytes = stringToBytes(json);

  // Step 2: Compress the data
  const compressionAlgorithm = options.compression ?? "brotli";
  const compressed = await compress(jsonBytes, compressionAlgorithm);

  // Step 3: Encrypt the compressed data
  const encrypted = await encrypt(compressed, secret);

  // Step 4: Create and pack metadata
  const metadata = createDefaultMetadata(
    compressionAlgorithm,
    options.algorithm ?? "aes-gcm-256",
    options.includeTimestamp,
    options.ttl
  );
  const metadataBytes = packMetadata(metadata);

  // Step 5: Combine all parts
  // Format: [metadata][salt?][IV][ciphertext]
  const parts: Uint8Array[] = [metadataBytes];

  if (encrypted.salt) {
    parts.push(encrypted.salt);
  }

  parts.push(encrypted.iv);
  parts.push(encrypted.ciphertext);

  const combined = concatBytes(...parts);

  // Step 6: Encode to URL-safe base64
  const token = encodeBase64Url(combined);

  return token;
}

/**
 * Decode a CWC token back to the original data
 *
 * Process:
 * 1. Decode from URL-safe base64
 * 2. Extract and validate metadata
 * 3. Extract salt (if password-based), IV, and ciphertext
 * 4. Decrypt the ciphertext
 * 5. Decompress the decrypted data
 * 6. Parse JSON to restore original data
 *
 * @param token - CWC token to decode
 * @param secret - Decryption secret (must match encoding secret)
 * @returns Decoded data
 * @throws {Error} If token is invalid, corrupted, or wrong secret
 */
export async function decode<T = unknown>(token: string, secret: KeyMaterial): Promise<T> {
  // Step 1: Decode from base64
  let combined: Uint8Array;
  try {
    combined = decodeBase64Url(token);
  } catch {
    throw new Error("Invalid token: not valid base64");
  }

  // Step 2: Extract and validate metadata
  if (combined.length < 4) {
    throw new Error("Invalid token: too short");
  }

  let metadata;
  try {
    metadata = unpackMetadata(combined);
    validateVersion(metadata);
  } catch (error) {
    throw new Error(
      `Invalid token: ${error instanceof Error ? error.message : "corrupted metadata"}`
    );
  }

  // Step 3: Extract components based on metadata
  let offset = getMetadataSize(metadata);

  // Check if we have enough data
  const minSize = offset + (typeof secret === "string" ? 16 : 0) + 12; // metadata + salt? + IV
  if (combined.length < minSize) {
    throw new Error("Invalid token: corrupted data");
  }

  // Extract salt if password-based encryption (secret is string)
  let salt: Uint8Array | undefined;
  if (typeof secret === "string") {
    salt = sliceBytes(combined, offset, offset + 16);
    offset += 16;
  }

  // Extract IV (12 bytes for AES-GCM)
  const iv = sliceBytes(combined, offset, offset + 12);
  offset += 12;

  // Extract ciphertext (rest of the data)
  const ciphertext = sliceBytes(combined, offset);

  // Step 4: Decrypt
  let decrypted: Uint8Array;
  try {
    decrypted = await decrypt({ iv, ciphertext }, secret, salt);
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : "invalid key or corrupted data"}`
    );
  }

  // Step 5: Decompress
  let decompressed: Uint8Array;
  try {
    decompressed = await decompress(decrypted, metadata.compression);
  } catch (error) {
    throw new Error(
      `Decompression failed: ${error instanceof Error ? error.message : "corrupted data"}`
    );
  }

  // Step 6: Parse JSON
  let json: string;
  try {
    json = bytesToString(decompressed);
  } catch {
    throw new Error("Invalid token: not valid UTF-8");
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Invalid token: not valid JSON");
  }

  // Check TTL if present
  if (metadata.timestamp && metadata.ttl) {
    const now = Date.now();
    const expiresAt = metadata.timestamp + metadata.ttl * 1000;
    if (now > expiresAt) {
      throw new Error("Token has expired");
    }
  }

  return data as T;
}

/**
 * Decode a token and return both data and metadata
 *
 * @param token - CWC token to decode
 * @param secret - Decryption secret
 * @returns Object with decoded data and metadata
 */
export async function decodeWithMetadata(
  token: string,
  secret: KeyMaterial
): Promise<{ data: unknown; metadata: TokenMetadata }> {
  // Decode token first to get metadata
  const combined = decodeBase64Url(token);
  const metadata = unpackMetadata(combined);

  // Then decode normally
  const data = await decode(token, secret);

  return { data, metadata };
}

/**
 * Validate a token without decoding it
 * Checks token format and version, but does not decrypt
 *
 * @param token - CWC token to validate
 * @returns true if token format is valid
 */
export function validateToken(token: string): boolean {
  try {
    const combined = decodeBase64Url(token);
    if (combined.length < 4) {
      return false;
    }

    const metadata = unpackMetadata(combined);
    validateVersion(metadata);

    // Check minimum size
    const minSize = getMetadataSize(metadata) + 12 + 16; // metadata + IV + min ciphertext
    return combined.length >= minSize;
  } catch {
    return false;
  }
}

/**
 * Extract metadata from a token without decrypting
 * Useful for checking token properties before decoding
 *
 * @param token - CWC token
 * @returns Token metadata
 * @throws {Error} If token is invalid
 */
export function extractMetadata(token: string): TokenMetadata {
  try {
    const combined = decodeBase64Url(token);
    const metadata = unpackMetadata(combined);
    validateVersion(metadata);
    return metadata;
  } catch (error) {
    throw new Error(`Invalid token: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

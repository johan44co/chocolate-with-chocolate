/**
 * Custom Metadata Utilities
 * Allows adding custom fields to token payloads for application-specific metadata
 */

import { encode, decode } from "../cwc.js";
import type { EncodeOptions, KeyMaterial } from "../types.js";

/**
 * Custom metadata that can be stored in token payload
 */
export type CustomMetadata = Record<string, unknown>;

/**
 * Wrapper for data with custom metadata
 */
export interface DataWithMetadata<T = unknown> {
  /** The actual payload data */
  data: T;
  /** Custom metadata fields */
  meta: CustomMetadata;
}

/**
 * Encode data with custom metadata fields
 * The metadata is stored in the encrypted payload, not in the token header
 * This allows arbitrary key-value pairs without changing the token format
 *
 * @param data - Data to encode
 * @param metadata - Custom metadata to include
 * @param secret - Encryption secret
 * @param options - Encoding options
 * @returns CWC token containing data and metadata
 *
 * @example
 * ```ts
 * const token = await encodeWithMetadata(
 *   { message: 'Hello' },
 *   { userId: '123', sessionId: 'abc' },
 *   'secret'
 * );
 * ```
 */
export async function encodeWithMetadata(
  data: unknown,
  metadata: CustomMetadata,
  secret: KeyMaterial,
  options?: EncodeOptions
): Promise<string> {
  const wrapper: DataWithMetadata = {
    data,
    meta: metadata,
  };

  return encode(wrapper, secret, options);
}

/**
 * Decode a token that contains custom metadata
 * Returns both the data and the metadata
 *
 * @param token - Token to decode
 * @param secret - Decryption secret
 * @returns Object containing data and metadata
 *
 * @example
 * ```ts
 * const { data, meta } = await decodeWithMetadata(token, 'secret');
 * console.log(`User ID: ${meta.userId}`);
 * ```
 */
export async function decodeWithMetadata(
  token: string,
  secret: KeyMaterial
): Promise<DataWithMetadata> {
  return decode<DataWithMetadata>(token, secret);
}

/**
 * Extract only the custom metadata from a token without the data
 *
 * @param token - Token to decode
 * @param secret - Decryption secret
 * @returns Custom metadata
 *
 * @example
 * ```ts
 * const meta = await extractCustomMetadata(token, 'secret');
 * console.log(`Session: ${meta.sessionId}`);
 * ```
 */
export async function extractCustomMetadata(
  token: string,
  secret: KeyMaterial
): Promise<CustomMetadata> {
  const { meta } = await decodeWithMetadata(token, secret);
  return meta;
}

/**
 * Update custom metadata in a token without changing the data
 * Decodes the token, updates metadata, and re-encodes
 *
 * @param token - Token to update
 * @param metadata - New or updated metadata fields
 * @param secret - Encryption secret (same for decode and encode)
 * @param options - Encoding options for new token
 * @returns New token with updated metadata
 *
 * @example
 * ```ts
 * const newToken = await updateMetadata(
 *   token,
 *   { lastAccessed: Date.now() },
 *   'secret'
 * );
 * ```
 */
export async function updateMetadata(
  token: string,
  metadata: Partial<CustomMetadata>,
  secret: KeyMaterial,
  options?: EncodeOptions
): Promise<string> {
  const { data, meta } = await decodeWithMetadata(token, secret);

  const updatedMeta = {
    ...meta,
    ...metadata,
  };

  return encodeWithMetadata(data, updatedMeta, secret, options);
}

/**
 * Check if a token contains custom metadata
 *
 * @param token - Token to check
 * @param secret - Decryption secret
 * @returns true if token has custom metadata structure
 *
 * @example
 * ```ts
 * if (await hasCustomMetadata(token, 'secret')) {
 *   const { meta } = await decodeWithMetadata(token, 'secret');
 * }
 * ```
 */
export async function hasCustomMetadata(token: string, secret: KeyMaterial): Promise<boolean> {
  try {
    const decoded = await decode(token, secret);
    return (
      typeof decoded === "object" &&
      decoded !== null &&
      "data" in decoded &&
      "meta" in decoded &&
      typeof (decoded as Record<string, unknown>)["meta"] === "object"
    );
  } catch {
    return false;
  }
}

/**
 * Validate custom metadata against a schema
 * Throws if required fields are missing or types are incorrect
 *
 * @param metadata - Metadata to validate
 * @param schema - Schema defining required fields and types
 * @throws {Error} If validation fails
 *
 * @example
 * ```ts
 * validateMetadataSchema(meta, {
 *   userId: 'string',
 *   timestamp: 'number',
 *   optional: '?string'
 * });
 * ```
 */
export function validateMetadataSchema(
  metadata: CustomMetadata,
  schema: Record<string, string>
): void {
  for (const [key, typeSpec] of Object.entries(schema)) {
    const isOptional = typeSpec.startsWith("?");
    const expectedType = isOptional ? typeSpec.slice(1) : typeSpec;
    const value = metadata[key];

    if (value === undefined) {
      if (!isOptional) {
        throw new Error(`Missing required metadata field: ${key}`);
      }
      continue;
    }

    // Check for array type explicitly
    const actualType = Array.isArray(value) ? "array" : typeof value;

    // Allow 'object' to match arrays for backward compatibility
    const typeMatches =
      actualType === expectedType || (expectedType === "object" && actualType === "array");

    if (!typeMatches) {
      throw new Error(
        `Invalid type for metadata field '${key}': expected ${expectedType}, got ${actualType}`
      );
    }
  }
}

/**
 * Create a typed metadata encoder/decoder pair with validation
 *
 * @param schema - Schema for metadata validation
 * @returns Object with encode and decode functions
 *
 * @example
 * ```ts
 * const userToken = createTypedMetadata({
 *   userId: 'string',
 *   role: 'string',
 *   loginAt: 'number'
 * });
 *
 * const token = await userToken.encode(
 *   { name: 'John' },
 *   { userId: '123', role: 'admin', loginAt: Date.now() },
 *   'secret'
 * );
 *
 * const { data, meta } = await userToken.decode(token, 'secret');
 * ```
 */
export function createTypedMetadata(schema: Record<string, string>): {
  encode: (
    data: unknown,
    metadata: CustomMetadata,
    secret: KeyMaterial,
    options?: EncodeOptions
  ) => Promise<string>;
  decode: (token: string, secret: KeyMaterial) => Promise<DataWithMetadata>;
} {
  return {
    async encode(
      data: unknown,
      metadata: CustomMetadata,
      secret: KeyMaterial,
      options?: EncodeOptions
    ): Promise<string> {
      validateMetadataSchema(metadata, schema);
      return encodeWithMetadata(data, metadata, secret, options);
    },

    async decode(token: string, secret: KeyMaterial): Promise<DataWithMetadata> {
      const result = await decodeWithMetadata(token, secret);
      validateMetadataSchema(result.meta, schema);
      return result;
    },
  };
}

/**
 * Key Rotation Utilities
 * Provides functionality for rotating encryption keys while maintaining backward compatibility
 */

import { decode, encode, extractMetadata } from "../cwc.js";
import type { EncodeOptions, KeyMaterial } from "../types.js";

/**
 * Rotate a token from an old key to a new key
 * Decodes with the old key and re-encodes with the new key
 *
 * @param token - The token to rotate
 * @param oldSecret - The current/old secret key
 * @param newSecret - The new secret key to use
 * @param options - Optional encoding options for the new token
 * @returns The re-encoded token with the new key
 *
 * @example
 * ```ts
 * const oldToken = await encode(data, 'old-secret');
 * const newToken = await rotateKey(oldToken, 'old-secret', 'new-secret');
 * // Can now decode with new-secret
 * const data = await decode(newToken, 'new-secret');
 * ```
 */
export async function rotateKey(
  token: string,
  oldSecret: KeyMaterial,
  newSecret: KeyMaterial,
  options?: EncodeOptions
): Promise<string> {
  // Decode with old key
  const data = await decode(token, oldSecret);

  // Re-encode with new key
  return encode(data, newSecret, options);
}

/**
 * Rotate multiple tokens in batch
 * Useful for rotating all tokens in a database or cache
 *
 * @param tokens - Array of tokens to rotate
 * @param oldSecret - The current/old secret key
 * @param newSecret - The new secret key to use
 * @param options - Optional encoding options for new tokens
 * @returns Array of re-encoded tokens
 *
 * @example
 * ```ts
 * const oldTokens = ['token1', 'token2', 'token3'];
 * const newTokens = await rotateKeys(oldTokens, 'old-secret', 'new-secret');
 * ```
 */
export async function rotateKeys(
  tokens: string[],
  oldSecret: KeyMaterial,
  newSecret: KeyMaterial,
  options?: EncodeOptions
): Promise<string[]> {
  return Promise.all(tokens.map((token) => rotateKey(token, oldSecret, newSecret, options)));
}

/**
 * Validate that a token can be decoded with the old key and re-encoded with the new key
 * Useful for testing key rotation before applying it
 *
 * @param token - The token to validate
 * @param oldSecret - The current/old secret key
 * @param newSecret - The new secret key to use
 * @returns true if rotation is valid, false otherwise
 *
 * @example
 * ```ts
 * const canRotate = await validateKeyRotation(token, 'old-secret', 'new-secret');
 * if (canRotate) {
 *   const newToken = await rotateKey(token, 'old-secret', 'new-secret');
 * }
 * ```
 */
export async function validateKeyRotation(
  token: string,
  oldSecret: KeyMaterial,
  newSecret: KeyMaterial
): Promise<boolean> {
  try {
    // Try to decode with old key
    const data = await decode(token, oldSecret);

    // Try to encode with new key
    const newToken = await encode(data, newSecret);

    // Verify new token can be decoded
    await decode(newToken, newSecret);

    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt to decode a token with multiple possible keys
 * Useful during a key rotation period where both old and new keys are valid
 *
 * @param token - The token to decode
 * @param secrets - Array of possible secret keys to try (in order)
 * @param options - Optional decode options
 * @returns The decoded data and the key that successfully decoded it
 * @throws Error if none of the keys can decode the token
 *
 * @example
 * ```ts
 * const { data, keyIndex } = await decodeWithKeyFallback(
 *   token,
 *   ['new-secret', 'old-secret-1', 'old-secret-2']
 * );
 * console.log(`Decoded with key ${keyIndex}`);
 * ```
 */
export async function decodeWithKeyFallback(
  token: string,
  secrets: KeyMaterial[]
): Promise<{ data: unknown; keyIndex: number }> {
  const errors: Error[] = [];

  for (let i = 0; i < secrets.length; i++) {
    try {
      const secret = secrets[i];
      if (!secret) continue;
      const data = await decode(token, secret);
      return { data, keyIndex: i };
    } catch (error) {
      errors.push(error as Error);
    }
  }

  throw new Error(
    `Failed to decode token with any of the ${secrets.length} provided keys. ` +
      `Errors: ${errors.map((e) => e.message).join("; ")}`
  );
}

/**
 * Get the age of a token in milliseconds (from key rotation context)
 * Useful for determining if a token needs rotation
 * Same as getTokenAge from ttl.ts but exported here for convenience
 *
 * @param token - The token to check
 * @returns The age of the token in milliseconds
 *
 * @example
 * ```ts
 * const age = await getRotationAge(token);
 * const hours = age / (1000 * 60 * 60);
 * if (hours > 24) {
 *   // Rotate token older than 24 hours
 *   const newToken = await rotateKey(token, 'old-secret', 'new-secret');
 * }
 * ```
 */
export function getRotationAge(token: string): number {
  const meta = extractMetadata(token);

  if (!meta.timestamp) {
    throw new Error("Token does not contain a timestamp");
  }

  return Date.now() - meta.timestamp;
}

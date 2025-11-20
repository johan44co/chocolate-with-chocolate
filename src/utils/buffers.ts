/**
 * Cross-platform Uint8Array utilities
 * Works consistently in both Node.js and browser environments
 */

let nodeCrypto: any = null;

// Try to load Node.js crypto module for environments without globalThis.crypto
try {
  // Use dynamic require-like approach for Node.js
  if (typeof globalThis.crypto === "undefined" && typeof module !== "undefined") {
    nodeCrypto = require("crypto");
  }
} catch {
  // If require fails, we'll fall back to globalThis.crypto or fail with a clear error
}

/**
 * Convert a string to Uint8Array using UTF-8 encoding
 * @param str - String to convert
 * @returns UTF-8 encoded bytes
 */
export function stringToBytes(str: string): Uint8Array {
  // Use TextEncoder which is available in both Node.js and browsers
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert Uint8Array to string using UTF-8 decoding
 * @param bytes - Bytes to convert
 * @returns Decoded UTF-8 string
 */
export function bytesToString(bytes: Uint8Array): string {
  // Use TextDecoder which is available in both Node.js and browsers
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Concatenate multiple Uint8Arrays into a single array
 * @param arrays - Arrays to concatenate
 * @returns Combined array
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

/**
 * Compare two Uint8Arrays for equality
 * @param a - First array
 * @param b - Second array
 * @returns true if arrays are equal, false otherwise
 */
export function areEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Create a copy of a Uint8Array
 * @param bytes - Array to copy
 * @returns New array with copied data
 */
export function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

/**
 * Generate random bytes using cryptographically secure random source
 * @param length - Number of bytes to generate
 * @returns Random bytes
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  // Browser environment or Node.js with globalThis.crypto
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  // Node.js 18+ without globalThis.crypto
  if (nodeCrypto && typeof nodeCrypto.getRandomValues === "function") {
    nodeCrypto.getRandomValues(bytes);
    return bytes;
  }

  // Fallback for older Node.js versions
  if (nodeCrypto && typeof nodeCrypto.randomBytes === "function") {
    const randomBuffer = nodeCrypto.randomBytes(length);
    bytes.set(randomBuffer);
    return bytes;
  }

  // This should never happen in modern environments
  throw new Error("No secure random number generator available");
}

/**
 * Convert a hex string to Uint8Array
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Decoded bytes
 * @throws {Error} If the hex string is invalid
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

  // Validate hex string
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error("Invalid hex string");
  }

  // Hex string must have even length
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Bytes to convert
 * @param prefix - Whether to include 0x prefix (default: false)
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array, prefix = false): string {
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return prefix ? `0x${hex}` : hex;
}

/**
 * Slice a Uint8Array (similar to Array.slice)
 * @param bytes - Array to slice
 * @param start - Start index (inclusive)
 * @param end - End index (exclusive)
 * @returns Sliced array
 */
export function sliceBytes(bytes: Uint8Array, start: number, end?: number): Uint8Array {
  return bytes.slice(start, end);
}

/**
 * Check if the input is a valid Uint8Array
 * @param value - Value to check
 * @returns true if value is Uint8Array, false otherwise
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

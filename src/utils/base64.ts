/**
 * URL-safe Base64 encoding/decoding utilities
 * Works in both Node.js and browser environments
 */

/**
 * Encode a Uint8Array to URL-safe Base64 string
 * Replaces + with -, / with _, and removes padding =
 * @param data - Binary data to encode
 * @returns URL-safe Base64 encoded string
 */
export function encodeBase64Url(data: Uint8Array): string {
  // Node.js environment
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  // Browser environment
  const binary = String.fromCharCode(...data);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decode a URL-safe Base64 string to Uint8Array
 * Handles both standard and URL-safe Base64
 * @param str - URL-safe Base64 encoded string
 * @returns Decoded binary data
 * @throws {Error} If the input is not valid Base64
 */
export function decodeBase64Url(str: string): Uint8Array {
  if (str === "") {
    return new Uint8Array([]);
  }

  // Normalize URL-safe Base64 to standard Base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding > 0) {
    base64 += "=".repeat(4 - padding);
  }

  try {
    // Node.js environment
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(base64, "base64"));
    }

    // Browser environment
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(
      `Invalid Base64 string: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }
}

/**
 * Check if a string is valid URL-safe Base64
 * @param str - String to validate
 * @returns true if valid, false otherwise
 */
export function isValidBase64Url(str: string): boolean {
  // Empty string is valid
  if (str === "") {
    return true;
  }

  // URL-safe Base64 should only contain: A-Z, a-z, 0-9, -, _
  const urlSafeBase64Regex = /^[A-Za-z0-9_-]+$/;
  if (!urlSafeBase64Regex.test(str)) {
    return false;
  }

  try {
    decodeBase64Url(str);
    return true;
  } catch {
    return false;
  }
}

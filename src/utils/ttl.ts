/**
 * TTL (Time-To-Live) Utilities
 * Provides functionality for validating token expiration
 */

import { extractMetadata } from "../cwc.js";
import type { TokenMetadata } from "../types.js";

/**
 * Check if a token has expired based on its TTL
 *
 * @param token - The token to check
 * @returns true if token is expired, false otherwise
 * @throws {Error} If token has no timestamp or TTL
 *
 * @example
 * ```ts
 * const token = await encode(data, 'secret', { includeTimestamp: true, ttl: 3600 });
 * if (isExpired(token)) {
 *   console.log('Token has expired');
 * }
 * ```
 */
export function isExpired(token: string): boolean {
  const metadata = extractMetadata(token);
  return isMetadataExpired(metadata);
}

/**
 * Check if token metadata indicates expiration
 *
 * @param metadata - Token metadata
 * @returns true if expired, false otherwise
 */
export function isMetadataExpired(metadata: TokenMetadata): boolean {
  if (!metadata.timestamp || !metadata.ttl) {
    return false; // No expiration set
  }

  const expiresAt = metadata.timestamp + metadata.ttl * 1000;
  return Date.now() >= expiresAt;
}

/**
 * Get the expiration timestamp of a token
 *
 * @param token - The token to check
 * @returns Expiration timestamp in milliseconds, or null if no TTL set
 *
 * @example
 * ```ts
 * const expiresAt = getExpirationTime(token);
 * if (expiresAt) {
 *   console.log(`Token expires at ${new Date(expiresAt)}`);
 * }
 * ```
 */
export function getExpirationTime(token: string): number | null {
  const metadata = extractMetadata(token);
  return getMetadataExpirationTime(metadata);
}

/**
 * Get expiration time from metadata
 *
 * @param metadata - Token metadata
 * @returns Expiration timestamp in milliseconds, or null if no TTL set
 */
export function getMetadataExpirationTime(metadata: TokenMetadata): number | null {
  if (!metadata.timestamp || !metadata.ttl) {
    return null;
  }

  return metadata.timestamp + metadata.ttl * 1000;
}

/**
 * Get the remaining time before a token expires
 *
 * @param token - The token to check
 * @returns Remaining time in milliseconds, or null if no TTL set
 * Returns 0 if already expired
 *
 * @example
 * ```ts
 * const remaining = getRemainingTime(token);
 * if (remaining) {
 *   console.log(`Token expires in ${remaining / 1000} seconds`);
 * }
 * ```
 */
export function getRemainingTime(token: string): number | null {
  const expiresAt = getExpirationTime(token);
  if (expiresAt === null) {
    return null;
  }

  const remaining = expiresAt - Date.now();
  return Math.max(0, remaining);
}

/**
 * Check if a token will expire within the specified duration
 *
 * @param token - The token to check
 * @param durationMs - Duration in milliseconds
 * @returns true if token expires within duration, false otherwise
 *
 * @example
 * ```ts
 * // Check if token expires within 5 minutes
 * if (willExpireSoon(token, 5 * 60 * 1000)) {
 *   console.log('Token will expire soon, consider refreshing');
 * }
 * ```
 */
export function willExpireSoon(token: string, durationMs: number): boolean {
  const remaining = getRemainingTime(token);
  if (remaining === null) {
    return false; // No expiration set
  }

  return remaining <= durationMs;
}

/**
 * Validate that a token is not expired
 *
 * @param token - The token to validate
 * @throws {Error} If token is expired
 *
 * @example
 * ```ts
 * try {
 *   validateNotExpired(token);
 *   const data = await decode(token, 'secret');
 * } catch (error) {
 *   console.error('Token has expired');
 * }
 * ```
 */
export function validateNotExpired(token: string): void {
  if (isExpired(token)) {
    const expiresAt = getExpirationTime(token);
    const expiredAgo = expiresAt ? Date.now() - expiresAt : 0;
    const seconds = Math.floor(expiredAgo / 1000);
    throw new Error(`Token expired ${String(seconds)} second${seconds !== 1 ? "s" : ""} ago`);
  }
}

/**
 * Get token age in milliseconds
 *
 * @param token - The token to check
 * @returns Age in milliseconds
 * @throws {Error} If token has no timestamp
 *
 * @example
 * ```ts
 * const age = getTokenAge(token);
 * console.log(`Token is ${age / 1000} seconds old`);
 * ```
 */
export function getTokenAge(token: string): number {
  const metadata = extractMetadata(token);

  if (!metadata.timestamp) {
    throw new Error("Token does not contain a timestamp");
  }

  return Date.now() - metadata.timestamp;
}

/**
 * Calculate the percentage of TTL that has elapsed
 *
 * @param token - The token to check
 * @returns Percentage (0-100) of TTL elapsed, or null if no TTL set
 *
 * @example
 * ```ts
 * const elapsed = getTTLPercentageElapsed(token);
 * if (elapsed && elapsed > 80) {
 *   console.log('Token is 80% through its lifetime');
 * }
 * ```
 */
export function getTTLPercentageElapsed(token: string): number | null {
  const metadata = extractMetadata(token);

  if (!metadata.timestamp || !metadata.ttl) {
    return null;
  }

  const age = Date.now() - metadata.timestamp;
  const ttlMs = metadata.ttl * 1000;
  const percentage = (age / ttlMs) * 100;

  return Math.min(100, Math.max(0, percentage));
}

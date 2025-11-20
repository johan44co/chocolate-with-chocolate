/**
 * Version validation and migration support
 * Handles version checking and future migration paths
 */

import type { Version, TokenMetadata } from "../types.js";

/**
 * Current supported CWC version
 */
export const CURRENT_VERSION: Version = 1;

/**
 * All supported versions (for backward compatibility)
 */
export const SUPPORTED_VERSIONS: readonly Version[] = [1] as const;

/**
 * Validate that a version is supported
 * @param version - Version to validate
 * @returns true if version is supported
 */
export function isSupportedVersion(version: number): version is Version {
  return SUPPORTED_VERSIONS.includes(version as Version);
}

/**
 * Validate metadata version
 * @param metadata - Token metadata to validate
 * @throws {Error} If version is not supported
 */
export function validateVersion(metadata: TokenMetadata): void {
  if (!isSupportedVersion(metadata.version)) {
    throw new Error(
      `Unsupported token version: ${metadata.version as unknown as string}. Supported versions: ${SUPPORTED_VERSIONS.join(", ") as unknown as string}`
    );
  }
}

/**
 * Check if a token version is current
 * @param version - Version to check
 * @returns true if version is current, false if outdated
 */
export function isCurrentVersion(version: Version): boolean {
  return version === CURRENT_VERSION;
}

/**
 * Check if a token needs migration
 * @param metadata - Token metadata
 * @returns true if token should be migrated to current version
 */
export function needsMigration(metadata: TokenMetadata): boolean {
  return !isCurrentVersion(metadata.version);
}

/**
 * Get migration path from one version to another
 * @param fromVersion - Source version
 * @param toVersion - Target version (default: current)
 * @returns Array of versions to migrate through
 * @throws {Error} If migration path is not available
 */
export function getMigrationPath(
  fromVersion: Version,
  toVersion: Version = CURRENT_VERSION
): Version[] {
  if (!isSupportedVersion(fromVersion)) {
    throw new Error(`Unsupported source version: ${fromVersion as unknown as string}`);
  }

  if (!isSupportedVersion(toVersion)) {
    throw new Error(`Unsupported target version: ${toVersion as unknown as string}`);
  }

  // Same version, no migration needed
  if (fromVersion === toVersion) {
    return [];
  }

  // For now, we only have v1, so no migration paths exist yet
  // Future: This would return intermediate versions for multi-step migrations
  // e.g., [1, 2, 3] for migrating from v1 to v3
  throw new Error(
    `No migration path available from version ${fromVersion as unknown as string} to ${toVersion as unknown as string}`
  );
}

/**
 * Get version compatibility information
 * @param version - Version to check
 * @returns Compatibility info
 */
export function getVersionInfo(version: Version): {
  version: Version;
  isCurrent: boolean;
  isSupported: boolean;
  needsMigration: boolean;
} {
  return {
    version,
    isCurrent: isCurrentVersion(version),
    isSupported: isSupportedVersion(version),
    needsMigration: version !== CURRENT_VERSION && isSupportedVersion(version),
  };
}

/**
 * Format version as string
 * @param version - Version number
 * @returns Formatted version string (e.g., "v1")
 */
export function formatVersion(version: Version): string {
  return `v${version as unknown as string}`;
}

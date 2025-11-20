/**
 * Tests for versioning utility functions
 */

import { describe, it, expect } from "@jest/globals";
import {
  CURRENT_VERSION,
  SUPPORTED_VERSIONS,
  isSupportedVersion,
  validateVersion,
  isCurrentVersion,
  needsMigration,
  getMigrationPath,
  getVersionInfo,
  formatVersion,
} from "../src/utils/versioning.js";
import type { TokenMetadata } from "../src/types.js";

describe("versioning utilities", () => {
  describe("constants", () => {
    it("should have current version defined", () => {
      expect(CURRENT_VERSION).toBe(1);
    });

    it("should have supported versions defined", () => {
      expect(SUPPORTED_VERSIONS).toContain(1);
      expect(SUPPORTED_VERSIONS.length).toBeGreaterThan(0);
    });
  });

  describe("isSupportedVersion", () => {
    it("should return true for version 1", () => {
      expect(isSupportedVersion(1)).toBe(true);
    });

    it("should return false for unsupported versions", () => {
      expect(isSupportedVersion(0)).toBe(false);
      expect(isSupportedVersion(2)).toBe(false);
      expect(isSupportedVersion(99)).toBe(false);
      expect(isSupportedVersion(-1)).toBe(false);
    });
  });

  describe("validateVersion", () => {
    it("should not throw for supported version", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
      };
      expect(() => validateVersion(metadata)).not.toThrow();
    });

    it("should throw for unsupported version", () => {
      const metadata: TokenMetadata = {
        version: 99 as any,
        algorithm: "aes-gcm-256",
        compression: "brotli",
      };
      expect(() => validateVersion(metadata)).toThrow("Unsupported token version");
    });
  });

  describe("isCurrentVersion", () => {
    it("should return true for current version", () => {
      expect(isCurrentVersion(1)).toBe(true);
    });

    it("should return false for other versions", () => {
      // This test will need updating when v2 is added
      expect(isCurrentVersion(2 as any)).toBe(false);
    });
  });

  describe("needsMigration", () => {
    it("should return false for current version", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
      };
      expect(needsMigration(metadata)).toBe(false);
    });

    it("should return true for old supported versions", () => {
      // When v2 is released, v1 tokens will need migration
      // For now, this will always be false since we only have v1
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
      };
      expect(needsMigration(metadata)).toBe(false);
    });
  });

  describe("getMigrationPath", () => {
    it("should return empty array for same version", () => {
      expect(getMigrationPath(1, 1)).toEqual([]);
    });

    it("should throw for unsupported source version", () => {
      expect(() => getMigrationPath(99 as any, 1)).toThrow("Unsupported source version");
    });

    it("should throw for unsupported target version", () => {
      expect(() => getMigrationPath(1, 99 as any)).toThrow("Unsupported target version");
    });

    it("should throw when no migration path exists", () => {
      // Since we only have v1, any migration would fail
      // When v2 is added, this test should be updated
      expect(() => getMigrationPath(1, 2 as any)).toThrow("Unsupported target version");
    });
  });

  describe("getVersionInfo", () => {
    it("should return correct info for current version", () => {
      const info = getVersionInfo(1);
      expect(info.version).toBe(1);
      expect(info.isCurrent).toBe(true);
      expect(info.isSupported).toBe(true);
      expect(info.needsMigration).toBe(false);
    });

    it("should return correct info for unsupported version", () => {
      const info = getVersionInfo(99 as any);
      expect(info.version).toBe(99);
      expect(info.isCurrent).toBe(false);
      expect(info.isSupported).toBe(false);
      expect(info.needsMigration).toBe(false);
    });
  });

  describe("formatVersion", () => {
    it("should format version correctly", () => {
      expect(formatVersion(1)).toBe("v1");
    });

    it("should handle different versions", () => {
      expect(formatVersion(2 as any)).toBe("v2");
      expect(formatVersion(10 as any)).toBe("v10");
    });
  });
});

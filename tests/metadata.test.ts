/**
 * Tests for metadata utility functions
 */

import { describe, it, expect } from "@jest/globals";
import {
  packMetadata,
  unpackMetadata,
  getMetadataSize,
  createDefaultMetadata,
} from "../src/utils/metadata.js";
import type { TokenMetadata } from "../src/types.js";

describe("metadata utilities", () => {
  describe("packMetadata / unpackMetadata", () => {
    it("should pack and unpack basic metadata", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
      };

      const packed = packMetadata(metadata);
      expect(packed.length).toBe(4); // Header only

      const unpacked = unpackMetadata(packed);
      expect(unpacked).toEqual(metadata);
    });

    it("should handle metadata with timestamp", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
        timestamp: Date.now(),
      };

      const packed = packMetadata(metadata);
      expect(packed.length).toBe(8); // Header + timestamp

      const unpacked = unpackMetadata(packed);
      // Timestamp is stored as seconds, so allow 1000ms tolerance
      expect(Math.abs((unpacked.timestamp || 0) - (metadata.timestamp || 0))).toBeLessThan(1000);
      expect(unpacked.version).toBe(metadata.version);
      expect(unpacked.algorithm).toBe(metadata.algorithm);
      expect(unpacked.compression).toBe(metadata.compression);
    });

    it("should handle metadata with TTL", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
        ttl: 3600,
      };

      const packed = packMetadata(metadata);
      expect(packed.length).toBe(8); // Header + TTL

      const unpacked = unpackMetadata(packed);
      expect(unpacked).toEqual(metadata);
    });

    it("should handle metadata with both timestamp and TTL", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
        timestamp: Date.now(),
        ttl: 7200,
      };

      const packed = packMetadata(metadata);
      expect(packed.length).toBe(12); // Header + timestamp + TTL

      const unpacked = unpackMetadata(packed);
      expect(Math.abs((unpacked.timestamp || 0) - (metadata.timestamp || 0))).toBeLessThan(1000);
      expect(unpacked.ttl).toBe(metadata.ttl);
      expect(unpacked.version).toBe(metadata.version);
      expect(unpacked.algorithm).toBe(metadata.algorithm);
      expect(unpacked.compression).toBe(metadata.compression);
    });

    it("should handle different compression algorithms", () => {
      const compressions: Array<"brotli" | "lz-string" | "zlib" | "none"> = [
        "none",
        "brotli",
        "lz-string",
        "zlib",
      ];

      for (const compression of compressions) {
        const metadata: TokenMetadata = {
          version: 1,
          algorithm: "aes-gcm-256",
          compression,
        };

        const packed = packMetadata(metadata);
        const unpacked = unpackMetadata(packed);
        expect(unpacked.compression).toBe(compression);
      }
    });

    it("should throw on unsupported algorithm", () => {
      const metadata = {
        version: 1 as const,
        algorithm: "invalid-algo" as any,
        compression: "brotli" as const,
      };

      expect(() => packMetadata(metadata)).toThrow("Unsupported algorithm");
    });

    it("should throw on unsupported compression", () => {
      const metadata = {
        version: 1 as const,
        algorithm: "aes-gcm-256" as const,
        compression: "invalid-compression" as any,
      };

      expect(() => packMetadata(metadata)).toThrow("Unsupported compression");
    });

    it("should throw on invalid packed data (too short)", () => {
      const invalidData = new Uint8Array([1, 2]); // Only 2 bytes
      expect(() => unpackMetadata(invalidData)).toThrow("too short");
    });

    it("should throw on unknown algorithm ID", () => {
      const invalidData = new Uint8Array([1, 99, 1, 0]); // Algorithm ID 99
      expect(() => unpackMetadata(invalidData)).toThrow("Unknown algorithm ID");
    });

    it("should throw on unknown compression ID", () => {
      const invalidData = new Uint8Array([1, 1, 99, 0]); // Compression ID 99
      expect(() => unpackMetadata(invalidData)).toThrow("Unknown compression ID");
    });

    it("should throw on incomplete timestamp", () => {
      const invalidData = new Uint8Array([1, 1, 1, 0b00000001, 1, 2]); // Has timestamp flag but only 2 bytes
      expect(() => unpackMetadata(invalidData)).toThrow("missing timestamp bytes");
    });

    it("should throw on incomplete TTL", () => {
      const invalidData = new Uint8Array([1, 1, 1, 0b00000010, 1, 2]); // Has TTL flag but only 2 bytes
      expect(() => unpackMetadata(invalidData)).toThrow("missing TTL bytes");
    });
  });

  describe("getMetadataSize", () => {
    it("should return correct size for basic metadata", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
      };
      expect(getMetadataSize(metadata)).toBe(4);
    });

    it("should return correct size with timestamp", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
        timestamp: Date.now(),
      };
      expect(getMetadataSize(metadata)).toBe(8);
    });

    it("should return correct size with TTL", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
        ttl: 3600,
      };
      expect(getMetadataSize(metadata)).toBe(8);
    });

    it("should return correct size with both timestamp and TTL", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
        timestamp: Date.now(),
        ttl: 3600,
      };
      expect(getMetadataSize(metadata)).toBe(12);
    });

    it("should match actual packed size", () => {
      const metadata: TokenMetadata = {
        version: 1,
        algorithm: "aes-gcm-256",
        compression: "brotli",
        timestamp: Date.now(),
        ttl: 7200,
      };

      const expectedSize = getMetadataSize(metadata);
      const packed = packMetadata(metadata);
      expect(packed.length).toBe(expectedSize);
    });
  });

  describe("createDefaultMetadata", () => {
    it("should create basic default metadata", () => {
      const metadata = createDefaultMetadata();
      expect(metadata.version).toBe(1);
      expect(metadata.algorithm).toBe("aes-gcm-256");
      expect(metadata.compression).toBe("brotli");
      expect(metadata.timestamp).toBeUndefined();
      expect(metadata.ttl).toBeUndefined();
    });

    it("should use custom compression", () => {
      const metadata = createDefaultMetadata("zlib");
      expect(metadata.compression).toBe("zlib");
    });

    it("should include timestamp when requested", () => {
      const before = Date.now();
      const metadata = createDefaultMetadata("brotli", "aes-gcm-256", true);
      const after = Date.now();

      expect(metadata.timestamp).toBeDefined();
      expect(metadata.timestamp!).toBeGreaterThanOrEqual(before);
      expect(metadata.timestamp!).toBeLessThanOrEqual(after);
    });

    it("should include TTL when provided", () => {
      const metadata = createDefaultMetadata("brotli", "aes-gcm-256", false, 3600);
      expect(metadata.ttl).toBe(3600);
    });

    it("should include both timestamp and TTL", () => {
      const metadata = createDefaultMetadata("brotli", "aes-gcm-256", true, 7200);
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.ttl).toBe(7200);
    });
  });
});

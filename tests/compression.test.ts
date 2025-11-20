/**
 * Tests for compression module
 */

import { describe, it, expect } from "@jest/globals";
import {
  compress,
  decompress,
  getCompressor,
  isCompressionAvailable,
  getDefaultCompression,
  getCompressionRatio,
} from "../src/core/compression.js";
import { stringToBytes, bytesToString, areEqual } from "../src/utils/buffers.js";

describe("compression module", () => {
  describe("getCompressor", () => {
    it("should return compressor for none", () => {
      const compressor = getCompressor("none");
      expect(compressor).toBeDefined();
    });

    it("should return compressor for lz-string", () => {
      const compressor = getCompressor("lz-string");
      expect(compressor).toBeDefined();
    });

    it("should return compressor for brotli", () => {
      const compressor = getCompressor("brotli");
      expect(compressor).toBeDefined();
    });

    it("should return compressor for zlib", () => {
      const compressor = getCompressor("zlib");
      expect(compressor).toBeDefined();
    });

    it("should throw on unsupported algorithm", () => {
      expect(() => getCompressor("invalid" as any)).toThrow("Unsupported compression");
    });
  });

  describe("none compression", () => {
    it("should pass through data unchanged", async () => {
      const data = stringToBytes("Hello, World!");
      const compressed = await compress(data, "none");
      expect(compressed).toEqual(data);
    });

    it("should decompress to original", async () => {
      const data = stringToBytes("test data");
      const compressed = await compress(data, "none");
      const decompressed = await decompress(compressed, "none");
      expect(decompressed).toEqual(data);
    });

    it("should handle empty data", async () => {
      const data = new Uint8Array([]);
      const compressed = await compress(data, "none");
      const decompressed = await decompress(compressed, "none");
      expect(decompressed).toEqual(data);
    });

    it("should handle binary data", async () => {
      const data = new Uint8Array([0, 1, 2, 255, 254, 253]);
      const compressed = await compress(data, "none");
      const decompressed = await decompress(compressed, "none");
      expect(decompressed).toEqual(data);
    });
  });

  describe("lz-string compression", () => {
    it("should compress and decompress simple text", async () => {
      const text = "Hello, World!";
      const data = stringToBytes(text);

      const compressed = await compress(data, "lz-string");
      const decompressed = await decompress(compressed, "lz-string");

      expect(bytesToString(decompressed)).toBe(text);
    });

    it("should actually compress data", async () => {
      // Repetitive data compresses well
      const text = "a".repeat(1000);
      const data = stringToBytes(text);

      const compressed = await compress(data, "lz-string");

      expect(compressed.length).toBeLessThan(data.length);
    });

    it("should handle UTF-8 text", async () => {
      const text = "Hello 世界 🌍 Привет";
      const data = stringToBytes(text);

      const compressed = await compress(data, "lz-string");
      const decompressed = await decompress(compressed, "lz-string");

      expect(bytesToString(decompressed)).toBe(text);
    });

    it("should handle JSON data", async () => {
      const obj = { name: "Alice", age: 30, active: true, data: [1, 2, 3] };
      const data = stringToBytes(JSON.stringify(obj));

      const compressed = await compress(data, "lz-string");
      const decompressed = await decompress(compressed, "lz-string");

      const result = JSON.parse(bytesToString(decompressed));
      expect(result).toEqual(obj);
    });

    it("should handle empty data", async () => {
      const data = new Uint8Array([]);
      const compressed = await compress(data, "lz-string");
      const decompressed = await decompress(compressed, "lz-string");
      expect(decompressed.length).toBe(0);
    });

    it("should handle large data", async () => {
      const data = stringToBytes("x".repeat(10000));
      const compressed = await compress(data, "lz-string");
      const decompressed = await decompress(compressed, "lz-string");
      expect(bytesToString(decompressed)).toBe("x".repeat(10000));
    });

    it("should be deterministic", async () => {
      const data = stringToBytes("test data");
      const compressed1 = await compress(data, "lz-string");
      const compressed2 = await compress(data, "lz-string");
      expect(areEqual(compressed1, compressed2)).toBe(true);
    });
  });

  describe("brotli compression", () => {
    it("should compress and decompress text", async () => {
      const text = "Hello, World!";
      const data = stringToBytes(text);

      const compressed = await compress(data, "brotli");
      const decompressed = await decompress(compressed, "brotli");

      expect(bytesToString(decompressed)).toBe(text);
    });

    it("should compress repetitive data well", async () => {
      const text = "a".repeat(1000);
      const data = stringToBytes(text);

      const compressed = await compress(data, "brotli");

      // Brotli should compress this very well
      expect(compressed.length).toBeLessThan(data.length * 0.1);
    });

    it("should handle UTF-8 text", async () => {
      const text = "Testing 日本語 emoji 🎉";
      const data = stringToBytes(text);

      const compressed = await compress(data, "brotli");
      const decompressed = await decompress(compressed, "brotli");

      expect(bytesToString(decompressed)).toBe(text);
    });

    it("should handle JSON data", async () => {
      const obj = {
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        metadata: { version: 1 },
      };
      const data = stringToBytes(JSON.stringify(obj));

      const compressed = await compress(data, "brotli");
      const decompressed = await decompress(compressed, "brotli");

      const result = JSON.parse(bytesToString(decompressed));
      expect(result).toEqual(obj);
    });

    it("should handle large data", async () => {
      const data = stringToBytes("y".repeat(50000));
      const compressed = await compress(data, "brotli");
      const decompressed = await decompress(compressed, "brotli");
      expect(bytesToString(decompressed)).toBe("y".repeat(50000));
    });
  });

  describe("zlib compression", () => {
    it("should compress and decompress text", async () => {
      const text = "Hello, World!";
      const data = stringToBytes(text);

      const compressed = await compress(data, "zlib");
      const decompressed = await decompress(compressed, "zlib");

      expect(bytesToString(decompressed)).toBe(text);
    });

    it("should compress repetitive data", async () => {
      const text = "z".repeat(1000);
      const data = stringToBytes(text);

      const compressed = await compress(data, "zlib");

      expect(compressed.length).toBeLessThan(data.length * 0.1);
    });

    it("should handle UTF-8 text", async () => {
      const text = "Zlib test 中文 🚀";
      const data = stringToBytes(text);

      const compressed = await compress(data, "zlib");
      const decompressed = await decompress(compressed, "zlib");

      expect(bytesToString(decompressed)).toBe(text);
    });

    it("should handle JSON data", async () => {
      const obj = { key: "value", numbers: [1, 2, 3] };
      const data = stringToBytes(JSON.stringify(obj));

      const compressed = await compress(data, "zlib");
      const decompressed = await decompress(compressed, "zlib");

      const result = JSON.parse(bytesToString(decompressed));
      expect(result).toEqual(obj);
    });
  });

  describe("isCompressionAvailable", () => {
    it("should report none as available", () => {
      expect(isCompressionAvailable("none")).toBe(true);
    });

    it("should report lz-string as available", () => {
      expect(isCompressionAvailable("lz-string")).toBe(true);
    });

    it("should report brotli availability correctly", () => {
      // In Node.js, brotli should be available
      expect(isCompressionAvailable("brotli")).toBe(true);
    });

    it("should report zlib availability correctly", () => {
      // In Node.js, zlib should be available
      expect(isCompressionAvailable("zlib")).toBe(true);
    });
  });

  describe("getDefaultCompression", () => {
    it("should return a valid algorithm", () => {
      const algorithm = getDefaultCompression();
      expect(["none", "lz-string", "brotli", "zlib"]).toContain(algorithm);
    });

    it("should return brotli in Node.js", () => {
      const algorithm = getDefaultCompression();
      expect(algorithm).toBe("brotli");
    });
  });

  describe("getCompressionRatio", () => {
    it("should calculate compression ratio", () => {
      expect(getCompressionRatio(1000, 500)).toBe(2);
      expect(getCompressionRatio(1000, 250)).toBe(4);
      expect(getCompressionRatio(1000, 1000)).toBe(1);
    });

    it("should handle zero compressed size", () => {
      expect(getCompressionRatio(1000, 0)).toBe(0);
    });

    it("should handle edge cases", () => {
      expect(getCompressionRatio(0, 0)).toBe(0);
      expect(getCompressionRatio(100, 100)).toBe(1);
    });
  });

  describe("compression integration", () => {
    it("should compress before encryption (data flow test)", async () => {
      // Use highly repetitive data that compresses well
      const plaintext = "a".repeat(1000);
      const data = stringToBytes(plaintext);

      // Compress first
      const compressed = await compress(data, "lz-string");

      // Verify compression happened
      expect(compressed.length).toBeLessThan(data.length);

      // Then decompress
      const decompressed = await decompress(compressed, "lz-string");

      // Verify data integrity
      expect(bytesToString(decompressed)).toBe(plaintext);
    });

    it("should handle different algorithms in sequence", async () => {
      const text = "Test data for compression";
      const data = stringToBytes(text);

      // Test each algorithm
      const algorithms: Array<"none" | "lz-string" | "brotli" | "zlib"> = [
        "none",
        "lz-string",
        "brotli",
        "zlib",
      ];

      for (const algorithm of algorithms) {
        const compressed = await compress(data, algorithm);
        const decompressed = await decompress(compressed, algorithm);
        expect(bytesToString(decompressed)).toBe(text);
      }
    });

    it("should verify compression actually reduces size", async () => {
      // Create highly compressible data
      const text = JSON.stringify({
        users: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            name: `User${i}`,
            email: `user${i}@example.com`,
          })),
      });
      const data = stringToBytes(text);

      const compressedLZ = await compress(data, "lz-string");
      const compressedBrotli = await compress(data, "brotli");
      const compressedZlib = await compress(data, "zlib");

      // All should compress significantly
      expect(compressedLZ.length).toBeLessThan(data.length * 0.5);
      expect(compressedBrotli.length).toBeLessThan(data.length * 0.5);
      expect(compressedZlib.length).toBeLessThan(data.length * 0.5);
    });
  });
});

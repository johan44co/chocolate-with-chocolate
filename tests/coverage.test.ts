/**
 * Additional Coverage Tests
 * Tests to increase code coverage for edge cases and error paths
 */

import { encode, decode } from "../src/cwc.js";
import { compress, decompress } from "../src/core/compression.js";
import { randomBytes } from "../src/utils/buffers.js";
import type { CompressionAlgorithm } from "../src/types.js";

describe("Coverage Tests", () => {
  describe("Compression Edge Cases", () => {
    test("should handle all compression algorithms", async () => {
      const data = { test: "compression", value: "a".repeat(1000) };
      const secret = "test-secret";

      const algorithms: CompressionAlgorithm[] = ["brotli", "lz-string", "zlib", "none"];

      for (const algo of algorithms) {
        const token = await encode(data, secret, { compression: algo });
        const decoded = await decode(token, secret);
        expect(decoded).toEqual(data);
      }
    });

    test("should handle compression of empty data", async () => {
      const data = new Uint8Array(0);

      const brotli = await compress(data, "brotli");
      const lz = await compress(data, "lz-string");
      const zlib = await compress(data, "zlib");
      const none = await compress(data, "none");

      expect(brotli).toBeTruthy();
      expect(lz).toBeTruthy();
      expect(zlib).toBeTruthy();
      expect(none).toBeTruthy();

      // Decompress
      await decompress(brotli, "brotli");
      await decompress(lz, "lz-string");
      await decompress(zlib, "zlib");
      await decompress(none, "none");
    });

    test("should handle compression of very small data", async () => {
      const data = new Uint8Array([1, 2, 3]);

      const compressed = await compress(data, "brotli");
      const decompressed = await decompress(compressed, "brotli");

      expect(Array.from(decompressed)).toEqual([1, 2, 3]);
    });

    test("should handle compression of highly repetitive data", async () => {
      const data = { text: "A".repeat(10000) };
      const secret = "test-secret";

      const token = await encode(data, secret, { compression: "brotli" });
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });

    test("should handle compression of random data", async () => {
      const randomData = {
        random: Array(100)
          .fill(0)
          .map(() => Math.random()),
      };
      const secret = "test-secret";

      const token = await encode(randomData, secret, { compression: "brotli" });
      const decoded = await decode(token, secret);

      expect(JSON.stringify(decoded)).toBe(JSON.stringify(randomData));
    });
  });

  describe("Error Path Coverage", () => {
    test("should handle invalid compression algorithm gracefully", async () => {
      const data = { test: "invalid-algo" };
      const secret = "test-secret";

      // @ts-expect-error Testing invalid compression
      await expect(encode(data, secret, { compression: "invalid" })).rejects.toThrow();
    });

    test("should handle corrupted compressed data", async () => {
      // This tests error handling in decompress
      const corrupted = new Uint8Array([0xff, 0xff, 0xff, 0xff]);

      await expect(decompress(corrupted, "brotli")).rejects.toThrow();
      await expect(decompress(corrupted, "lz-string")).rejects.toThrow();
      await expect(decompress(corrupted, "zlib")).rejects.toThrow();
    });

    test("should handle invalid token structure", async () => {
      const secret = "test-secret";

      // Too short token
      await expect(decode("abc", secret)).rejects.toThrow();

      // Invalid base64url
      await expect(decode("!!!", secret)).rejects.toThrow();

      // Valid base64url but invalid structure
      const shortToken = Buffer.from([1, 2, 3]).toString("base64url");
      await expect(decode(shortToken, secret)).rejects.toThrow();
    });
  });

  describe("Crypto Edge Cases", () => {
    test("should handle Uint8Array secrets", async () => {
      const data = { test: "uint8array-secret" };
      const secret = randomBytes(32);

      const token = await encode(data, secret);
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });

    test("should handle different Uint8Array secret sizes", async () => {
      const data = { test: "secret-sizes" };

      // 32-byte key (standard)
      const key32 = randomBytes(32);
      const token32 = await encode(data, key32);
      const decoded32 = await decode(token32, key32);
      expect(decoded32).toEqual(data);

      // Different size should fail
      const key16 = randomBytes(16);
      await expect(encode(data, key16)).rejects.toThrow();
    });

    test("should handle very long string secrets", async () => {
      const data = { test: "long-secret" };
      const longSecret = "a".repeat(10000);

      const token = await encode(data, longSecret);
      const decoded = await decode(token, longSecret);

      expect(decoded).toEqual(data);
    });

    test("should handle unicode secrets", async () => {
      const data = { test: "unicode" };
      const unicodeSecret = "密码🔐パスワード";

      const token = await encode(data, unicodeSecret);
      const decoded = await decode(token, unicodeSecret);

      expect(decoded).toEqual(data);
    });
  });

  describe("Data Type Coverage", () => {
    test("should handle all JSON-serializable types", async () => {
      const secret = "test-secret";

      const testCases = [
        null,
        true,
        false,
        0,
        -1,
        3.14159,
        Number.MAX_SAFE_INTEGER,
        "",
        "string",
        "unicode: 日本語",
        [],
        [1, 2, 3],
        {},
        { nested: { deep: { value: "test" } } },
        { array: [1, 2, { nested: true }] },
      ];

      for (const testData of testCases) {
        const token = await encode(testData, secret);
        const decoded = await decode(token, secret);
        expect(decoded).toEqual(testData);
      }
    });

    test("should handle large numbers", async () => {
      const data = {
        maxInt: Number.MAX_SAFE_INTEGER,
        minInt: Number.MIN_SAFE_INTEGER,
        maxValue: Number.MAX_VALUE,
        minValue: Number.MIN_VALUE,
        epsilon: Number.EPSILON,
      };

      const secret = "test-secret";
      const token = await encode(data, secret);
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });

    test("should handle arrays with many elements", async () => {
      const data = {
        items: Array(1000)
          .fill(0)
          .map((_, i) => i),
      };
      const secret = "test-secret";

      const token = await encode(data, secret);
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });

    test("should handle objects with many keys", async () => {
      const data: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        data[`key${i}`] = i;
      }

      const secret = "test-secret";
      const token = await encode(data, secret);
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });
  });

  describe("Options Coverage", () => {
    test("should handle all encode options combinations", async () => {
      const data = { test: "options" };
      const secret = "test-secret";

      // No options
      await encode(data, secret);

      // With compression
      await encode(data, secret, { compression: "brotli" });
      await encode(data, secret, { compression: "lz-string" });
      await encode(data, secret, { compression: "zlib" });
      await encode(data, secret, { compression: "none" });

      // With TTL
      await encode(data, secret, { ttl: 1000 });

      // With both
      await encode(data, secret, { compression: "brotli", ttl: 5000 });
    });
  });
});

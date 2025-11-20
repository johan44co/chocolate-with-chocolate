/**
 * Tests for Advanced Features: Custom Metadata, Streaming, and Auto-Compression
 */

import { describe, it, expect } from "@jest/globals";
import { encode } from "../src/cwc.js";
import {
  encodeWithMetadata,
  decodeWithMetadata,
  extractCustomMetadata,
  updateMetadata,
  hasCustomMetadata,
  validateMetadataSchema,
  createTypedMetadata,
} from "../src/utils/customMetadata.js";
import {
  encodeStream,
  decodeStream,
  decodeStreamFromTokens,
  estimateChunkCount,
  shouldStream,
  DEFAULT_CHUNK_SIZE,
} from "../src/utils/streaming.js";
import {
  analyzePayload,
  selectCompressionAlgorithm,
  compareCompressionAlgorithms,
  getBestCompressionAlgorithm,
} from "../src/utils/autoCompress.js";

describe("Custom Metadata", () => {
  describe("encodeWithMetadata & decodeWithMetadata", () => {
    it("should encode and decode with custom metadata", async () => {
      const data = { message: "Hello" };
      const metadata = { userId: "123", sessionId: "abc" };

      const token = await encodeWithMetadata(data, metadata, "secret");
      const result = await decodeWithMetadata(token, "secret");

      expect(result.data).toEqual(data);
      expect(result.meta).toEqual(metadata);
    });

    it("should support complex metadata", async () => {
      const data = { value: 42 };
      const metadata = {
        user: { id: 123, name: "John" },
        permissions: ["read", "write"],
        timestamp: Date.now(),
      };

      const token = await encodeWithMetadata(data, metadata, "secret");
      const result = await decodeWithMetadata(token, "secret");

      expect(result.data).toEqual(data);
      expect(result.meta).toEqual(metadata);
    });
  });

  describe("extractCustomMetadata", () => {
    it("should extract only metadata", async () => {
      const data = { payload: "large data" };
      const metadata = { id: "test123" };

      const token = await encodeWithMetadata(data, metadata, "secret");
      const extracted = await extractCustomMetadata(token, "secret");

      expect(extracted).toEqual(metadata);
    });
  });

  describe("updateMetadata", () => {
    it("should update metadata without changing data", async () => {
      const data = { value: 100 };
      const initialMeta = { version: 1, status: "active" };

      const token1 = await encodeWithMetadata(data, initialMeta, "secret");

      const token2 = await updateMetadata(
        token1,
        { version: 2, lastModified: Date.now() },
        "secret"
      );

      const result = await decodeWithMetadata(token2, "secret");

      expect(result.data).toEqual(data);
      expect(result.meta.version).toBe(2);
      expect(result.meta.status).toBe("active");
      expect(result.meta.lastModified).toBeDefined();
    });
  });

  describe("hasCustomMetadata", () => {
    it("should detect custom metadata structure", async () => {
      const token1 = await encodeWithMetadata({ test: true }, { id: "1" }, "secret");
      const token2 = await encode({ test: true }, "secret");

      expect(await hasCustomMetadata(token1, "secret")).toBe(true);
      expect(await hasCustomMetadata(token2, "secret")).toBe(false);
    });
  });

  describe("validateMetadataSchema", () => {
    it("should validate correct schema", () => {
      const metadata = {
        userId: "123",
        count: 42,
        tags: ["a", "b"],
      };

      const schema = {
        userId: "string",
        count: "number",
        tags: "array",
      };

      expect(() => validateMetadataSchema(metadata, schema)).not.toThrow();
    });

    it("should throw on missing required field", () => {
      const metadata = { userId: "123" };
      const schema = { userId: "string", count: "number" };

      expect(() => validateMetadataSchema(metadata, schema)).toThrow(
        /Missing required metadata field: count/
      );
    });

    it("should allow optional fields", () => {
      const metadata = { userId: "123" };
      const schema = { userId: "string", count: "?number" };

      expect(() => validateMetadataSchema(metadata, schema)).not.toThrow();
    });

    it("should throw on type mismatch", () => {
      const metadata = { userId: 123 };
      const schema = { userId: "string" };

      expect(() => validateMetadataSchema(metadata, schema)).toThrow(
        /Invalid type for metadata field 'userId'/
      );
    });
  });

  describe("createTypedMetadata", () => {
    it("should create typed encoder/decoder", async () => {
      const userToken = createTypedMetadata({
        userId: "string",
        role: "string",
      });

      const token = await userToken.encode(
        { name: "John" },
        { userId: "123", role: "admin" },
        "secret"
      );

      const result = await userToken.decode(token, "secret");

      expect(result.data).toEqual({ name: "John" });
      expect(result.meta.userId).toBe("123");
      expect(result.meta.role).toBe("admin");
    });

    it("should validate on encode", async () => {
      const typed = createTypedMetadata({ userId: "string" });

      await expect(
        typed.encode({ test: true }, { userId: 123 } as never, "secret")
      ).rejects.toThrow();
    });
  });
});

describe("Streaming", () => {
  describe("encodeStream & decodeStream", () => {
    it("should stream small data into single chunk", async () => {
      const data = { message: "small" };

      const chunks = await encodeStream(data, "secret", {}, 1000);

      expect(chunks.length).toBe(1);
      expect(chunks[0]?.metadata.index).toBe(0);
      expect(chunks[0]?.metadata.total).toBe(1);

      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(data);
    });

    it("should stream large data into multiple chunks", async () => {
      // Create data larger than chunk size
      const largeData = { items: new Array(1000).fill("test data") };

      const chunks = await encodeStream(largeData, "secret", {}, 500);

      expect(chunks.length).toBeGreaterThan(1);

      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(largeData);
    });

    it("should handle chunks in any order", async () => {
      const data = { items: new Array(500).fill("x") };

      const chunks = await encodeStream(data, "secret", {}, 300);

      // Shuffle chunks
      const shuffled = [...chunks].sort(() => Math.random() - 0.5);

      const decoded = await decodeStream(shuffled, "secret");
      expect(decoded).toEqual(data);
    });

    it("should throw on missing chunks", async () => {
      const data = { items: new Array(500).fill("x") };

      const chunks = await encodeStream(data, "secret", {}, 300);

      // Remove middle chunk
      const incomplete = chunks.filter((c) => c.metadata.index !== 1);

      await expect(decodeStream(incomplete, "secret")).rejects.toThrow(/Incomplete chunks/);
    });

    it("should throw on mismatched chunk IDs", async () => {
      const chunks1 = await encodeStream({ data: 1 }, "secret", {}, 100);
      const chunks2 = await encodeStream({ data: 2 }, "secret", {}, 100);

      const mixed = [chunks1[0]!, chunks2[0]!];

      await expect(decodeStream(mixed, "secret")).rejects.toThrow(/Chunk ID mismatch/);
    });

    it("should throw on empty chunks array", async () => {
      await expect(decodeStream([], "secret")).rejects.toThrow(/No chunks provided/);
    });
  });

  describe("decodeStreamFromTokens", () => {
    it("should decode from token strings only", async () => {
      const data = { test: "value" };
      const chunks = await encodeStream(data, "secret", {}, 50);

      const tokens = chunks.map((c) => c.token);
      const decoded = await decodeStreamFromTokens(tokens, "secret");

      expect(decoded).toEqual(data);
    });
  });

  describe("estimateChunkCount", () => {
    it("should estimate chunk count", () => {
      const smallData = { test: true };
      const count1 = estimateChunkCount(smallData, 100);
      expect(count1).toBeGreaterThan(0);

      const largeData = { items: new Array(1000).fill("data") };
      const count2 = estimateChunkCount(largeData, 100);
      expect(count2).toBeGreaterThan(count1);
    });
  });

  describe("shouldStream", () => {
    it("should recommend streaming for large data", () => {
      const largeData = { items: new Array(10000).fill("x") };
      expect(shouldStream(largeData, 1000)).toBe(true);
    });

    it("should not recommend streaming for small data", () => {
      const smallData = { test: true };
      expect(shouldStream(smallData, DEFAULT_CHUNK_SIZE)).toBe(false);
    });
  });
});

describe("Auto-Compression", () => {
  describe("analyzePayload", () => {
    it("should analyze small payload", () => {
      const json = JSON.stringify({ test: true });
      const analysis = analyzePayload(json);

      expect(analysis.size).toBe(json.length);
      expect(analysis.entropy).toBeGreaterThanOrEqual(0);
      expect(analysis.entropy).toBeLessThanOrEqual(1);
      expect(analysis.recommended).toBeDefined();
    });

    it("should recommend none for very small data", () => {
      const json = JSON.stringify({ x: 1 });
      const analysis = analyzePayload(json);

      expect(analysis.recommended).toBe("none");
    });

    it("should recommend compression for medium data", () => {
      const json = JSON.stringify({ data: "x".repeat(1000) });
      const analysis = analyzePayload(json);

      expect(analysis.recommended).not.toBe("none");
    });

    it("should detect likely compressed data", () => {
      // High entropy random data
      const randomData = Array.from({ length: 1000 }, () =>
        String.fromCharCode(Math.floor(Math.random() * 256))
      ).join("");

      const analysis = analyzePayload(randomData);

      // High entropy suggests already compressed
      if (analysis.entropy > 0.9) {
        expect(analysis.recommended).toBe("none");
      }
    });

    it("should prefer cross-platform algorithms", () => {
      const json = JSON.stringify({ data: "x".repeat(1000) });
      const analysis = analyzePayload(json, true);

      // Should recommend lz-string for cross-platform
      expect(["none", "lz-string"]).toContain(analysis.recommended);
    });
  });

  describe("selectCompressionAlgorithm", () => {
    it("should select appropriate algorithm", () => {
      const smallData = { test: true };
      const algo1 = selectCompressionAlgorithm(smallData);
      expect(algo1).toBeDefined();

      const mediumData = { data: "x".repeat(5000) };
      const algo2 = selectCompressionAlgorithm(mediumData);
      expect(algo2).toBeDefined();
    });

    it("should respect cross-platform preference", () => {
      const data = { data: "x".repeat(5000) };
      const algo = selectCompressionAlgorithm(data, true);

      // Should be cross-platform compatible
      expect(["none", "lz-string"]).toContain(algo);
    });
  });

  describe("compareCompressionAlgorithms", () => {
    it("should score all algorithms", () => {
      const data = { data: "x".repeat(1000) };
      const scores = compareCompressionAlgorithms(data);

      expect(scores.size).toBe(4); // none, lz-string, brotli, zlib
      expect(scores.get("none")).toBeDefined();
      expect(scores.get("lz-string")).toBeDefined();
      expect(scores.get("brotli")).toBeDefined();
      expect(scores.get("zlib")).toBeDefined();

      // All scores should be 0-100
      for (const score of scores.values()) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it("should prefer none for already compressed data", () => {
      const compressedLike = Array.from({ length: 1000 }, () =>
        String.fromCharCode(Math.floor(Math.random() * 256))
      ).join("");

      const scores = compareCompressionAlgorithms(compressedLike);
      const noneScore = scores.get("none") ?? 0;

      // None should have highest score for high entropy data
      if (noneScore > 90) {
        for (const [algo, score] of scores) {
          if (algo !== "none") {
            expect(score).toBeLessThan(noneScore);
          }
        }
      }
    });
  });

  describe("getBestCompressionAlgorithm", () => {
    it("should return algorithm with highest score", () => {
      const data = { data: "test".repeat(100) };
      const best = getBestCompressionAlgorithm(data);

      expect(best).toBeDefined();
      expect(["none", "lz-string", "brotli", "zlib"]).toContain(best);
    });

    it("should handle various data sizes", () => {
      const tiny = { x: 1 };
      const small = { data: "x".repeat(100) };
      const medium = { data: "x".repeat(5000) };
      const large = { data: "x".repeat(50000) };

      const algo1 = getBestCompressionAlgorithm(tiny);
      const algo2 = getBestCompressionAlgorithm(small);
      const algo3 = getBestCompressionAlgorithm(medium);
      const algo4 = getBestCompressionAlgorithm(large);

      expect(algo1).toBeDefined();
      expect(algo2).toBeDefined();
      expect(algo3).toBeDefined();
      expect(algo4).toBeDefined();
    });
  });
});

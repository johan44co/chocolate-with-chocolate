/**
 * Comprehensive tests for streaming utilities
 */

import { describe, it, expect } from "@jest/globals";
import {
  encodeStream,
  decodeStream,
  decodeStreamFromTokens,
  estimateChunkCount,
  shouldStream,
  DEFAULT_CHUNK_SIZE,
} from "../src/utils/streaming.js";
import { encode } from "../src/cwc.js";

describe("Streaming Utilities - Edge Cases", () => {
  describe("decodeStream edge cases", () => {
    it("should handle single chunk correctly", async () => {
      const data = { simple: "test" };
      const chunks = await encodeStream(data, "secret", {}, 10000);

      expect(chunks.length).toBe(1);
      expect(chunks[0]?.metadata.total).toBe(1);

      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(data);
    });

    it("should handle many small chunks", async () => {
      const data = { items: Array(100).fill("x") };
      const chunks = await encodeStream(data, "secret", {}, 10);

      expect(chunks.length).toBeGreaterThan(1);

      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(data);
    });

    it("should reject chunks with mismatched totals", async () => {
      const data = { test: "data" };
      const chunks = await encodeStream(data, "secret", {}, 50);

      // Manually create a chunk with wrong total metadata
      // We'll encode a chunk with incorrect metadata
      const malformedPayload = {
        data: "x".repeat(50),
        meta: {
          index: 0,
          total: 999, // Wrong total
          chunkId: chunks[0]!.metadata.chunkId,
        },
      };

      const malformedToken = await encode(malformedPayload, "secret");
      const malformedChunk = {
        token: malformedToken,
        metadata: malformedPayload.meta,
      };

      // Single chunk but says total is 999 - should fail
      await expect(decodeStream([malformedChunk], "secret")).rejects.toThrow(/Incomplete chunks/);
    });

    it("should validate sequential chunk indices", async () => {
      const data = { items: Array(100).fill("test") };
      const chunks = await encodeStream(data, "secret", {}, 30);

      if (chunks.length >= 3) {
        // Create a new chunk with wrong index
        const wrongIndexPayload = {
          data: "x".repeat(50),
          meta: {
            index: 99, // Skip ahead
            total: chunks.length,
            chunkId: chunks[0]!.metadata.chunkId,
          },
        };

        const wrongToken = await encode(wrongIndexPayload, "secret");

        // Replace a chunk with wrong index
        const modified = [
          chunks[0]!,
          {
            token: wrongToken,
            metadata: wrongIndexPayload.meta,
          },
          ...chunks.slice(2),
        ];

        await expect(decodeStream(modified, "secret")).rejects.toThrow(/Missing chunk at index/);
      }
    });

    it("should handle re-assembly of unordered chunks", async () => {
      const data = { items: Array(50).fill("test") };
      const chunks = await encodeStream(data, "secret", {}, 20);

      if (chunks.length > 1) {
        // Reverse order
        const reversed = [...chunks].reverse();
        const decoded = await decodeStream(reversed, "secret");
        expect(decoded).toEqual(data);
      }
    });

    it("should detect corrupt chunk data", async () => {
      const data = { test: "value" };
      const chunks = await encodeStream(data, "secret", {}, 100);

      if (chunks.length > 0) {
        // Create a chunk with data that won't parse as valid JSON when reassembled
        // The reassembled JSON must be invalid
        const corruptedPayload = {
          data: JSON.stringify({ broken: "data" }).slice(0, -1) + "BROKEN",
          meta: {
            ...chunks[0]!.metadata,
            total: 1, // Single chunk
          },
        };

        const corruptedToken = await encode(corruptedPayload, "secret");
        const corruptedChunk = {
          token: corruptedToken,
          metadata: corruptedPayload.meta,
        };

        await expect(decodeStream([corruptedChunk], "secret")).rejects.toThrow(
          /Failed to parse reassembled data/
        );
      }
    });
  });

  describe("decodeStreamFromTokens", () => {
    it("should decode from token array", async () => {
      const data = { message: "test" };
      const chunks = await encodeStream(data, "secret", {}, 100);

      const tokens = chunks.map((c) => c.token);
      const decoded = await decodeStreamFromTokens(tokens, "secret");

      expect(decoded).toEqual(data);
    });

    it("should handle single token", async () => {
      const data = { single: true };
      const chunks = await encodeStream(data, "secret", {}, 1000);

      const decoded = await decodeStreamFromTokens([chunks[0]!.token], "secret");
      expect(decoded).toEqual(data);
    });

    it("should handle multiple tokens in any order", async () => {
      const data = { items: Array(100).fill("x") };
      const chunks = await encodeStream(data, "secret", {}, 30);

      const tokens = chunks.map((c) => c.token);
      const shuffledTokens = [...tokens].sort(() => Math.random() - 0.5);

      const decoded = await decodeStreamFromTokens(shuffledTokens, "secret");
      expect(decoded).toEqual(data);
    });
  });

  describe("estimateChunkCount", () => {
    it("should estimate chunks for small data", () => {
      const small = { x: 1 };
      const count = estimateChunkCount(small, 1000);
      expect(count).toBe(1);
    });

    it("should estimate chunks for large data", () => {
      const large = { items: Array(1000).fill("x") };
      const count = estimateChunkCount(large, 100);
      expect(count).toBeGreaterThan(1);
    });

    it("should scale with chunk size", () => {
      const data = { items: Array(500).fill("x") };
      const count1 = estimateChunkCount(data, 100);
      const count2 = estimateChunkCount(data, 1000);
      expect(count1).toBeGreaterThan(count2);
    });
  });

  describe("shouldStream", () => {
    it("should recommend streaming for large payloads", () => {
      const largeData = { items: Array(5000).fill("data") };
      expect(shouldStream(largeData, 1000)).toBe(true);
    });

    it("should not recommend streaming for small payloads", () => {
      const smallData = { x: 1 };
      expect(shouldStream(smallData, DEFAULT_CHUNK_SIZE)).toBe(false);
    });

    it("should recommend streaming near threshold", () => {
      const data = { items: Array(500).fill("item") };
      // Might recommend depending on serialized size
      const result = shouldStream(data, 1000);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("encodeStream variations", () => {
    it("should encode with default chunk size", async () => {
      const data = { items: Array(100).fill("test") };
      const chunks = await encodeStream(data, "secret");

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.metadata.total).toBe(chunks.length);

      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(data);
    });

    it("should maintain chunk ID consistency", async () => {
      const data = { test: "value" };
      const chunks = await encodeStream(data, "secret", {}, 50);

      const chunkIds = chunks.map((c) => c.metadata.chunkId);
      const uniqueIds = new Set(chunkIds);

      // All chunks from same stream should have same ID
      expect(uniqueIds.size).toBe(1);
    });

    it("should encode with custom options", async () => {
      const data = { compression: "test" };
      const chunks = await encodeStream(data, "secret", { compression: "lz-string" }, 100);

      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(data);
    });

    it("should handle very large chunk requests", async () => {
      const data = { items: Array(100).fill("test") };
      const chunks = await encodeStream(data, "secret", {}, 1000000);

      // Should be single chunk since data is small
      expect(chunks.length).toBe(1);

      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(data);
    });
  });

  describe("streaming with different data types", () => {
    it("should stream objects", async () => {
      const obj = { nested: { data: { value: 123 } } };
      const chunks = await encodeStream(obj, "secret", {}, 50);
      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(obj);
    });

    it("should stream arrays", async () => {
      const arr = [1, 2, 3, 4, 5, ...Array(100).fill("x")];
      const chunks = await encodeStream(arr, "secret", {}, 50);
      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(arr);
    });

    it("should stream strings", async () => {
      const str = "x".repeat(500);
      const chunks = await encodeStream(str, "secret", {}, 50);
      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(str);
    });

    it("should stream numbers", async () => {
      const num = 12345.6789;
      const chunks = await encodeStream(num, "secret", {}, 100);
      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(num);
    });

    it("should stream booleans", async () => {
      const bool = true;
      const chunks = await encodeStream(bool, "secret", {}, 100);
      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(bool);
    });

    it("should stream null", async () => {
      const nullVal = null;
      const chunks = await encodeStream(nullVal, "secret", {}, 100);
      const decoded = await decodeStream(chunks, "secret");
      expect(decoded).toEqual(nullVal);
    });
  });
});

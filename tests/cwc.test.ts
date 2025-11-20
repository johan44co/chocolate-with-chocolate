/**
 * End-to-end tests for CWC encode/decode
 */

import { describe, it, expect } from "@jest/globals";
import { encode, decode, decodeWithMetadata, validateToken, extractMetadata } from "../src/cwc.js";
import { generateKey } from "../src/core/crypto.js";

describe("CWC encode/decode", () => {
  describe("basic encode/decode", () => {
    it("should encode and decode simple string", async () => {
      const secret = "my-secret-password";
      const data = "Hello, World!";

      const token = await encode(data, secret);
      const decoded = await decode<string>(token, secret);

      expect(decoded).toBe(data);
    });

    it("should encode and decode number", async () => {
      const secret = generateKey();
      const data = 42;

      const token = await encode(data, secret);
      const decoded = await decode<number>(token, secret);

      expect(decoded).toBe(data);
    });

    it("should encode and decode boolean", async () => {
      const secret = "test-password";
      const data = true;

      const token = await encode(data, secret);
      const decoded = await decode<boolean>(token, secret);

      expect(decoded).toBe(data);
    });

    it("should encode and decode null", async () => {
      const secret = generateKey();
      const data = null;

      const token = await encode(data, secret);
      const decoded = await decode(token, secret);

      expect(decoded).toBeNull();
    });

    it("should encode and decode array", async () => {
      const secret = "array-test";
      const data = [1, 2, 3, "four", true];

      const token = await encode(data, secret);
      const decoded = await decode<typeof data>(token, secret);

      expect(decoded).toEqual(data);
    });

    it("should encode and decode object", async () => {
      const secret = generateKey();
      const data = { name: "Alice", age: 30, active: true };

      const token = await encode(data, secret);
      const decoded = await decode<typeof data>(token, secret);

      expect(decoded).toEqual(data);
    });

    it("should encode and decode nested object", async () => {
      const secret = "nested-test";
      const data = {
        user: {
          id: 1,
          profile: {
            name: "Bob",
            email: "bob@example.com",
          },
          roles: ["admin", "user"],
        },
        metadata: {
          version: 1,
          timestamp: Date.now(),
        },
      };

      const token = await encode(data, secret);
      const decoded = await decode<typeof data>(token, secret);

      expect(decoded).toEqual(data);
    });
  });

  describe("different secrets", () => {
    it("should work with string password", async () => {
      const password = "secure-password-123";
      const data = { test: "data" };

      const token = await encode(data, password);
      const decoded = await decode(token, password);

      expect(decoded).toEqual(data);
    });

    it("should work with Uint8Array key", async () => {
      const key = generateKey();
      const data = { test: "data" };

      const token = await encode(data, key);
      const decoded = await decode(token, key);

      expect(decoded).toEqual(data);
    });

    it("should fail with wrong password", async () => {
      const data = { secret: "message" };

      const token = await encode(data, "correct-password");

      await expect(decode(token, "wrong-password")).rejects.toThrow();
    });

    it("should fail with wrong key", async () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const data = { test: "data" };

      const token = await encode(data, key1);

      await expect(decode(token, key2)).rejects.toThrow();
    });
  });

  describe("compression options", () => {
    it("should work with brotli compression", async () => {
      const secret = "test";
      const data = "a".repeat(1000);

      const token = await encode(data, secret, { compression: "brotli" });
      const decoded = await decode<string>(token, secret);

      expect(decoded).toBe(data);
    });

    it("should work with lz-string compression", async () => {
      const secret = "test";
      const data = "b".repeat(1000);

      const token = await encode(data, secret, { compression: "lz-string" });
      const decoded = await decode<string>(token, secret);

      expect(decoded).toBe(data);
    });

    it("should work with zlib compression", async () => {
      const secret = "test";
      const data = "c".repeat(1000);

      const token = await encode(data, secret, { compression: "zlib" });
      const decoded = await decode<string>(token, secret);

      expect(decoded).toBe(data);
    });

    it("should work with no compression", async () => {
      const secret = generateKey();
      const data = { test: "no compression" };

      const token = await encode(data, secret, { compression: "none" });
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });
  });

  describe("timestamp and TTL", () => {
    it("should include timestamp when requested", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token = await encode(data, secret, { includeTimestamp: true });
      const { metadata } = await decodeWithMetadata(token, secret);

      expect(metadata.timestamp).toBeDefined();
      expect(metadata.timestamp).toBeGreaterThan(0);
    });

    it("should include TTL", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token = await encode(data, secret, { ttl: 3600 });
      const { metadata } = await decodeWithMetadata(token, secret);

      expect(metadata.ttl).toBe(3600);
    });

    it("should not expire before TTL", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token = await encode(data, secret, {
        includeTimestamp: true,
        ttl: 10, // 10 seconds
      });

      const decoded = await decode(token, secret);
      expect(decoded).toEqual(data);
    });

    it("should reject expired token", async () => {
      const secret = "test";
      const data = { test: "data" };

      // Create token with timestamp in the past
      const token = await encode(data, secret, {
        includeTimestamp: true,
        ttl: 1, // 1 second
      });

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await expect(decode(token, secret)).rejects.toThrow("Token has expired");
    });
  });

  describe("decodeWithMetadata", () => {
    it("should return data and metadata", async () => {
      const secret = "test";
      const data = { test: "value" };

      const token = await encode(data, secret, {
        compression: "lz-string",
        includeTimestamp: true,
      });

      const { data: decoded, metadata } = await decodeWithMetadata(token, secret);

      expect(decoded).toEqual(data);
      expect(metadata.version).toBe(1);
      expect(metadata.algorithm).toBe("aes-gcm-256");
      expect(metadata.compression).toBe("lz-string");
      expect(metadata.timestamp).toBeDefined();
    });
  });

  describe("validateToken", () => {
    it("should validate correct token", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token = await encode(data, secret);

      expect(validateToken(token)).toBe(true);
    });

    it("should reject invalid base64", () => {
      expect(validateToken("not-valid-base64!!!")).toBe(false);
    });

    it("should reject too short token", () => {
      expect(validateToken("dGVzdA")).toBe(false); // "test" in base64
    });

    it("should reject corrupted token", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token = await encode(data, secret);
      // Corrupt the beginning of the token (metadata area)
      const corrupted = "x" + token.slice(1);

      expect(validateToken(corrupted)).toBe(false);
    });
  });

  describe("extractMetadata", () => {
    it("should extract metadata without decrypting", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token = await encode(data, secret, {
        compression: "zlib",
        includeTimestamp: true,
        ttl: 3600,
      });

      const metadata = extractMetadata(token);

      expect(metadata.version).toBe(1);
      expect(metadata.algorithm).toBe("aes-gcm-256");
      expect(metadata.compression).toBe("zlib");
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.ttl).toBe(3600);
    });

    it("should throw on invalid token", () => {
      expect(() => extractMetadata("invalid")).toThrow();
    });
  });

  describe("error handling", () => {
    it("should throw on invalid base64", async () => {
      const secret = "test";
      await expect(decode("!!!invalid!!!", secret)).rejects.toThrow("Invalid token");
    });

    it("should throw on too short token", async () => {
      const secret = "test";
      await expect(decode("dGVzdA", secret)).rejects.toThrow("Invalid token");
    });

    it("should throw on corrupted ciphertext", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token = await encode(data, secret);

      // Corrupt the token significantly (replace middle section)
      const middle = Math.floor(token.length / 2);
      const corrupted = token.slice(0, middle) + "AAAAAAAAAA" + token.slice(middle + 10);

      await expect(decode(corrupted, secret)).rejects.toThrow();
    });

    it("should throw on wrong secret", async () => {
      const data = { test: "data" };

      const token = await encode(data, "correct");

      await expect(decode(token, "wrong")).rejects.toThrow("Decryption failed");
    });
  });

  describe("data types", () => {
    it("should handle UTF-8 strings", async () => {
      const secret = generateKey();
      const data = "Hello 世界 🌍 Привет مرحبا";

      const token = await encode(data, secret);
      const decoded = await decode<string>(token, secret);

      expect(decoded).toBe(data);
    });

    it("should handle large objects", async () => {
      const secret = "test";
      const data = {
        users: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            active: i % 2 === 0,
          })),
      };

      const token = await encode(data, secret);
      const decoded = await decode<typeof data>(token, secret);

      expect(decoded).toEqual(data);
    });

    it("should handle empty object", async () => {
      const secret = "test";
      const data = {};

      const token = await encode(data, secret);
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });

    it("should handle empty array", async () => {
      const secret = "test";
      const data: unknown[] = [];

      const token = await encode(data, secret);
      const decoded = await decode<unknown[]>(token, secret);

      expect(decoded).toEqual(data);
    });

    it("should handle Date objects (as strings)", async () => {
      const secret = "test";
      const date = new Date();
      const data = { timestamp: date.toISOString() };

      const token = await encode(data, secret);
      const decoded = await decode<typeof data>(token, secret);

      expect(decoded.timestamp).toBe(date.toISOString());
    });
  });

  describe("token properties", () => {
    it("should produce URL-safe tokens", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token = await encode(data, secret);

      // Should not contain +, /, or =
      expect(token).not.toContain("+");
      expect(token).not.toContain("/");
      expect(token).not.toContain("=");

      // Should only contain URL-safe characters
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should produce different tokens for same data", async () => {
      const secret = "test";
      const data = { test: "data" };

      const token1 = await encode(data, secret);
      const token2 = await encode(data, secret);

      // Should be different due to random IV
      expect(token1).not.toBe(token2);

      // But both should decode to same data
      expect(await decode(token1, secret)).toEqual(data);
      expect(await decode(token2, secret)).toEqual(data);
    });

    it("should compress data effectively", async () => {
      const secret = "test";
      const data = {
        message: "a".repeat(1000),
      };

      const token = await encode(data, secret, { compression: "brotli" });

      // Token should be significantly smaller than original JSON
      const originalSize = JSON.stringify(data).length;
      const tokenSize = token.length;

      expect(tokenSize).toBeLessThan(originalSize * 0.5);
    });
  });

  describe("integration scenarios", () => {
    it("should work as localStorage token", async () => {
      const secret = "user-session-secret";
      const sessionData = {
        userId: "12345",
        username: "alice",
        roles: ["user", "admin"],
        preferences: {
          theme: "dark",
          language: "en",
        },
      };

      const token = await encode(sessionData, secret, {
        includeTimestamp: true,
        ttl: 3600,
      });

      // Simulate storing in localStorage
      const storedToken = token;

      // Retrieve and decode
      const decoded = await decode<typeof sessionData>(storedToken, secret);

      expect(decoded).toEqual(sessionData);
    });

    it("should work as URL parameter", async () => {
      const secret = "reset-token-secret";
      const resetData = {
        email: "user@example.com",
        code: "abc123",
      };

      const token = await encode(resetData, secret, {
        includeTimestamp: true,
        ttl: 900, // 15 minutes
      });

      // Simulate URL encoding
      const url = `https://example.com/reset?token=${encodeURIComponent(token)}`;
      const urlToken = new URL(url).searchParams.get("token")!;

      const decoded = await decode<typeof resetData>(urlToken, secret);

      expect(decoded).toEqual(resetData);
    });
  });
});

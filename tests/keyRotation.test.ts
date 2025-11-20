/**
 * Tests for Key Rotation Utilities
 */

import { describe, it, expect } from "@jest/globals";
import { encode, decode } from "../src/cwc.js";
import { randomBytes } from "../src/utils/buffers.js";
import {
  rotateKey,
  rotateKeys,
  validateKeyRotation,
  decodeWithKeyFallback,
  getRotationAge,
} from "../src/utils/keyRotation.js";

describe("Key Rotation", () => {
  describe("rotateKey", () => {
    it("should rotate a token from old key to new key", async () => {
      const data = { message: "Hello, World!" };
      const oldSecret = "old-secret";
      const newSecret = "new-secret";

      // Create token with old key
      const oldToken = await encode(data, oldSecret);

      // Rotate to new key
      const newToken = await rotateKey(oldToken, oldSecret, newSecret);

      // Should be able to decode with new key
      const decoded = await decode(newToken, newSecret);
      expect(decoded).toEqual(data);

      // Should NOT be able to decode with old key
      await expect(decode(newToken, oldSecret)).rejects.toThrow();
    });

    it("should preserve data during rotation", async () => {
      const data = {
        id: 123,
        name: "Test User",
        roles: ["admin", "user"],
        metadata: { created: Date.now() },
      };

      const oldToken = await encode(data, "key1");
      const newToken = await rotateKey(oldToken, "key1", "key2");
      const decoded = await decode(newToken, "key2");

      expect(decoded).toEqual(data);
    });

    it("should respect encoding options during rotation", async () => {
      const data = { value: 42 };
      const oldToken = await encode(data, "old", { compression: "none" });
      const newToken = await rotateKey(oldToken, "old", "new", {
        compression: "lz-string",
      });

      const decoded = await decode(newToken, "new");
      expect(decoded).toEqual(data);
    });

    it("should throw on invalid old key", async () => {
      const token = await encode({ test: true }, "correct");
      await expect(rotateKey(token, "wrong", "new")).rejects.toThrow();
    });
  });

  describe("rotateKeys", () => {
    it("should rotate multiple tokens in batch", async () => {
      const data1 = { id: 1 };
      const data2 = { id: 2 };
      const data3 = { id: 3 };

      const oldSecret = "old-secret";
      const newSecret = "new-secret";

      const oldTokens = [
        await encode(data1, oldSecret),
        await encode(data2, oldSecret),
        await encode(data3, oldSecret),
      ];

      const newTokens = await rotateKeys(oldTokens, oldSecret, newSecret);

      expect(newTokens).toHaveLength(3);

      const decoded1 = await decode(newTokens[0] ?? "", newSecret);
      const decoded2 = await decode(newTokens[1] ?? "", newSecret);
      const decoded3 = await decode(newTokens[2] ?? "", newSecret);

      expect(decoded1).toEqual(data1);
      expect(decoded2).toEqual(data2);
      expect(decoded3).toEqual(data3);
    });

    it("should handle empty array", async () => {
      const result = await rotateKeys([], "old", "new");
      expect(result).toEqual([]);
    });

    it("should fail if any token is invalid", async () => {
      const validToken = await encode({ test: true }, "secret");
      const tokens = [validToken, "invalid-token"];

      await expect(rotateKeys(tokens, "secret", "new")).rejects.toThrow();
    });
  });

  describe("validateKeyRotation", () => {
    it("should validate successful rotation", async () => {
      const token = await encode({ test: true }, "old");
      const isValid = await validateKeyRotation(token, "old", "new");
      expect(isValid).toBe(true);
    });

    it("should return false for invalid old key", async () => {
      const token = await encode({ test: true }, "correct");
      const isValid = await validateKeyRotation(token, "wrong", "new");
      expect(isValid).toBe(false);
    });

    it("should return false for invalid token", async () => {
      const isValid = await validateKeyRotation("invalid-token", "old", "new");
      expect(isValid).toBe(false);
    });
  });

  describe("decodeWithKeyFallback", () => {
    it("should decode with first matching key", async () => {
      const data = { message: "test" };
      const token = await encode(data, "key2");

      const result = await decodeWithKeyFallback(token, ["key1", "key2", "key3"]);

      expect(result.data).toEqual(data);
      expect(result.keyIndex).toBe(1);
    });

    it("should try all keys in order", async () => {
      const data = { value: 123 };
      const token = await encode(data, "last-key");

      const result = await decodeWithKeyFallback(token, ["first", "second", "third", "last-key"]);

      expect(result.data).toEqual(data);
      expect(result.keyIndex).toBe(3);
    });

    it("should throw if no key works", async () => {
      const token = await encode({ test: true }, "correct");

      await expect(decodeWithKeyFallback(token, ["wrong1", "wrong2", "wrong3"])).rejects.toThrow(
        /Failed to decode token with any of the 3 provided keys/
      );
    });

    it("should handle Uint8Array keys", async () => {
      const key = randomBytes(32);

      const data = { test: "value" };
      const token = await encode(data, key);

      const wrongKey = randomBytes(32);

      const result = await decodeWithKeyFallback(token, [wrongKey, key]);

      expect(result.data).toEqual(data);
      expect(result.keyIndex).toBe(1);
    });

    it("should work during key rotation period", async () => {
      // Simulate tokens created with both old and new keys
      const data1 = { id: 1 };
      const data2 = { id: 2 };

      const oldKey = "old-secret";
      const newKey = "new-secret";

      const oldToken = await encode(data1, oldKey);
      const newToken = await encode(data2, newKey);

      // Should decode both during rotation period
      const result1 = await decodeWithKeyFallback(oldToken, [newKey, oldKey]);
      const result2 = await decodeWithKeyFallback(newToken, [newKey, oldKey]);

      expect(result1.data).toEqual(data1);
      expect(result1.keyIndex).toBe(1); // old key

      expect(result2.data).toEqual(data2);
      expect(result2.keyIndex).toBe(0); // new key
    });
  });

  describe("getRotationAge", () => {
    it("should return token age in milliseconds", async () => {
      const before = Date.now();
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      const age = getRotationAge(token);
      const after = Date.now();

      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThanOrEqual(after - before + 1000); // Allow even more tolerance for timing
    });

    it("should throw if token has no timestamp", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: false,
      });

      expect(() => getRotationAge(token)).toThrow("Token does not contain a timestamp");
    });

    it("should work for older tokens", async () => {
      // Create a token and wait
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const age = getRotationAge(token);
      expect(age).toBeGreaterThanOrEqual(50);
    });
  });
});

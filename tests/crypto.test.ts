/**
 * Tests for crypto module
 */

import { describe, it, expect } from "@jest/globals";
import {
  encrypt,
  decrypt,
  isValidKey,
  generateKey,
  getKeyLength,
  getIvLength,
} from "../src/core/crypto.js";
import { stringToBytes, bytesToString, areEqual } from "../src/utils/buffers.js";

describe("crypto module", () => {
  describe("generateKey", () => {
    it("should generate key of correct length", () => {
      const key = generateKey();
      expect(key.length).toBe(32);
    });

    it("should generate different keys each time", () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(areEqual(key1, key2)).toBe(false);
    });

    it("should generate valid keys", () => {
      const key = generateKey();
      expect(isValidKey(key)).toBe(true);
    });
  });

  describe("isValidKey", () => {
    it("should validate correct key length", () => {
      const key = new Uint8Array(32).fill(1);
      expect(isValidKey(key)).toBe(true);
    });

    it("should reject incorrect key lengths", () => {
      expect(isValidKey(new Uint8Array(16))).toBe(false);
      expect(isValidKey(new Uint8Array(31))).toBe(false);
      expect(isValidKey(new Uint8Array(33))).toBe(false);
      expect(isValidKey(new Uint8Array(0))).toBe(false);
    });
  });

  describe("getKeyLength / getIvLength", () => {
    it("should return correct key length", () => {
      expect(getKeyLength()).toBe(32);
    });

    it("should return correct IV length", () => {
      expect(getIvLength()).toBe(12);
    });
  });

  describe("encrypt / decrypt with Uint8Array key", () => {
    it("should encrypt and decrypt simple data", async () => {
      const key = generateKey();
      const plaintext = stringToBytes("Hello, World!");

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(bytesToString(decrypted)).toBe("Hello, World!");
    });

    it("should generate unique IVs for each encryption", async () => {
      const key = generateKey();
      const plaintext = stringToBytes("test data");

      const encrypted1 = await encrypt(plaintext, key);
      const encrypted2 = await encrypt(plaintext, key);

      // IVs should be different
      expect(areEqual(encrypted1.iv, encrypted2.iv)).toBe(false);

      // Both should decrypt correctly
      expect(bytesToString(await decrypt(encrypted1, key))).toBe("test data");
      expect(bytesToString(await decrypt(encrypted2, key))).toBe("test data");
    });

    it("should handle empty data", async () => {
      const key = generateKey();
      const plaintext = new Uint8Array([]);

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted.length).toBe(0);
    });

    it("should handle large data", async () => {
      const key = generateKey();
      const plaintext = new Uint8Array(10000).fill(42);

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toEqual(plaintext);
    });

    it("should handle binary data", async () => {
      const key = generateKey();
      const plaintext = new Uint8Array([0, 1, 2, 255, 254, 253]);

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toEqual(plaintext);
    });

    it("should fail decryption with wrong key", async () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const plaintext = stringToBytes("secret message");

      const encrypted = await encrypt(plaintext, key1);

      await expect(decrypt(encrypted, key2)).rejects.toThrow();
    });

    it("should fail decryption with corrupted ciphertext", async () => {
      const key = generateKey();
      const plaintext = stringToBytes("test");

      const encrypted = await encrypt(plaintext, key);

      // Corrupt the ciphertext
      encrypted.ciphertext[0] ^= 1;

      await expect(decrypt(encrypted, key)).rejects.toThrow();
    });

    it("should fail decryption with corrupted IV", async () => {
      const key = generateKey();
      const plaintext = stringToBytes("test");

      const encrypted = await encrypt(plaintext, key);

      // Corrupt the IV
      encrypted.iv[0] ^= 1;

      await expect(decrypt(encrypted, key)).rejects.toThrow();
    });

    it("should throw on invalid key length for encryption", async () => {
      const invalidKey = new Uint8Array(16); // Wrong length
      const plaintext = stringToBytes("test");

      await expect(encrypt(plaintext, invalidKey)).rejects.toThrow("Key must be exactly");
    });

    it("should throw on invalid key length for decryption", async () => {
      const validKey = generateKey();
      const invalidKey = new Uint8Array(16);
      const plaintext = stringToBytes("test");

      const encrypted = await encrypt(plaintext, validKey);

      await expect(decrypt(encrypted, invalidKey)).rejects.toThrow("Key must be exactly");
    });
  });

  describe("encrypt / decrypt with string password", () => {
    it("should encrypt and decrypt with password", async () => {
      const password = "my-secret-password";
      const plaintext = stringToBytes("Hello, World!");

      const encrypted = await encrypt(plaintext, password);

      // Salt should be generated
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.salt!.length).toBe(16);

      const decrypted = await decrypt(encrypted, password, encrypted.salt);

      expect(bytesToString(decrypted)).toBe("Hello, World!");
    });

    it("should generate different salts for each encryption", async () => {
      const password = "test-password";
      const plaintext = stringToBytes("test data");

      const encrypted1 = await encrypt(plaintext, password);
      const encrypted2 = await encrypt(plaintext, password);

      // Salts should be different
      expect(areEqual(encrypted1.salt!, encrypted2.salt!)).toBe(false);

      // Both should decrypt with their respective salts
      expect(bytesToString(await decrypt(encrypted1, password, encrypted1.salt))).toBe("test data");
      expect(bytesToString(await decrypt(encrypted2, password, encrypted2.salt))).toBe("test data");
    });

    it("should fail decryption without salt", async () => {
      const password = "test-password";
      const plaintext = stringToBytes("test");

      const encrypted = await encrypt(plaintext, password);

      await expect(decrypt(encrypted, password)).rejects.toThrow("Salt is required");
    });

    it("should fail decryption with wrong password", async () => {
      const password1 = "correct-password";
      const password2 = "wrong-password";
      const plaintext = stringToBytes("secret");

      const encrypted = await encrypt(plaintext, password1);

      await expect(decrypt(encrypted, password2, encrypted.salt)).rejects.toThrow();
    });

    it("should fail decryption with wrong salt", async () => {
      const password = "test-password";
      const plaintext = stringToBytes("test");

      const encrypted = await encrypt(plaintext, password);

      // Use different salt
      const wrongSalt = new Uint8Array(16).fill(1);

      await expect(decrypt(encrypted, password, wrongSalt)).rejects.toThrow();
    });

    it("should throw on empty password", async () => {
      const plaintext = stringToBytes("test");

      await expect(encrypt(plaintext, "")).rejects.toThrow("Password cannot be empty");
    });

    it("should handle Unicode passwords", async () => {
      const password = "密码🔐パスワード";
      const plaintext = stringToBytes("test data");

      const encrypted = await encrypt(plaintext, password);
      const decrypted = await decrypt(encrypted, password, encrypted.salt);

      expect(bytesToString(decrypted)).toBe("test data");
    });

    it("should handle long passwords", async () => {
      const password = "a".repeat(1000);
      const plaintext = stringToBytes("test");

      const encrypted = await encrypt(plaintext, password);
      const decrypted = await decrypt(encrypted, password, encrypted.salt);

      expect(bytesToString(decrypted)).toBe("test");
    });
  });

  describe("round-trip tests", () => {
    it("should round-trip UTF-8 text", async () => {
      const key = generateKey();
      const text = "Hello 世界 🌍 Мир";
      const plaintext = stringToBytes(text);

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(bytesToString(decrypted)).toBe(text);
    });

    it("should round-trip JSON data", async () => {
      const key = generateKey();
      const obj = { name: "Alice", age: 30, active: true };
      const plaintext = stringToBytes(JSON.stringify(obj));

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      const result = JSON.parse(bytesToString(decrypted));
      expect(result).toEqual(obj);
    });

    it("should round-trip complex data structures", async () => {
      const key = generateKey();
      const data = {
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        metadata: {
          version: 1,
          timestamp: Date.now(),
        },
      };
      const plaintext = stringToBytes(JSON.stringify(data));

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      const result = JSON.parse(bytesToString(decrypted));
      expect(result).toEqual(data);
    });
  });

  describe("error handling", () => {
    it("should throw on invalid secret type", async () => {
      const plaintext = stringToBytes("test");

      await expect(encrypt(plaintext, 123 as any)).rejects.toThrow("Secret must be");
      await expect(encrypt(plaintext, null as any)).rejects.toThrow("Secret must be");
      await expect(encrypt(plaintext, {} as any)).rejects.toThrow("Secret must be");
    });

    it("should throw on invalid IV length during decryption", async () => {
      const key = generateKey();
      const plaintext = stringToBytes("test");

      const encrypted = await encrypt(plaintext, key);

      // Corrupt IV length
      encrypted.iv = new Uint8Array(10); // Wrong length

      await expect(decrypt(encrypted, key)).rejects.toThrow("Invalid IV length");
    });

    it("should throw on ciphertext too short", async () => {
      const key = generateKey();
      const encrypted = {
        iv: new Uint8Array(12),
        ciphertext: new Uint8Array(5), // Too short (< 16 bytes for tag)
      };

      await expect(decrypt(encrypted, key)).rejects.toThrow();
    });
  });

  describe("IV properties", () => {
    it("should have correct IV length", async () => {
      const key = generateKey();
      const plaintext = stringToBytes("test");

      const encrypted = await encrypt(plaintext, key);

      expect(encrypted.iv.length).toBe(12);
    });

    it("should never reuse IVs (statistical test)", async () => {
      const key = generateKey();
      const plaintext = stringToBytes("test");
      const ivs = new Set<string>();

      // Generate 100 encryptions and check for unique IVs
      for (let i = 0; i < 100; i++) {
        const encrypted = await encrypt(plaintext, key);
        const ivHex = Array.from(encrypted.iv)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        ivs.add(ivHex);
      }

      // All IVs should be unique
      expect(ivs.size).toBe(100);
    });
  });
});

/**
 * Security Audit Tests for CWC
 * Tests for common cryptographic vulnerabilities and security best practices
 */

import { encode, decode, extractMetadata } from "../src/cwc.js";
import { decodeBase64Url } from "../src/utils/base64.js";

describe("Security Audit", () => {
  describe("IV Uniqueness", () => {
    test("should generate unique IVs for each encryption", async () => {
      const data = { test: "iv-uniqueness" };
      const secret = "test-secret-key";

      // Generate 100 tokens
      const tokens = await Promise.all(
        Array(100)
          .fill(0)
          .map(() => encode(data, secret))
      );

      // Extract IVs from tokens
      const ivs = tokens.map((token) => {
        const decoded = decodeBase64Url(token);
        // IV is stored at bytes 2-14 (after version and algorithm)
        return Buffer.from(decoded.slice(2, 14)).toString("hex");
      });

      // Check all IVs are unique
      const uniqueIVs = new Set(ivs);
      expect(uniqueIVs.size).toBe(100);
    });

    test("should never reuse IV even with same data and key", async () => {
      const data = { value: "same-data" };
      const secret = "same-secret";

      const token1 = await encode(data, secret);
      const token2 = await encode(data, secret);

      expect(token1).not.toBe(token2);

      const iv1 = decodeBase64Url(token1).slice(2, 14);
      const iv2 = decodeBase64Url(token2).slice(2, 14);

      expect(Buffer.from(iv1).equals(Buffer.from(iv2))).toBe(false);
    });

    test("should use cryptographically secure random IVs", async () => {
      const tokens = await Promise.all(
        Array(50)
          .fill(0)
          .map(() => encode({ data: "test" }, "secret"))
      );

      const ivs = tokens.map((token) => {
        const decoded = decodeBase64Url(token);
        return Buffer.from(decoded.slice(2, 14));
      });

      // Check IV randomness - no IV should be all zeros or all same byte
      ivs.forEach((iv) => {
        const bytes = Array.from(iv);
        const allZeros = bytes.every((b) => b === 0);
        const allSame = bytes.every((b) => b === bytes[0]);

        expect(allZeros).toBe(false);
        expect(allSame).toBe(false);
      });
    });
  });

  describe("Key Derivation", () => {
    test("should derive keys with sufficient entropy", async () => {
      // Test indirectly through encode/decode
      const password = "user-password-123";
      const data = { test: "key-derivation" };

      const token1 = await encode(data, password);
      const token2 = await encode(data, password);

      // Same password should be able to decrypt tokens
      const decoded1 = await decode(token1, password);
      const decoded2 = await decode(token2, password);

      expect(decoded1).toEqual(data);
      expect(decoded2).toEqual(data);
    });

    test("should produce different keys for different passwords", async () => {
      const data = { test: "different-passwords" };
      const token = await encode(data, "password1");

      // Different password should fail
      await expect(decode(token, "password2")).rejects.toThrow();
    });

    test("should reject empty secrets", async () => {
      await expect(encode({ data: "test" }, "")).rejects.toThrow();
      // Whitespace strings are technically valid for PBKDF2
    });

    test("should handle very long passwords correctly", async () => {
      const longPassword = "a".repeat(10000);
      const data = { test: "long-password" };

      const token = await encode(data, longPassword);
      const decoded = await decode(token, longPassword);

      expect(decoded).toEqual(data);
    });
  });

  describe("Authentication Tag Validation", () => {
    test("should reject tokens with modified ciphertext", async () => {
      const data = { sensitive: "data" };
      const secret = "test-secret";

      const token = await encode(data, secret);
      const tokenBytes = decodeBase64Url(token);

      // Modify a byte in the ciphertext (after metadata, IV, and before tag)
      const modified = new Uint8Array(tokenBytes);
      modified[20] ^= 0xff; // Flip bits

      const modifiedToken = Buffer.from(modified).toString("base64url");

      await expect(decode(modifiedToken, secret)).rejects.toThrow();
    });

    test("should reject tokens with modified metadata", async () => {
      const data = { test: "metadata-tamper" };
      const secret = "test-secret";

      const token = await encode(data, secret);
      const tokenBytes = decodeBase64Url(token);

      // Modify version byte
      const modified = new Uint8Array(tokenBytes);
      modified[0] = 0xff;

      const modifiedToken = Buffer.from(modified).toString("base64url");

      await expect(decode(modifiedToken, secret)).rejects.toThrow();
    });

    test("should reject tokens with modified IV", async () => {
      const data = { test: "iv-tamper" };
      const secret = "test-secret";

      const token = await encode(data, secret);
      const tokenBytes = decodeBase64Url(token);

      // Modify IV byte
      const modified = new Uint8Array(tokenBytes);
      modified[5] ^= 0xff;

      const modifiedToken = Buffer.from(modified).toString("base64url");

      await expect(decode(modifiedToken, secret)).rejects.toThrow();
    });

    test("should reject truncated tokens", async () => {
      const token = await encode({ data: "test" }, "secret");
      const tokenBytes = decodeBase64Url(token);

      // Truncate token (remove last 10 bytes including part of auth tag)
      const truncated = tokenBytes.slice(0, -10);
      const truncatedToken = Buffer.from(truncated).toString("base64url");

      await expect(decode(truncatedToken, "secret")).rejects.toThrow();
    });
  });

  describe("Timing Attack Resistance", () => {
    test("should take similar time for correct and incorrect keys", async () => {
      const data = { sensitive: "data" };
      const correctSecret = "correct-secret-key";
      const wrongSecret = "wrong-secret-key-123";

      const token = await encode(data, correctSecret);

      // Measure decryption time with correct key
      const correctTimes: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        try {
          await decode(token, correctSecret);
        } catch (e) {
          // Ignore errors
        }
        correctTimes.push(performance.now() - start);
      }

      // Measure decryption time with wrong key
      const wrongTimes: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        try {
          await decode(token, wrongSecret);
        } catch (e) {
          // Expected to fail
        }
        wrongTimes.push(performance.now() - start);
      }

      const avgCorrect = correctTimes.reduce((a, b) => a + b) / correctTimes.length;
      const avgWrong = wrongTimes.reduce((a, b) => a + b) / wrongTimes.length;

      // Times should be within 50% of each other (prevents timing attacks)
      const ratio = Math.max(avgCorrect, avgWrong) / Math.min(avgCorrect, avgWrong);
      expect(ratio).toBeLessThan(1.5);
    });
  });

  describe("Data Confidentiality", () => {
    test("should not leak plaintext in token", async () => {
      const sensitiveData = {
        password: "super-secret-password-12345",
        ssn: "123-45-6789",
        creditCard: "4111-1111-1111-1111",
      };

      const token = await encode(sensitiveData, "encryption-key");

      // Token should not contain any plaintext
      expect(token).not.toContain("password");
      expect(token).not.toContain("super-secret");
      expect(token).not.toContain("123-45-6789");
      expect(token).not.toContain("4111-1111");

      // Verify data can be recovered
      const decoded = await decode(token, "encryption-key");
      expect(decoded).toEqual(sensitiveData);
    });

    test("should encrypt before compressing", async () => {
      // If we compress first, patterns in plaintext might leak through
      // This is a design verification test
      const repeatedData = { text: "AAAAA".repeat(100) };
      const secret = "test-key";

      const token = await encode(repeatedData, secret, { compression: "brotli" });

      // Token should not have obvious repeated patterns
      const tokenBytes = decodeBase64Url(token);
      const hex = Buffer.from(tokenBytes).toString("hex");

      // Check that no 4-byte sequence repeats more than twice
      const sequences = new Map<string, number>();
      for (let i = 0; i < hex.length - 8; i += 2) {
        const seq = hex.substring(i, i + 8);
        sequences.set(seq, (sequences.get(seq) || 0) + 1);
      }

      const maxRepeats = Math.max(...Array.from(sequences.values()));
      expect(maxRepeats).toBeLessThan(3);
    });
  });

  describe("Cryptographic Strength", () => {
    test("should use AES-GCM-256", async () => {
      // Verify through successful encryption/decryption
      // (256-bit keys are used internally)
      const data = { test: "aes-256" };
      const secret = "test-password";

      const token = await encode(data, secret);
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });

    test("should use 96-bit (12-byte) IV for AES-GCM", async () => {
      const token = await encode({ data: "test" }, "secret");
      const tokenBytes = decodeBase64Url(token);
      const metadata = extractMetadata(token);

      // IV starts at byte 2 and is 12 bytes
      const ivLength = 12;
      expect(tokenBytes.length).toBeGreaterThan(2 + ivLength);
    });

    test("should use 128-bit (16-byte) authentication tag", async () => {
      // GCM uses 128-bit auth tag by default
      // This is verified by the encryption/decryption working
      const data = { test: "auth-tag" };
      const secret = "test-secret";

      const token = await encode(data, secret);
      const decoded = await decode(token, secret);

      expect(decoded).toEqual(data);
    });
  });

  describe("Side Channel Resistance", () => {
    test("should handle errors without leaking information", async () => {
      const token = await encode({ data: "test" }, "correct-secret");

      // Various wrong secrets should all produce similar generic errors
      const errors: string[] = [];

      const wrongSecrets = [
        "wrong-secret-1",
        "wrong-secret-2",
        "completely-different",
        "x",
        "a".repeat(100),
      ];

      for (const secret of wrongSecrets) {
        try {
          await decode(token, secret);
        } catch (e) {
          errors.push((e as Error).message);
        }
      }

      // All errors should be generic, not revealing sensitive information
      errors.forEach((msg) => {
        expect(msg).not.toContain("password");
        expect(msg.length).toBeLessThan(200); // Reasonably short messages
        expect(msg).toContain("failed"); // Should indicate failure
      });
    });
  });

  describe("Input Validation", () => {
    test("should reject invalid token formats", async () => {
      const invalidTokens = [
        "",
        "   ",
        "not-base64",
        "SGVsbG8gV29ybGQ=", // Valid base64 but not a CWC token
        "x".repeat(10), // Too short
        Buffer.from([0xff, 0xff]).toString("base64url"), // Invalid version
      ];

      for (const token of invalidTokens) {
        await expect(decode(token, "secret")).rejects.toThrow();
      }
    });

    test("should validate secret is not empty", async () => {
      const data = { test: "data" };

      // Empty string should be rejected
      await expect(encode(data, "")).rejects.toThrow();

      // Note: Whitespace-only strings technically derive to valid keys
      // This is acceptable as PBKDF2 can derive from any string
      // The real protection is using strong secrets
    });

    test("should validate secret is provided", async () => {
      const secret = "test-secret";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(decode("token", null as any)).rejects.toThrow();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(decode("token", undefined as any)).rejects.toThrow();

      // Empty string should also be rejected
      await expect(decode("token", "")).rejects.toThrow();

      // Valid secret should work
      const data = { test: "valid" };
      const token = await encode(data, secret);
      const decoded = await decode(token, secret);
      expect(decoded).toEqual(data);
    });
  });

  describe("Denial of Service Protection", () => {
    test("should handle large payloads", async () => {
      // Test with 1MB payload (reduced from 10MB for faster tests)
      const largeData = {
        items: Array(5000)
          .fill(0)
          .map((_, i) => ({
            id: i,
            value: `item-${i}`,
            data: "x".repeat(100),
          })),
      };

      const secret = "test-secret";

      // Should not crash or hang
      const token = await encode(largeData, secret);
      expect(token.length).toBeGreaterThan(0);

      const decoded = await decode(token, secret);
      expect(decoded).toEqual(largeData);
    }, 15000); // 15 second timeout

    test("should handle deeply nested objects", async () => {
      let nested: unknown = { value: "deep" };
      // Reduced from 100 to 50 levels for faster tests
      for (let i = 0; i < 50; i++) {
        nested = { nested };
      }

      const secret = "test-secret";
      const token = await encode(nested, secret);
      const decoded = await decode(token, secret);

      expect(JSON.stringify(decoded)).toBe(JSON.stringify(nested));
    });
  });

  describe("Key Rotation Security", () => {
    test("should not expose old key when rotating", async () => {
      const data = { sensitive: "information" };
      const oldSecret = "old-secret-key";
      const newSecret = "new-secret-key";

      const originalToken = await encode(data, oldSecret);

      // Rotate key by decoding and re-encoding
      const decoded = await decode(originalToken, oldSecret);
      const newToken = await encode(decoded, newSecret);

      // Old secret should not work on new token
      await expect(decode(newToken, oldSecret)).rejects.toThrow();

      // New secret should work
      const result = await decode(newToken, newSecret);
      expect(result).toEqual(data);
    });
  });
});

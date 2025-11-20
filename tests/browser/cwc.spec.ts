import { test, expect } from "@playwright/test";

/**
 * Browser Compatibility Tests for CWC
 * Tests core functionality in Chromium, Firefox, and WebKit
 */

declare global {
  interface Window {
    cwcReady?: boolean;
    cwc?: {
      encode: (data: unknown, secret: string | Uint8Array, options?: unknown) => Promise<string>;
      decode: (token: string, secret: string | Uint8Array) => Promise<unknown>;
      rotateKey: (
        token: string,
        oldSecret: string | Uint8Array,
        newSecret: string | Uint8Array
      ) => Promise<string>;
      decodeWithKeyFallback: (
        token: string,
        secrets: Array<string | Uint8Array>
      ) => Promise<unknown>;
      isExpired: (token: string) => boolean;
      validateNotExpired: (token: string) => void;
      getRemainingTime: (token: string) => number;
      encodeWithMetadata: (
        data: unknown,
        secret: string | Uint8Array,
        customMetadata: unknown
      ) => Promise<string>;
      decodeWithMetadata: (
        token: string,
        secret: string | Uint8Array
      ) => Promise<{ data: unknown; metadata: unknown }>;
      encodeStream: (
        data: unknown,
        secret: string | Uint8Array,
        options?: unknown
      ) => Promise<string[]>;
      decodeStream: (chunks: string[], secret: string | Uint8Array) => Promise<unknown>;
      selectCompressionAlgorithm: (data: unknown) => string;
    };
  }
}

test.describe("CWC Browser Compatibility", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto("http://localhost:3000/tests/browser/test-page.html", { waitUntil: "networkidle" });

    // Wait for CWC to load
    await page.waitForFunction(() => window.cwcReady === true, { timeout: 15000 });
  });

  test("should load CWC library successfully", async ({ page, browserName }) => {
    const ready = await page.evaluate(() => window.cwcReady);
    expect(ready).toBe(true);

    console.log(`✓ CWC loaded in ${browserName}`);
  });

  test("should encode and decode data", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const data = { test: "browser-test", value: 12345 };
      const secret = "my-secret-key";

      const token = await window.cwc!.encode(data, secret);
      const decoded = (await window.cwc!.decode(token, secret)) as { test: string; value: number };

      return {
        token: token,
        decoded: decoded,
        matches: decoded.test === "browser-test" && decoded.value === 12345,
      };
    });

    expect(result.matches).toBe(true);
    expect(result.token).toBeTruthy();
    expect(typeof result.token).toBe("string");
  });

  test("should handle different data types", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const secret = "test-key";
      const testCases = [
        { value: "string", expected: "string" },
        { value: 12345, expected: 12345 },
        { value: true, expected: true },
        { value: null, expected: null },
        { value: [1, 2, 3], expected: [1, 2, 3] },
        { value: { nested: { deep: "value" } }, expected: { nested: { deep: "value" } } },
      ];

      const results = [];
      for (const testCase of testCases) {
        const token = await window.cwc!.encode(testCase.value, secret);
        const decoded = await window.cwc!.decode(token, secret);
        results.push({
          passed: JSON.stringify(decoded) === JSON.stringify(testCase.expected),
          decoded,
        });
      }

      return results;
    });

    result.forEach((r, i) => {
      expect(r.passed).toBe(true);
    });
  });

  test("should handle compression options", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const data = { message: "test".repeat(100) };
      const secret = "test-key";

      const tokenBrotli = await window.cwc!.encode(data, secret, { compression: "brotli" });
      const tokenLz = await window.cwc!.encode(data, secret, { compression: "lz-string" });
      const tokenNone = await window.cwc!.encode(data, secret, { compression: "none" });

      const decodedBrotli = (await window.cwc!.decode(tokenBrotli, secret)) as { message: string };
      const decodedLz = (await window.cwc!.decode(tokenLz, secret)) as { message: string };
      const decodedNone = (await window.cwc!.decode(tokenNone, secret)) as { message: string };

      return {
        allMatch:
          decodedBrotli.message === data.message &&
          decodedLz.message === data.message &&
          decodedNone.message === data.message,
        sizes: {
          brotli: tokenBrotli.length,
          lz: tokenLz.length,
          none: tokenNone.length,
        },
      };
    });

    expect(result.allMatch).toBe(true);
    expect(result.sizes.brotli).toBeLessThan(result.sizes.none);
    expect(result.sizes.lz).toBeLessThan(result.sizes.none);
  });

  test("should support key rotation", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const data = { message: "rotation test" };
      const oldSecret = "old-key";
      const newSecret = "new-key";

      const token = await window.cwc!.encode(data, oldSecret);
      const rotatedToken = await window.cwc!.rotateKey(token, oldSecret, newSecret);
      const decoded = (await window.cwc!.decode(rotatedToken, newSecret)) as { message: string };

      return {
        matches: decoded.message === "rotation test",
        tokensDifferent: token !== rotatedToken,
      };
    });

    expect(result.matches).toBe(true);
    expect(result.tokensDifferent).toBe(true);
  });

  test("should support key fallback", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const data = { value: 42 };
      const key1 = "key-1";
      const key2 = "key-2";
      const key3 = "key-3";

      const token = await window.cwc!.encode(data, key2);
      const decoded = (await window.cwc!.decodeWithKeyFallback(token, [key1, key2, key3])) as {
        value: number;
      };

      return {
        matches: decoded.value === 42,
        usedCorrectKey: true,
      };
    });

    expect(result.matches).toBe(true);
  });

  test("should validate TTL expiration", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const data = { test: "ttl" };
      const secret = "test-key";

      // Create token with 2 second TTL
      const token = await window.cwc!.encode(data, secret, { ttl: 2000 });

      // Should not be expired immediately
      const notExpired = !window.cwc!.isExpired(token);

      // Get remaining time
      const remaining = window.cwc!.getRemainingTime(token);
      const hasTime = remaining > 0 && remaining <= 2000;

      return { notExpired, hasTime };
    });

    expect(result.notExpired).toBe(true);
    expect(result.hasTime).toBe(true);
  });

  test("should support custom metadata", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const data = { value: "test" };
      const secret = "test-key";
      const customMeta = { userId: "123", sessionId: "abc" };

      const token = await window.cwc!.encodeWithMetadata(data, secret, customMeta);
      const result = await window.cwc!.decodeWithMetadata(token, secret);
      const decoded = result.data as { value: string };
      const metadata = result.metadata as { userId: string; sessionId: string };

      return {
        dataMatches: decoded.value === "test",
        metadataMatches: metadata.userId === "123" && metadata.sessionId === "abc",
      };
    });

    expect(result.dataMatches).toBe(true);
    expect(result.metadataMatches).toBe(true);
  });

  test("should handle streaming for large payloads", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const largeData = {
        items: Array(500)
          .fill(0)
          .map((_, i) => ({ id: i, value: `item-${i}` })),
      };
      const secret = "test-key";

      const chunks = await window.cwc!.encodeStream(largeData, secret, {
        chunkSize: 1024 * 10,
      });

      const decoded = (await window.cwc!.decodeStream(chunks, secret)) as {
        items: Array<{ id: number; value: string }>;
      };

      return {
        chunkCount: chunks.length,
        dataMatches: decoded.items.length === 500 && decoded.items[0].id === 0,
      };
    });

    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.dataMatches).toBe(true);
  });

  test("should select compression algorithm automatically", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const textData = { text: "hello world ".repeat(100) };
      const randomData = { random: Math.random().toString(36).repeat(100) };

      const textAlgo = window.cwc!.selectCompressionAlgorithm(textData);
      const randomAlgo = window.cwc!.selectCompressionAlgorithm(randomData);

      return {
        textAlgo,
        randomAlgo,
        bothValid:
          ["brotli", "lz-string", "zlib", "none"].includes(textAlgo) &&
          ["brotli", "lz-string", "zlib", "none"].includes(randomAlgo),
      };
    });

    expect(result.bothValid).toBe(true);
  });

  test("should handle errors gracefully", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const errors = [];

      // Test wrong secret
      try {
        const token = await window.cwc!.encode({ data: "test" }, "secret1");
        await window.cwc!.decode(token, "wrong-secret");
        errors.push({ test: "wrong-secret", caught: false });
      } catch (e) {
        errors.push({ test: "wrong-secret", caught: true, message: (e as Error).message });
      }

      // Test corrupted token
      try {
        await window.cwc!.decode("corrupted-token-xyz", "secret");
        errors.push({ test: "corrupted", caught: false });
      } catch (e) {
        errors.push({ test: "corrupted", caught: true, message: (e as Error).message });
      }

      // Test empty secret
      try {
        await window.cwc!.encode({ data: "test" }, "");
        errors.push({ test: "empty-secret", caught: false });
      } catch (e) {
        errors.push({ test: "empty-secret", caught: true, message: (e as Error).message });
      }

      return errors;
    });

    expect(result.length).toBe(3);
    expect(result.every((e) => e.caught)).toBe(true);
  });

  test("should verify Web Crypto API usage", async ({ page, browserName }) => {
    const cryptoInfo = await page.evaluate(() => {
      return {
        hasCrypto: typeof crypto !== "undefined",
        hasSubtle: typeof crypto?.subtle !== "undefined",
        hasRandomValues: typeof crypto?.getRandomValues === "function",
        hasEncrypt: typeof crypto?.subtle?.encrypt === "function",
        hasDecrypt: typeof crypto?.subtle?.decrypt === "function",
        hasImportKey: typeof crypto?.subtle?.importKey === "function",
      };
    });

    expect(cryptoInfo.hasCrypto).toBe(true);
    expect(cryptoInfo.hasSubtle).toBe(true);
    expect(cryptoInfo.hasRandomValues).toBe(true);
    expect(cryptoInfo.hasEncrypt).toBe(true);
    expect(cryptoInfo.hasDecrypt).toBe(true);
    expect(cryptoInfo.hasImportKey).toBe(true);

    console.log(`✓ Web Crypto API fully available in ${browserName}`);
  });

  test("should handle Uint8Array correctly", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const data = { binary: "data" };

      // Test with string secret
      const token1 = await window.cwc!.encode(data, "string-secret");
      const decoded1 = (await window.cwc!.decode(token1, "string-secret")) as { binary: string };

      // Test with Uint8Array secret
      const keyBytes = new Uint8Array(32);
      crypto.getRandomValues(keyBytes);
      const token2 = await window.cwc!.encode(data, keyBytes);
      const decoded2 = (await window.cwc!.decode(token2, keyBytes)) as { binary: string };

      return {
        stringWorks: decoded1.binary === "data",
        uint8Works: decoded2.binary === "data",
      };
    });

    expect(result.stringWorks).toBe(true);
    expect(result.uint8Works).toBe(true);
  });
});

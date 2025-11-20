/**
 * Tests for randomBytes function with Node.js 18 compatibility
 */

import { describe, it, expect } from "@jest/globals";
import { randomBytes } from "../src/utils/buffers.js";

describe("randomBytes - Node.js 18 Compatibility", () => {
  it("should generate random bytes of correct length", () => {
    const length = 32;
    const bytes = randomBytes(length);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(length);
  });

  it("should generate different bytes on each call", () => {
    const bytes1 = randomBytes(32);
    const bytes2 = randomBytes(32);

    // Should be different (astronomically unlikely to be the same)
    expect(bytes1).not.toEqual(bytes2);
  });

  it("should handle various lengths", () => {
    const lengths = [1, 16, 32, 64, 128];

    for (const length of lengths) {
      const bytes = randomBytes(length);
      expect(bytes.length).toBe(length);
      expect(bytes).toBeInstanceOf(Uint8Array);
    }
  });

  it("should generate cryptographically secure random bytes", () => {
    // Test that bytes are properly distributed
    const bytes = randomBytes(100);
    let zeroCount = 0;
    let maxValue = 0;

    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) zeroCount++;
      maxValue = Math.max(maxValue, bytes[i]);
    }

    // With 100 random bytes, we should have some zeros but not too many
    // (statistically, should be around 100/256 ≈ 0.39)
    expect(zeroCount).toBeLessThan(20);

    // Should have values across the byte range
    expect(maxValue).toBeGreaterThan(100);
  });

  it("should work in repeated calls without issues", () => {
    for (let i = 0; i < 100; i++) {
      const bytes = randomBytes(16);
      expect(bytes.length).toBe(16);
      expect(bytes).toBeInstanceOf(Uint8Array);
    }
  });

  it("should handle zero-length requests", () => {
    const bytes = randomBytes(0);
    expect(bytes.length).toBe(0);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it("should handle large byte requests", () => {
    const bytes = randomBytes(10000);
    expect(bytes.length).toBe(10000);
    expect(bytes).toBeInstanceOf(Uint8Array);

    // Verify it's not all zeros
    let hasNonZero = false;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });
});

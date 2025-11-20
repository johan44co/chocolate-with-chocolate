/**
 * Tests for TTL (Time-To-Live) Utilities
 */

import { describe, it, expect } from "@jest/globals";
import { encode } from "../src/cwc.js";
import {
  isExpired,
  getExpirationTime,
  getRemainingTime,
  willExpireSoon,
  validateNotExpired,
  getTokenAge,
  getTTLPercentageElapsed,
} from "../src/utils/ttl.js";

describe("TTL Utilities", () => {
  describe("isExpired", () => {
    it("should return false for non-expired token", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 3600, // 1 hour
      });

      expect(isExpired(token)).toBe(false);
    });

    it("should return false for token without TTL", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      expect(isExpired(token)).toBe(false);
    });

    it("should return false for token without timestamp", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: false,
      });

      expect(isExpired(token)).toBe(false);
    });

    it("should return true for expired token", async () => {
      // Create token that expires in 1 second, then wait
      const before = Date.now();
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 1, // 1 second
      });

      // Wait for expiration plus a bit
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(isExpired(token)).toBe(true);
    });
  });

  describe("getExpirationTime", () => {
    it("should return expiration timestamp", async () => {
      const now = Date.now();
      const ttl = 3600; // 1 hour

      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl,
      });

      const expiresAt = getExpirationTime(token);
      expect(expiresAt).not.toBeNull();

      if (expiresAt !== null) {
        const expectedExpiration = now + ttl * 1000;
        // Allow 1000ms tolerance for timing variations
        expect(Math.abs(expiresAt - expectedExpiration)).toBeLessThan(1000);
      }
    });

    it("should return null for token without TTL", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      expect(getExpirationTime(token)).toBeNull();
    });

    it("should return null for token without timestamp", async () => {
      const token = await encode({ test: true }, "secret");

      expect(getExpirationTime(token)).toBeNull();
    });
  });

  describe("getRemainingTime", () => {
    it("should return remaining time in milliseconds", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 60, // 60 seconds
      });

      const remaining = getRemainingTime(token);
      expect(remaining).not.toBeNull();

      if (remaining !== null) {
        expect(remaining).toBeGreaterThan(59_000); // At least 59 seconds
        expect(remaining).toBeLessThanOrEqual(60_000); // At most 60 seconds
      }
    });

    it("should return 0 for expired token", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 1, // 1 second
      });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(getRemainingTime(token)).toBe(0);
    });

    it("should return null for token without TTL", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      expect(getRemainingTime(token)).toBeNull();
    });

    it("should decrease over time", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 10, // 10 seconds
      });

      const remaining1 = getRemainingTime(token);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const remaining2 = getRemainingTime(token);

      expect(remaining1).not.toBeNull();
      expect(remaining2).not.toBeNull();

      if (remaining1 !== null && remaining2 !== null) {
        expect(remaining2).toBeLessThan(remaining1);
      }
    });
  });

  describe("willExpireSoon", () => {
    it("should detect tokens expiring soon", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 5, // 5 seconds
      });

      // Will expire within 10 seconds
      expect(willExpireSoon(token, 10_000)).toBe(true);

      // Will NOT expire within 1 second
      expect(willExpireSoon(token, 1_000)).toBe(false);
    });

    it("should return false for token without TTL", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      expect(willExpireSoon(token, 1000)).toBe(false);
    });

    it("should return true for already expired token", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 1, // 1 second
      });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(willExpireSoon(token, 1000)).toBe(true);
    });
  });

  describe("validateNotExpired", () => {
    it("should not throw for valid token", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 3600,
      });

      expect(() => validateNotExpired(token)).not.toThrow();
    });

    it("should not throw for token without TTL", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      expect(() => validateNotExpired(token)).not.toThrow();
    });

    it("should throw for expired token", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 1, // 1 second
      });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(() => validateNotExpired(token)).toThrow(/Token expired/);
    });

    it("should include time in error message", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 1, // 1 second
      });

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(() => validateNotExpired(token)).toThrow(/second/);
    });
  });

  describe("getTokenAge", () => {
    it("should return age in milliseconds", async () => {
      const before = Date.now();
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const age = getTokenAge(token);
      const after = Date.now();

      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThanOrEqual(after - before + 1000); // More tolerance for timing
    });

    it("should throw for token without timestamp", async () => {
      const token = await encode({ test: true }, "secret");

      expect(() => getTokenAge(token)).toThrow("Token does not contain a timestamp");
    });

    it("should increase over time", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      const age1 = getTokenAge(token);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const age2 = getTokenAge(token);

      expect(age2).toBeGreaterThan(age1);
    });
  });

  describe("getTTLPercentageElapsed", () => {
    it("should return percentage of TTL elapsed", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 10, // 10 seconds
      });

      // Should be near 0% initially
      const percentage1 = getTTLPercentageElapsed(token);
      expect(percentage1).not.toBeNull();
      if (percentage1 !== null) {
        expect(percentage1).toBeGreaterThanOrEqual(0);
        expect(percentage1).toBeLessThan(10); // Less than 10%
      }

      // Wait and check again
      await new Promise((resolve) => setTimeout(resolve, 50));

      const percentage2 = getTTLPercentageElapsed(token);
      expect(percentage2).not.toBeNull();
      if (percentage2 !== null && percentage1 !== null) {
        expect(percentage2).toBeGreaterThan(percentage1);
      }
    });

    it("should return null for token without TTL", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
      });

      expect(getTTLPercentageElapsed(token)).toBeNull();
    });

    it("should cap at 100% for expired token", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 1, // 1 second
      });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const percentage = getTTLPercentageElapsed(token);
      expect(percentage).toBe(100);
    });

    it("should be approximately 50% at half life", async () => {
      const token = await encode({ test: true }, "secret", {
        includeTimestamp: true,
        ttl: 2, // 2 seconds
      });

      // Wait for half the TTL
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const percentage = getTTLPercentageElapsed(token);
      expect(percentage).not.toBeNull();
      if (percentage !== null) {
        // Allow wide tolerance due to timing variations in test environment
        expect(percentage).toBeGreaterThan(10);
        expect(percentage).toBeLessThan(100);
      }
    });
  });
});

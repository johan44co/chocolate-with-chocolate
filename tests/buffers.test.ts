/**
 * Tests for buffer utility functions
 */

import { describe, it, expect } from "@jest/globals";
import {
  stringToBytes,
  bytesToString,
  concatBytes,
  areEqual,
  copyBytes,
  randomBytes,
  hexToBytes,
  bytesToHex,
  sliceBytes,
  isUint8Array,
} from "../src/utils/buffers.js";

describe("buffer utilities", () => {
  describe("stringToBytes / bytesToString", () => {
    it("should convert simple ASCII string", () => {
      const str = "Hello";
      const bytes = stringToBytes(str);
      expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
      expect(bytesToString(bytes)).toBe(str);
    });

    it("should handle UTF-8 characters", () => {
      const str = "Hello 世界 🌍";
      const bytes = stringToBytes(str);
      const decoded = bytesToString(bytes);
      expect(decoded).toBe(str);
    });

    it("should handle empty string", () => {
      const bytes = stringToBytes("");
      expect(bytes).toEqual(new Uint8Array([]));
      expect(bytesToString(bytes)).toBe("");
    });

    it("should handle emojis", () => {
      const str = "🎉🎊🎈";
      const bytes = stringToBytes(str);
      expect(bytesToString(bytes)).toBe(str);
    });
  });

  describe("concatBytes", () => {
    it("should concatenate multiple arrays", () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const c = new Uint8Array([5, 6]);
      const result = concatBytes(a, b, c);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it("should handle empty arrays", () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([]);
      const c = new Uint8Array([3, 4]);
      const result = concatBytes(a, b, c);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it("should handle single array", () => {
      const a = new Uint8Array([1, 2, 3]);
      const result = concatBytes(a);
      expect(result).toEqual(a);
      expect(result).not.toBe(a); // Should be a copy
    });

    it("should handle no arrays", () => {
      const result = concatBytes();
      expect(result).toEqual(new Uint8Array([]));
    });
  });

  describe("areEqual", () => {
    it("should return true for equal arrays", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      expect(areEqual(a, b)).toBe(true);
    });

    it("should return false for different arrays", () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 4]);
      expect(areEqual(a, b)).toBe(false);
    });

    it("should return false for different lengths", () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([1, 2, 3]);
      expect(areEqual(a, b)).toBe(false);
    });

    it("should return true for empty arrays", () => {
      const a = new Uint8Array([]);
      const b = new Uint8Array([]);
      expect(areEqual(a, b)).toBe(true);
    });
  });

  describe("copyBytes", () => {
    it("should create a copy of array", () => {
      const original = new Uint8Array([1, 2, 3]);
      const copy = copyBytes(original);
      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
    });

    it("should not affect original when copy is modified", () => {
      const original = new Uint8Array([1, 2, 3]);
      const copy = copyBytes(original);
      copy[0] = 99;
      expect(original[0]).toBe(1);
      expect(copy[0]).toBe(99);
    });
  });

  describe("randomBytes", () => {
    it("should generate bytes of correct length", () => {
      const bytes = randomBytes(16);
      expect(bytes.length).toBe(16);
    });

    it("should generate different values each time", () => {
      const a = randomBytes(16);
      const b = randomBytes(16);
      expect(areEqual(a, b)).toBe(false);
    });

    it("should handle zero length", () => {
      const bytes = randomBytes(0);
      expect(bytes.length).toBe(0);
    });

    it("should generate large arrays", () => {
      const bytes = randomBytes(1000);
      expect(bytes.length).toBe(1000);
    });
  });

  describe("hexToBytes / bytesToHex", () => {
    it("should convert hex to bytes", () => {
      const hex = "48656c6c6f";
      const bytes = hexToBytes(hex);
      expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it("should convert bytes to hex", () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe("48656c6c6f");
    });

    it("should handle 0x prefix", () => {
      const hex = "0x48656c6c6f";
      const bytes = hexToBytes(hex);
      expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it("should add 0x prefix when requested", () => {
      const bytes = new Uint8Array([255, 0, 127]);
      const hex = bytesToHex(bytes, true);
      expect(hex).toBe("0xff007f");
    });

    it("should round-trip hex conversion", () => {
      const original = new Uint8Array([0, 1, 255, 128, 64]);
      const hex = bytesToHex(original);
      const decoded = hexToBytes(hex);
      expect(decoded).toEqual(original);
    });

    it("should handle uppercase hex", () => {
      const hex = "ABCDEF";
      const bytes = hexToBytes(hex);
      expect(bytesToHex(bytes)).toBe("abcdef");
    });

    it("should throw on invalid hex", () => {
      expect(() => hexToBytes("xyz")).toThrow();
      expect(() => hexToBytes("123")).toThrow(); // odd length
    });

    it("should handle empty hex", () => {
      const bytes = hexToBytes("");
      expect(bytes).toEqual(new Uint8Array([]));
      expect(bytesToHex(new Uint8Array([]))).toBe("");
    });
  });

  describe("sliceBytes", () => {
    it("should slice array", () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const sliced = sliceBytes(bytes, 1, 4);
      expect(sliced).toEqual(new Uint8Array([2, 3, 4]));
    });

    it("should slice from start", () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const sliced = sliceBytes(bytes, 2);
      expect(sliced).toEqual(new Uint8Array([3, 4, 5]));
    });

    it("should handle negative indices", () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const sliced = sliceBytes(bytes, -2);
      expect(sliced).toEqual(new Uint8Array([4, 5]));
    });
  });

  describe("isUint8Array", () => {
    it("should return true for Uint8Array", () => {
      expect(isUint8Array(new Uint8Array([]))).toBe(true);
      expect(isUint8Array(new Uint8Array([1, 2, 3]))).toBe(true);
    });

    it("should return false for other types", () => {
      expect(isUint8Array([])).toBe(false);
      expect(isUint8Array([1, 2, 3])).toBe(false);
      expect(isUint8Array("hello")).toBe(false);
      expect(isUint8Array(123)).toBe(false);
      expect(isUint8Array(null)).toBe(false);
      expect(isUint8Array(undefined)).toBe(false);
      expect(isUint8Array({})).toBe(false);
    });
  });
});

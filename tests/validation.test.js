import { describe, expect, it } from "vitest";
import {
  validateInteger, validateSeed, validateLevel, validateVaultPercentage, validateCardId
} from "../src/validation.js";

describe("shared input validation", () => {
  it("returns finite integer boundaries and supports contextual limits", () => {
    expect(validateInteger(0)).toBe(0);
    expect(validateInteger(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(validateInteger(3, "openings", 1, 3)).toBe(3);
    expect(validateInteger(5, "custom", 1)).toBe(5);
    expect(() => validateInteger(0, "openings", 1, 3)).toThrow("openings must be an integer from 1 to 3");
    expect(() => validateInteger(4, "openings", 1, 3)).toThrow("openings");
  });

  it.each([undefined, null, "1", NaN, Infinity, 1.5])("rejects non-integers %s", (value) => {
    expect(() => validateInteger(value)).toThrow("value must be an integer");
  });

  it("accepts signed int32 seeds and integer levels with contextual labels", () => {
    expect(validateSeed(-2147483648)).toBe(-2147483648);
    expect(validateSeed(2147483647, "imported seed")).toBe(2147483647);
    expect(validateLevel(1)).toBe(1);
    expect(validateLevel(100, "maxLevel")).toBe(100);
    expect(() => validateLevel(0, "maxLevel")).toThrow("maxLevel");
  });

  it("accepts fractional vault percentages but rejects non-finite or out-of-range values", () => {
    expect(validateVaultPercentage(0)).toBe(0);
    expect(validateVaultPercentage(100)).toBe(100);
    expect(validateVaultPercentage(12.5, "vault")).toBe(12.5);
    for (const value of [NaN, Infinity, "50", -1, 101]) {
      expect(() => validateVaultPercentage(value, "vault")).toThrow("vault must be a number from 0 to 100");
    }
  });

  it("accepts mapped cards and rejects inherited and unknown IDs", () => {
    expect(validateCardId("big")).toBe("big");
    expect(validateCardId("event_Alchemist")).toBe("event_Alchemist");
    expect(validateCardId("egg_Ultimate")).toBe("egg_Ultimate");
    expect(() => validateCardId("constructor")).toThrow("unknown chest type: constructor");
  });
});

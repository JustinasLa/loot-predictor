import { describe, expect, it, vi } from "vitest";
import { UnityRandom } from "../src/rng/unity-random.js";

// Golden integer draws from System.Random.Next() on the .NET Framework.
// Samples span both circular-buffer boundaries and more than two full cycles.
const vectors = [
  [0,
    [1559595546, 1755192844, 1649316166, 1198642031, 442452829, 1200195957, 1945678308, 949569752],
    [1331075398, 1047903413, 418573418, 1885901857, 1772582790, 1579254086, 1843011714],
    [1455159704, 1223768777, 484049542, 1327536041]],
  [1,
    [534011718, 237820880, 1002897798, 1657007234, 1412011072, 929393559, 760389092, 2026928803],
    [744291659, 1485403625, 848563345, 333461483, 2039758977, 182621155, 2090911250],
    [2113437503, 1398633607, 1835196615, 1501688522]],
  [42,
    [1434747710, 302596119, 269548474, 1122627734, 361709742, 563913476, 1555655117, 1101493307],
    [308478477, 95559494, 1298281176, 1107915559, 109080762, 902729453, 1517373991],
    [1185539851, 2125640696, 1397651786, 52005655]],
  [2147483647,
    [1559595546, 1755192844, 1649316172, 1198642031, 442452829, 1200195955, 1945678308, 949569752],
    [1331075398, 1047903443, 418573420, 1885901857, 1772582790, 1579254100, 1843011714],
    [1455159704, 1223768777, 484049556, 1327536029]],
  [-2147483648,
    [1559595546, 1755192844, 1649316172, 1198642031, 442452829, 1200195955, 1945678308, 949569752],
    [1331075398, 1047903443, 418573420, 1885901857, 1772582790, 1579254100, 1843011714],
    [1455159704, 1223768777, 484049556, 1327536029]],
];

describe("UnityRandom", () => {
  it.each(vectors)("matches C# draws for seed %i", (seed, first, wrapped, last) => {
    const rng = new UnityRandom(seed);
    const values = Array.from({ length: 120 }, () => Math.round(rng.sample() * 2147483647));
    expect(values.slice(0, 8)).toEqual(first);
    expect(values.slice(52, 59)).toEqual(wrapped);
    expect(values.slice(116)).toEqual(last);
  });

  it("matches negative seeds and rewinds on initState", () => {
    const positive = new UnityRandom(42);
    const negative = new UnityRandom(-42);
    expect(Array.from({ length: 200 }, () => negative.sample()))
      .toEqual(Array.from({ length: 200 }, () => positive.sample()));
    negative.initState(1);
    expect(negative.range(0, 2147483647)).toBe(534011718);
  });

  it("uses a half-open integer range including negative bounds", () => {
    const rng = new UnityRandom(0);
    expect(rng.range(0, 100)).toBe(72);
    expect(rng.range(-10, 10)).toBe(6);
    expect(rng.range(5, 6)).toBe(5);
    for (let i = 0; i < 200; i++) {
      const value = rng.range(-3, 3);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(3);
    }
  });

  it.each([[3, 3], [5, 2]])("returns min for invalid bounds %i..%i without drawing", (min, max) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const rng = new UnityRandom(1);
    expect(rng.range(min, max)).toBe(min);
    expect(error).toHaveBeenCalledOnce();
    expect(rng.range(0, 2147483647)).toBe(534011718);
  });
});

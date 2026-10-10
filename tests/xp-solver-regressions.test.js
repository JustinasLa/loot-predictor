import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { simulateAdventureChestOpening } from "../src/loot/simulate.js";
import { totalXp } from "../src/loot/xp.js";
import { findOptimalXpPath } from "../src/solver/xp-path.js";

const options = {
  startSeed: 42, cardId: "adventure_Zeus", eventType: "Zeus",
  maxLevel: 5, vaultPercentage: 0, openings: 2
};
const solverUrl = new URL("../src/solver/xp-path.js", import.meta.url).href;

function checkReplay(solution, input) {
  let seed = input.startSeed;
  let remaining = input.openings;
  let xp = 0;
  for (const step of solution.path) {
    expect(remaining).toBeGreaterThan(0);
    expect(step.usedSeed).toBe(seed);
    const result = simulateAdventureChestOpening(
      seed, step.level, input.eventType, input.vaultPercentage, input.cardId
    );
    expect(step.items).toEqual(result.items);
    expect(step.xp).toBe(totalXp(result.items));
    xp += step.xp;
    remaining += result.items.filter((item) => item.baseName.endsWith("KeyIcon")).length - 1;
    seed = result.nextSeed;
  }
  expect(solution.xp).toBe(xp);
  return remaining;
}

describe("XP solver regression coverage", () => {
  it("keeps a coherent partial route when asynchronous progress cancels a search", async () => {
    let stopped = false;
    const progress = vi.fn(async () => {
      await Promise.resolve();
      stopped = true;
    });
    const solution = await findOptimalXpPath({
      ...options, onProgress: progress, shouldStop: () => stopped
    });
    expect(solution).toMatchObject({ stopped: true, nodesVisited: 1, truncated: false });
    expect(solution.path).toHaveLength(1);
    expect(solution.xp).toBeGreaterThan(0);
    expect(checkReplay(solution, options)).toBe(1);
  });

  it("preserves the winning snapshot while other routes are explored", async () => {
    const input = { ...options, vaultPercentage: 50, maxOpens: 4 };
    let expected = -1;
    function enumerate(seed, remaining, depth, xp) {
      if (remaining === 0 || depth === input.maxOpens) {
        expected = Math.max(expected, xp);
        return;
      }
      for (const level of [4, 5]) {
        const result = simulateAdventureChestOpening(seed, level, input.eventType, input.vaultPercentage, input.cardId);
        const keys = result.items.filter((item) => item.baseName.endsWith("KeyIcon")).length;
        enumerate(result.nextSeed, remaining - 1 + keys, depth + 1, xp + totalXp(result.items));
      }
    }
    enumerate(input.startSeed, input.openings, 0, 0);
    const solution = await findOptimalXpPath(input);
    expect(solution.xp).toBe(expected);
    expect(solution.stopped).toBe(false);
    checkReplay(solution, input);
  });

  it("settles simultaneous bounded searches using the native MessageChannel", () => {
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { findOptimalXpPath } from ${JSON.stringify(solverUrl)};
      let now = 0;
      Date.now = () => (now += 50);
      const input = ${JSON.stringify({ ...options, openings: 3 })};
      const results = await Promise.all([findOptimalXpPath(input), findOptimalXpPath(input)]);
      console.log(JSON.stringify(results.map(({ xp, path, nodesVisited, stopped }) => ({ xp, length: path.length, nodesVisited, stopped }))));
    `], { encoding: "utf8", timeout: 5000 });
    const results = JSON.parse(output);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ length: 3, nodesVisited: 14, stopped: false });
  });

  it("cancels simultaneous uncapped refund searches after a host event", () => {
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { findOptimalXpPath } from ${JSON.stringify(solverUrl)};
      let now = 0;
      Date.now = () => (now += 50);
      let stop = false;
      const input = ${JSON.stringify({ ...options, maxLevel: 1, openings: 1, vaultPercentage: 100 })};
      const searches = [
        findOptimalXpPath({ ...input, shouldStop: () => stop }),
        findOptimalXpPath({ ...input, shouldStop: () => stop })
      ];
      setTimeout(() => { stop = true; }, 0);
      const results = await Promise.all(searches);
      console.log(JSON.stringify(results.map(({ xp, path, stopped, truncated }) => ({
        xp, sum: path.reduce((sum, step) => sum + step.xp, 0), length: path.length, stopped, truncated
      }))));
    `], { encoding: "utf8", timeout: 5000 });
    for (const result of JSON.parse(output)) {
      expect(result).toMatchObject({ stopped: true, truncated: false });
      expect(result.length).toBeGreaterThan(0);
      expect(result.xp).toBe(result.sum);
    }
  });

  it("handles long refunded paths within a bounded Node heap", () => {
    const cap = 6000;
    const output = execFileSync(process.execPath, ["--max-old-space-size=64", "--input-type=module", "-e", `
      import { findOptimalXpPath } from ${JSON.stringify(solverUrl)};
      const result = await findOptimalXpPath(${JSON.stringify({
        ...options, maxLevel: 1, openings: 1, vaultPercentage: 100, maxOpens: cap
      })});
      console.log(JSON.stringify({ length: result.path.length, xp: result.xp, truncated: result.truncated, stopped: result.stopped }));
    `], { encoding: "utf8", timeout: 5000 });
    const result = JSON.parse(output);
    expect(result).toMatchObject({ length: cap, truncated: true, stopped: false });
    expect(result.xp).toBeGreaterThanOrEqual(cap * 4);
    expect(result.xp).toBeLessThanOrEqual(cap * 9);
  });

  it("accepts zero budgets and the deliberate unlimited cap", async () => {
    expect(await findOptimalXpPath({ ...options, openings: 0, maxOpens: Infinity }))
      .toMatchObject({ xp: 0, path: [], nodesVisited: 0, stopped: false, truncated: false });
    expect(await findOptimalXpPath({ ...options, maxOpens: 0 }))
      .toMatchObject({ xp: 0, path: [], nodesVisited: 0, stopped: false, truncated: true });
    expect(await findOptimalXpPath({ ...options, vaultPercentage: 0.5 }))
      .toMatchObject({ stopped: false });
  });

  it("derives an omitted event type from the validated adventure chest", async () => {
    const solution = await findOptimalXpPath({ ...options, eventType: undefined });
    expect(checkReplay(solution, options)).toBe(0);
  });

  it.each([
    { cardId: "missing" }, { cardId: "big" },
    { cardId: "adventure_Pirate", eventType: "Zeus" },
    { eventType: "missing" }, { eventType: null }
  ])("rejects invalid adventure identity %j before shortcuts", async (identity) => {
    const shouldStop = vi.fn(() => true);
    await expect(findOptimalXpPath({ ...options, openings: 0, ...identity, shouldStop }))
      .rejects.toThrow();
    expect(shouldStop).not.toHaveBeenCalled();
  });

  it.each([
    ["startSeed", NaN], ["startSeed", 2147483648], ["startSeed", "42"],
    ["maxLevel", 0], ["maxLevel", 101], ["maxLevel", 1.5],
    ["openings", -1], ["openings", 1.5], ["openings", Infinity], ["openings", Number.MAX_SAFE_INTEGER + 1],
    ["maxOpens", -1], ["maxOpens", 1.5], ["maxOpens", NaN], ["maxOpens", -Infinity],
    ["vaultPercentage", -1], ["vaultPercentage", 101], ["vaultPercentage", Infinity], ["vaultPercentage", "50"]
  ])("rejects invalid %s=%s before shortcuts or callbacks", async (field, value) => {
    const shouldStop = vi.fn(() => true);
    const onProgress = vi.fn();
    await expect(findOptimalXpPath({ ...options, openings: 0, [field]: value, shouldStop, onProgress }))
      .rejects.toThrow(RangeError);
    expect(shouldStop).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });
});

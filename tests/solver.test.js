import { beforeEach, describe, expect, it, vi } from "vitest";
import { findItemLinear, findAllPaths } from "../src/solver/find-items.js";
import { findOptimalXpPath } from "../src/solver/xp-path.js";
import { simulateAdventureChestOpening, predictChain } from "../src/loot/simulate.js";
import { totalXp } from "../src/loot/xp.js";
import { item } from "./fixtures.js";

vi.mock("../src/loot/simulate.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, simulateAdventureChestOpening: vi.fn(actual.simulateAdventureChestOpening) };
});
const realSimulate = (await vi.importActual("../src/loot/simulate.js")).simulateAdventureChestOpening;
beforeEach(() => simulateAdventureChestOpening.mockReset().mockImplementation(realSimulate));
const options = { startSeed: 42, cardId: "adventure_Zeus", eventType: "Zeus", maxLevel: 5 };

describe("linear item search", () => {
  it("collects multiple targets over the real chain and stops at the first complete opening", () => {
    const result = findItemLinear(42, "egg_Rare", ["Pet_HouseCat", "Pet_GoldenRetriever"], { limit: 10 });
    expect(result).toMatchObject({ found: true, opens: 2, cost: 2 });
    expect(result.path.map((open) => open.hits)).toEqual([["Pet_GoldenRetriever"], ["Pet_HouseCat"]]);
    expect(result.path[1].seed).toBe(result.path[0].nextSeed);
  });

  it("deduplicates targets and uses default options", () => {
    const result = findItemLinear(42, "egg_Rare", ["Pet_GoldenRetriever", "Pet_GoldenRetriever"]);
    expect(result).toMatchObject({ found: true, opens: 1 });
  });

  it("reports only missing targets after reaching the limit and supports a zero limit", () => {
    expect(findItemLinear(42, "egg_Rare", ["Pet_GoldenRetriever", "Never"], { limit: 1 }))
      .toEqual({ found: false, opens: 1, path: [], missing: ["Never"] });
    expect(findItemLinear(42, "big", ["Never"], { limit: 0 }))
      .toEqual({ found: false, opens: 0, path: [], missing: ["Never"] });
  });

  it("forwards adventure options and reports vault keys as hits", () => {
    const result = findItemLinear(42, "adventure_Zeus", ["ZeusKeyIcon"], { level: 1, vaultPercentage: 100, limit: 1 });
    expect(result.path[0].hits).toEqual(["ZeusKeyIcon"]);
  });
});

describe("adventure item search", () => {
  it("finds a real route and accounts for key refunds", () => {
    const result = findAllPaths({ ...options, targets: ["Ring_Bronze"], vaultPercentage: 100, maxDepth: 2 });
    expect(result).toMatchObject({ found: true, same: true });
    expect(result.cheapest.cost).toBe(0);
    expect(result.shortest.path).toHaveLength(1);
    expect(result.shortest.path[0].hits).toContain("Ring_Bronze");
  });

  it("deduplicates candidate levels, bounds depth and honours stop", () => {
    const result = findAllPaths({ ...options, maxLevel: 4, targets: ["Never"], maxDepth: 1 });
    expect(result).toEqual({ found: false, maxDepth: 1, nodesVisited: 2 });
    expect(findAllPaths({ ...options, targets: ["Never"], shouldStop: () => true }))
      .toEqual({ found: false, maxDepth: 10, nodesVisited: 0 });
  });

  it("includes a maximum level between the dominant search levels", () => {
    expect(findAllPaths({ ...options, maxLevel: 6, targets: ["Never"], maxDepth: 1 }))
      .toEqual({ found: false, maxDepth: 1, nodesVisited: 4 });
    expect(simulateAdventureChestOpening.mock.calls.map(([, level]) => level)).toEqual([1, 4, 5, 6]);
  });

  it("keeps collected sets distinct when two routes reach the same seed", () => {
    simulateAdventureChestOpening.mockImplementation((seed, level) => {
      if (seed === 42) return { nextSeed: 1, items: [item(level === 1 ? "A" : "B")] };
      return { nextSeed: 2, items: [item("A")] };
    });
    const result = findAllPaths({ ...options, maxLevel: 4, targets: ["A", "B"], maxDepth: 2 });
    expect(result.found).toBe(true);
    expect(result.shortest.path.map((step) => step.hits)).toEqual([["B"], ["A"]]);
  });

  it("compares shortest and cheapest routes when keys pay for extra openings", () => {
    simulateAdventureChestOpening.mockImplementation((seed, level) => {
      if (seed === 42) return level === 1
        ? { nextSeed: 1, items: [item("A")] }
        : { nextSeed: 2, items: [item("ZeusKeyIcon")] };
      return { nextSeed: 3, items: [item("A"), item("ZeusKeyIcon")] };
    });
    const result = findAllPaths({ ...options, maxLevel: 4, targets: ["A"], maxDepth: 3 });
    expect(result).toMatchObject({ found: true, same: false });
    expect(result.shortest).toMatchObject({ cost: 1, path: [expect.anything()] });
    expect(result.cheapest.cost).toBe(0);
    expect(result.cheapest.path).toHaveLength(2);
  });

  it("prunes equivalent repeated states and avoids cycles", () => {
    simulateAdventureChestOpening.mockImplementation((seed) => ({ nextSeed: seed, items: [item("Unwanted")] }));
    expect(findAllPaths({ ...options, targets: ["Never"], maxDepth: 5 })).toEqual({ found: false, maxDepth: 5, nodesVisited: 6 });
  });

  it("keeps a longer cheaper route to the same state when it can still finish within the depth limit", () => {
    // A short paid route reaches seed 3 first. The refunded detour also reaches
    // seed 3, with enough depth left, and is the cheapest route to the target.
    simulateAdventureChestOpening.mockImplementation((seed, level) => {
      if (seed === 42) return level === 1
        ? { nextSeed: 3, items: [] }
        : { nextSeed: 2, items: [item("ZeusKeyIcon")] };
      if (seed === 2) return { nextSeed: 3, items: [item("ZeusKeyIcon")] };
      return { nextSeed: 4, items: [item("Target"), item("ZeusKeyIcon")] };
    });
    const result = findAllPaths({ ...options, maxLevel: 1, targets: ["Target"], vaultPercentage: 100, maxDepth: 3 });
    // Use levels 1 and 4 so the first state really has two available routes.
    const branched = findAllPaths({ ...options, maxLevel: 4, targets: ["Target"], vaultPercentage: 100, maxDepth: 3 });
    expect(result.cheapest.cost).toBe(1);
    expect(branched.cheapest.cost).toBe(0);
    expect(branched.cheapest.path).toHaveLength(3);
  });
});

describe("XP path search", () => {
  it("chooses the higher-XP Pirate opening when it contains a key necklace", async () => {
    const result = await findOptimalXpPath({
      startSeed: 46, cardId: "adventure_Pirate", eventType: "Pirate",
      maxLevel: 100, vaultPercentage: 0, openings: 1,
    });
    // Rare + Legendary + Ultimate + Rare + Rare = 9 + 26 + 61 + 9 + 9.
    expect(result.xp).toBe(114);
    expect(result.path).toHaveLength(1);
    expect(result.path[0].level).toBe(100);
    expect(result.path[0].items).toContainEqual(expect.objectContaining({
      baseName: "Necklace_Key", rarity: "Ultimate",
    }));
  });

  it("matches exhaustive enumeration of all small replay paths", async () => {
    let expected = -1;
    for (const first of [4, 5]) for (const second of [4, 5]) {
      const a = realSimulate(42, first, "Zeus", 0, "adventure_Zeus");
      const b = realSimulate(a.nextSeed, second, "Zeus", 0, "adventure_Zeus");
      expected = Math.max(expected, totalXp(a.items) + totalXp(b.items));
    }
    const result = await findOptimalXpPath({ ...options, openings: 2 });
    expect(result.xp).toBe(expected);
    expect(result.path).toHaveLength(2);
    expect(result.nodesVisited).toBe(6);
    let seed = 42;
    for (const step of result.path) {
      expect(step.usedSeed).toBe(seed);
      const open = predictChain(seed, "adventure_Zeus", 1, { level: step.level })[0];
      expect(step.items).toEqual(open.items);
      seed = open.nextSeed;
    }
  });

  it("counts refunded keys, reports progress and marks a capped search", async () => {
    const progress = vi.fn();
    const result = await findOptimalXpPath({ ...options, openings: 1, vaultPercentage: 100, maxOpens: 3, onProgress: progress });
    expect(result.path).toHaveLength(3);
    expect(result.truncated).toBe(true);
    expect(result.maxOpens).toBe(3);
    expect(progress).toHaveBeenCalledWith(1);
    expect(result.xp).toBe(result.path.reduce((sum, step) => sum + totalXp(step.items), 0));
  });

  it("returns zero XP without openings or when stopped before starting", async () => {
    expect(await findOptimalXpPath({ ...options, openings: 0 })).toMatchObject({ xp: 0, path: [], nodesVisited: 0, truncated: false });
    expect(await findOptimalXpPath({ ...options, openings: 1, shouldStop: () => true })).toMatchObject({ xp: 0, path: [], nodesVisited: 0 });
  });

  it("stops between branches and does not discard the best path", async () => {
    let calls = 0;
    const result = await findOptimalXpPath({ ...options, openings: 2, shouldStop: () => ++calls >= 6 });
    expect(result.nodesVisited).toBeGreaterThan(0);
    expect(result.nodesVisited).toBeLessThan(6);
    expect(result.xp).toBeGreaterThanOrEqual(0);
  });

  it("does not duplicate a dominant max level", async () => {
    expect(await findOptimalXpPath({ ...options, maxLevel: 4, openings: 1 })).toMatchObject({ nodesVisited: 1, truncated: false });
  });

  it("propagates solver and progress callback errors", async () => {
    simulateAdventureChestOpening.mockImplementationOnce(() => { throw new Error("simulation failed"); });
    await expect(findOptimalXpPath({ ...options, openings: 1 })).rejects.toThrow("simulation failed");
    await expect(findOptimalXpPath({ ...options, openings: 2, onProgress: () => { throw new Error("progress failed"); } })).rejects.toThrow("progress failed");
  });
});

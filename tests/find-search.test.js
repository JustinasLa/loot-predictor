import { describe, expect, it, vi } from "vitest";
import {
  findAllPaths, findAllPathsAsync, findItemLinear, findItemLinearAsync
} from "../src/solver/find-items.js";
import { simulateAdventureChestOpening } from "../src/loot/simulate.js";

const options = { startSeed: 10, cardId: "adventure_Zeus", maxLevel: 100, maxDepth: 1 };

function enumerate({ startSeed, cardId, maxLevel, maxDepth, vaultPercentage, targets }) {
  const wanted = new Set(targets);
  let shortest = Infinity;
  let cheapest = Infinity;
  function walk(seed, found, cost, depth) {
    if (depth === maxDepth) return;
    for (let level = 1; level <= maxLevel; level++) {
      const result = simulateAdventureChestOpening(seed, level, "Zeus", vaultPercentage, cardId);
      const nextFound = new Set(found);
      for (const item of result.items) if (wanted.has(item.baseName)) nextFound.add(item.baseName);
      const nextCost = cost + 1 - result.items.filter((item) => item.baseName.endsWith("KeyIcon")).length;
      if (nextFound.size === wanted.size) {
        shortest = Math.min(shortest, depth + 1);
        cheapest = Math.min(cheapest, nextCost);
      } else walk(result.nextSeed, nextFound, nextCost, depth + 1);
    }
  }
  walk(startSeed, new Set(), 0, 0);
  return { shortest, cheapest };
}

describe("real adventure search regressions", () => {
  it("finds a target available only at an intermediate level", () => {
    const result = findAllPaths({ ...options, targets: ["Ring_Plastic"] });
    expect(result).toMatchObject({ found: true, complete: true });
    expect(result.shortest.path).toHaveLength(1);
    expect(result.shortest.path[0].level).toBe(6);
    expect(result.shortest.path[0].hits).toContain("Ring_Plastic");
  });

  it("keeps the refunded detour that reaches a previously visited seed", () => {
    const result = findAllPaths({
      ...options, startSeed: 169529615, targets: ["Ring_Bagel"], vaultPercentage: 50, maxDepth: 3
    });
    expect(result.shortest.path).toHaveLength(2);
    expect(result.cheapest.cost).toBe(1);
    expect(result.cheapest.path).toHaveLength(3);
    expect(result.cheapest.path[2].usedSeed).toBe(869265870);
    expect(result.same).toBe(false);
  });

  it.each([0, 50, 100])("matches exhaustive small searches at vault percentage %s", (vaultPercentage) => {
    const search = {
      ...options, startSeed: 42, maxLevel: 6, maxDepth: 3,
      vaultPercentage, targets: ["Ring_Wooden", "Ring_Rubber"]
    };
    const expected = enumerate(search);
    const actual = findAllPaths(search);
    expect(actual.found).toBe(expected.shortest !== Infinity);
    if (actual.found) {
      expect(actual.shortest.path.length).toBe(expected.shortest);
      expect(actual.cheapest.cost).toBe(expected.cheapest);
    }
  });

  it("completes empty targets without spending an opening", () => {
    expect(findAllPaths({ ...options, targets: [] })).toMatchObject({
      found: true, shortest: { path: [], cost: 0 }, cheapest: { path: [], cost: 0 },
      same: true, nodesVisited: 0, complete: true
    });
    expect(findItemLinear(42, "big", [])).toMatchObject({ found: true, opens: 0, path: [], cost: 0 });
    expect(findAllPaths({ ...options, targets: ["Ring_Wooden"], maxDepth: 0 }))
      .toMatchObject({ found: false, complete: true, nodesVisited: 0 });
  });
});

describe("bounded and responsive item searches", () => {
  it("shares the same results between asynchronous and synchronous drivers", async () => {
    const search = { ...options, targets: ["Ring_Plastic"], maxNodes: 1000 };
    expect(await findAllPathsAsync(search)).toEqual(findAllPaths(search));
    const linearOptions = { limit: 10, maxNodes: 1000 };
    expect(await findItemLinearAsync(42, "egg_Rare", ["Pet_HouseCat"], linearOptions))
      .toEqual(findItemLinear(42, "egg_Rare", ["Pet_HouseCat"], linearOptions));
    expect(await findItemLinearAsync(42, "big", [])).toMatchObject({ maxNodes: 100000, opens: 0 });
  });

  it("allows a host event to stop both searches before exhausting their limits", async () => {
    vi.stubGlobal("MessageChannel", undefined);
    let stopped = false;
    setTimeout(() => { stopped = true; }, 0);
    const adventure = await findAllPathsAsync({ ...options, maxDepth: 10, targets: ["Missing"], shouldStop: () => stopped });
    expect(adventure).toMatchObject({ found: false, stopped: true, truncated: false, complete: false, nodesVisited: 1 });
    stopped = false;
    setTimeout(() => { stopped = true; }, 0);
    const linear = await findItemLinearAsync(42, "big", ["Missing"], { shouldStop: () => stopped });
    expect(linear).toMatchObject({ found: false, stopped: true, truncated: false, complete: false, opens: 1 });
  });

  it("reports exhausted node budgets and retains useful candidate routes", async () => {
    const partial = await findAllPathsAsync({ ...options, startSeed: 42, targets: ["Ring_Bronze"], maxNodes: 1 });
    expect(partial).toMatchObject({ found: true, truncated: true, stopped: false, complete: false, nodesVisited: 1 });
    expect(partial.shortest.path).toHaveLength(1);
    expect(await findAllPathsAsync({ ...options, targets: ["Missing"], maxNodes: 0 }))
      .toMatchObject({ found: false, truncated: true, nodesVisited: 0 });
    expect(await findItemLinearAsync(42, "big", ["Missing"], { maxNodes: 2 }))
      .toMatchObject({ found: false, opens: 2, truncated: true, complete: false, missing: ["Missing"] });
    expect(findItemLinear(42, "big", ["Missing"], { shouldStop: () => true }))
      .toMatchObject({ found: false, opens: 0, stopped: true });
  });

  it("does not mark exactly completed searches as truncated", async () => {
    expect(await findAllPathsAsync({ ...options, maxLevel: 1, targets: ["Missing"], maxNodes: 1 }))
      .toMatchObject({ found: false, complete: true, truncated: false });
    expect(await findItemLinearAsync(42, "big", ["Missing"], { limit: 1, maxNodes: 1 }))
      .toMatchObject({ found: false, complete: true, truncated: false });
  });

  it("reports progress across batches and forwards progress errors", async () => {
    const progress = vi.fn();
    const result = await findAllPathsAsync({ ...options, maxLevel: 6, targets: ["Missing"], yieldEvery: 2, onProgress: progress });
    expect(progress.mock.calls.map(([nodes]) => nodes)).toEqual([2, 4, 6, 6]);
    expect(result.complete).toBe(true);
    await expect(findItemLinearAsync(42, "big", ["Missing"], {
      limit: 1, onProgress: () => { throw new Error("progress failed"); }
    })).rejects.toThrow("progress failed");
  });

  it("also yields on a time budget during a large node batch", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 20));
    const progress = vi.fn();
    await findAllPathsAsync({ ...options, maxLevel: 2, targets: ["Missing"], onProgress: progress });
    expect(progress.mock.calls.map(([nodes]) => nodes)).toEqual([1, 2, 2]);
  });
});

describe("search input boundaries", () => {
  it.each([-1, 0.5, Infinity, NaN, "2"])("rejects invalid linear limit %s", (limit) => {
    expect(() => findItemLinear(42, "big", [], { limit })).toThrow("limit");
  });
  it.each([-1, 0.5, Infinity, NaN])("rejects invalid depth %s before an empty search", (maxDepth) => {
    expect(() => findAllPaths({ ...options, targets: [], maxDepth })).toThrow("maxDepth");
  });
  it("validates seed, card, level and percentage before fast paths", () => {
    expect(() => findItemLinear(NaN, "big", [])).toThrow("seed");
    expect(() => findItemLinear(42, "bad", [])).toThrow("unknown chest");
    expect(() => findItemLinear(42, "big", [], { level: 0 })).toThrow("level");
    expect(() => findItemLinear(42, "big", [], { vaultPercentage: 101 })).toThrow("vault");
    expect(() => findAllPaths({ ...options, cardId: "big", targets: [] })).toThrow("adventure chest");
    expect(() => findAllPaths({ ...options, maxLevel: 101, targets: [] })).toThrow("level");
    expect(() => findAllPaths({ ...options, targets: [], maxNodes: -1 })).toThrow("maxNodes");
  });
  it("requires finite asynchronous budgets and positive yield batches", async () => {
    await expect(findAllPathsAsync({ ...options, targets: [], maxNodes: Infinity })).rejects.toThrow("maxNodes");
    await expect(findItemLinearAsync(42, "big", [], { maxNodes: -1 })).rejects.toThrow("maxNodes");
    await expect(findAllPathsAsync({ ...options, targets: [], yieldEvery: 0 })).rejects.toThrow("yieldEvery");
    expect(findItemLinear(42, "adventure_Zeus", ["ZeusKeyIcon"], { level: 1, vaultPercentage: 100 }))
      .toMatchObject({ cost: 0 });
  });
});

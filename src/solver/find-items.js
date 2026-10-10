import { simulateAdventureChestOpening, predictChain } from "../loot/simulate.js";
import { splitCardId } from "../loot/items.js";
import {
  validateCardId, validateInteger, validateLevel, validateSeed, validateVaultPercentage
} from "../validation.js";
import { yieldToHost } from "./yield-to-host.js";

const neverStop = () => false;
const ignoreProgress = () => {};
const DEFAULT_ASYNC_MAX_NODES = 100000;

function validateBudget(maxNodes) {
  if (maxNodes !== Infinity) validateInteger(maxNodes, "maxNodes");
}

function status(nodesVisited, stopped, truncated, maxNodes) {
  return { nodesVisited, stopped, truncated, complete: !stopped && !truncated, maxNodes };
}

// Both public APIs drive the same generator. Each yield represents one
// simulated opening, so the asynchronous driver can return control to the UI
// between bounded batches without changing search order or pruning.
function runSync(search) {
  let step = search.next();
  while (!step.done) step = search.next();
  return step.value;
}

async function runAsync(search, { yieldEvery = 256, onProgress = ignoreProgress }) {
  validateInteger(yieldEvery, "yieldEvery", 1);
  let step = search.next();
  if (!step.done) await yieldToHost();
  let lastYield = Date.now();
  let sinceYield = 0;

  while (!step.done) {
    sinceYield++;
    if (sinceYield >= yieldEvery || Date.now() - lastYield >= 16) {
      await onProgress(step.value);
      await yieldToHost();
      sinceYield = 0;
      lastYield = Date.now();
    }
    step = search.next();
  }

  await onProgress(step.value.nodesVisited);
  return step.value;
}

// A fixed chest follows one seed chain until every distinct target is found.
function* searchLinear(startSeed, cardId, targets, {
  limit = 10000, level, vaultPercentage = 0, shouldStop = neverStop, maxNodes = Infinity
}) {
  validateSeed(startSeed);
  validateCardId(cardId);
  validateInteger(limit, "limit");
  if (level !== undefined) validateLevel(level);
  validateVaultPercentage(vaultPercentage);
  validateBudget(maxNodes);

  const remaining = new Set(targets);
  const path = [];
  let seed = startSeed;
  let nodesVisited = 0;
  let cost = 0;
  let stopped = false;
  let truncated = false;

  if (remaining.size === 0) {
    return { found: true, opens: 0, path, cost: 0, ...status(0, false, false, maxNodes) };
  }

  for (let attempt = 1; attempt <= limit; attempt++) {
    if (shouldStop()) { stopped = true; break; }
    if (nodesVisited >= maxNodes) { truncated = true; break; }
    const [open] = predictChain(seed, cardId, 1, { level, vaultPercentage });
    nodesVisited++;
    const hits = open.items.filter((item) => remaining.has(item.baseName));
    for (const hit of hits) remaining.delete(hit.baseName);
    path.push({ ...open, hits: hits.map((hit) => hit.baseName) });
    cost += 1 - open.items.filter((item) => item.baseName.endsWith("KeyIcon")).length;

    if (remaining.size === 0) {
      return { found: true, opens: attempt, path, cost, ...status(nodesVisited, false, false, maxNodes) };
    }
    seed = open.nextSeed;
    yield nodesVisited;
  }

  return {
    found: false, opens: nodesVisited, path: [], missing: [...remaining],
    ...status(nodesVisited, stopped, truncated, maxNodes)
  };
}

export function findItemLinear(startSeed, cardId, targets, opts = {}) {
  return runSync(searchLinear(startSeed, cardId, targets, opts));
}

export async function findItemLinearAsync(startSeed, cardId, targets, opts = {}) {
  const { maxNodes = DEFAULT_ASYNC_MAX_NODES } = opts;
  validateInteger(maxNodes, "maxNodes");
  return runAsync(searchLinear(startSeed, cardId, targets, { ...opts, maxNodes }), opts);
}

// Level probabilities are not dominance rules for deterministic item drops:
// any permitted level can be the only one that produces a particular target.
function* searchAdventure({
  startSeed, targets, cardId, maxLevel, vaultPercentage = 0,
  maxDepth = 10, shouldStop = neverStop, maxNodes = Infinity
}) {
  validateSeed(startSeed);
  validateCardId(cardId);
  const [chestType, eventType] = splitCardId(cardId);
  if (chestType !== "adventure") throw new Error("adventure search requires an adventure chest");
  validateLevel(maxLevel);
  validateInteger(maxDepth, "maxDepth");
  validateVaultPercentage(vaultPercentage);
  validateBudget(maxNodes);

  const targetSet = new Set(targets);
  const emptyPath = { path: [], cost: 0 };
  if (targetSet.size === 0) {
    return {
      found: true, shortest: emptyPath, cheapest: emptyPath, same: true, solutions: 1,
      maxDepth, ...status(0, false, false, maxNodes)
    };
  }

  const queue = [{ seed: startSeed, path: [], cost: 0, foundItems: new Set() }];
  let head = 0;
  // Retain every nondominated (depth, cost) arrival to a seed and collected
  // set. A shorter paid arrival preserves depth; a longer refunded arrival
  // can still provide the cheapest completion.
  const visited = new Map([[startSeed, new Map([["[]", [{ length: 0, cost: 0 }]]])]]);
  let shortest;
  let cheapest;
  let solutions = 0;
  let minCostFound = Infinity;
  let nodesVisited = 0;
  let stopped = false;
  let truncated = false;

  search: while (head < queue.length) {
    const { seed, path, cost, foundItems } = queue[head];
    queue[head++] = null; // Release expanded paths without shifting the queue.
    if (cost >= minCostFound || path.length >= maxDepth) continue;

    for (let level = 1; level <= maxLevel; level++) {
      if (shouldStop()) { stopped = true; break search; }
      if (nodesVisited >= maxNodes) { truncated = true; break search; }
      const result = simulateAdventureChestOpening(seed, level, eventType, vaultPercentage, cardId);
      nodesVisited++;
      const newFound = new Set(foundItems);
      const hits = [];
      for (const item of result.items) {
        if (targetSet.has(item.baseName)) {
          newFound.add(item.baseName);
          hits.push(item.baseName);
        }
      }

      const keysFound = result.items.filter((item) => item.baseName.endsWith("KeyIcon")).length;
      const newCost = cost + 1 - keysFound;
      const newPath = [...path, { level, items: result.items, hits, usedSeed: seed }];
      if (newFound.size === targetSet.size) {
        const solution = { path: newPath, cost: newCost };
        solutions++;
        if (!shortest) shortest = solution; // Breadth-first traversal finds it first.
        if (!cheapest || newCost < cheapest.cost) cheapest = solution;
        minCostFound = Math.min(minCostFound, newCost);
      } else if (newCost < minCostFound && newPath.length < maxDepth) {
        const signature = JSON.stringify([...newFound].sort());
        const forSeed = visited.get(result.nextSeed) || new Map();
        const frontier = forSeed.get(signature) || [];
        const dominated = frontier.some((seen) => seen.length <= newPath.length && seen.cost <= newCost);
        if (!dominated) {
          forSeed.set(signature, [
            ...frontier.filter((seen) => seen.length < newPath.length || seen.cost < newCost),
            { length: newPath.length, cost: newCost }
          ]);
          visited.set(result.nextSeed, forSeed);
          queue.push({ seed: result.nextSeed, path: newPath, cost: newCost, foundItems: newFound });
        }
      }
      yield nodesVisited;
    }
  }

  const metadata = { maxDepth, ...status(nodesVisited, stopped, truncated, maxNodes) };
  if (!shortest) return { found: false, ...metadata };
  return {
    found: true, shortest, cheapest,
    same: shortest.path.length === cheapest.path.length && shortest.cost === cheapest.cost,
    solutions, ...metadata
  };
}

export function findAllPaths(options) {
  return runSync(searchAdventure(options));
}

export async function findAllPathsAsync(options) {
  const { maxNodes = DEFAULT_ASYNC_MAX_NODES } = options;
  validateInteger(maxNodes, "maxNodes");
  return runAsync(searchAdventure({ ...options, maxNodes }), options);
}

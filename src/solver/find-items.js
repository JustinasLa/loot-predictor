import { simulateAdventureChestOpening, predictChain } from "../loot/simulate.js";
import { DOMINANT_ADVENTURE_LEVELS_FOR_ITEMS } from "../loot/tables.js";
import { splitCardId } from "../loot/items.js";

// --- Non-adventure chests -------------------------------------------------
// Nothing to optimise: the chest has no level to choose, so the seed chain is
// fixed and the only question is how many opens until the item shows up.
export function findItemLinear(startSeed, cardId, targets, opts = {}) {
  const { limit = 10000, level, vaultPercentage = 0 } = opts;
  const remaining = new Set(targets);
  const path = [];
  let seed = startSeed;

  for (let attempt = 1; attempt <= limit; attempt++) {
    const [open] = predictChain(seed, cardId, 1, { level, vaultPercentage });

    const hits = open.items.filter((item) => remaining.has(item.baseName));
    for (const hit of hits) remaining.delete(hit.baseName);
    path.push({ ...open, hits: hits.map((h) => h.baseName) });

    if (remaining.size === 0) {
      return { found: true, opens: attempt, path, cost: attempt };
    }
    seed = open.nextSeed;
  }

  return { found: false, opens: limit, path: [], missing: [...remaining] };
}

// --- Adventure chests -----------------------------------------------------
// Here the level is a choice, so this is a search. Breadth-first over the
// item-relevant levels, tracking which targets each branch has collected.
//
// Cost is net chests spent: a vault key refunds an opening, so an open that
// drops one is free (cost 0) and the cheapest route is not always the shortest.
export function findAllPaths({
  startSeed,
  targets,
  cardId,
  maxLevel,
  vaultPercentage = 0,
  maxDepth = 10,
  shouldStop = () => false
}) {
  const [, eventType] = splitCardId(cardId);
  const targetSet = new Set(targets);
  const solutions = [];

  let levels = DOMINANT_ADVENTURE_LEVELS_FOR_ITEMS.filter((l) => l <= maxLevel);
  if (!levels.includes(maxLevel)) levels.push(maxLevel);
  levels = [...new Set(levels)].sort((a, b) => a - b);

  const queue = [{ seed: startSeed, path: [], cost: 0, foundItems: new Set() }];
  // seed -> (collected-set signature -> best {length, cost}) so two branches
  // that reach the same position with the same haul don't both expand.
  const visited = new Map();
  let minCostFound = Infinity;
  let nodesVisited = 0;

  while (queue.length > 0) {
    if (shouldStop()) break;

    const { seed, path, cost, foundItems } = queue.shift();
    if (cost >= minCostFound || path.length >= maxDepth) continue;

    for (const level of levels) {
      nodesVisited++;
      const result = simulateAdventureChestOpening(
        seed, level, eventType, vaultPercentage, cardId
      );

      const newFound = new Set(foundItems);
      const hits = [];
      for (const item of result.items) {
        if (targetSet.has(item.baseName)) {
          newFound.add(item.baseName);
          hits.push(item.baseName);
        }
      }

      const keysFound = result.items.filter((i) => i.baseName.endsWith("KeyIcon")).length;
      const newCost = cost + (1 - keysFound);
      const newPath = [...path, { level, items: result.items, hits, usedSeed: seed }];

      if (newFound.size === targetSet.size) {
        solutions.push({ path: newPath, cost: newCost });
        minCostFound = Math.min(minCostFound, newCost);
        continue;
      }

      const signature = [...newFound].sort().join(",");
      const forSeed = visited.get(result.nextSeed) || new Map();
      const seen = forSeed.get(signature);

      const better =
        !seen ||
        newPath.length < seen.length ||
        (newPath.length === seen.length && newCost < seen.cost);

      if (better && newCost < minCostFound) {
        forSeed.set(signature, { length: newPath.length, cost: newCost });
        visited.set(result.nextSeed, forSeed);
        queue.push({
          seed: result.nextSeed, path: newPath, cost: newCost, foundItems: newFound
        });
      }
    }
  }

  if (solutions.length === 0) {
    return { found: false, maxDepth, nodesVisited };
  }

  // Fewest opens vs fewest chests actually spent — key refunds can make these
  // different routes, so report both.
  const shortest = solutions.reduce((a, b) => (a.path.length <= b.path.length ? a : b));
  const cheapest = solutions.reduce((a, b) => (a.cost <= b.cost ? a : b));

  return {
    found: true,
    shortest,
    cheapest,
    same: shortest.path.length === cheapest.path.length && shortest.cost === cheapest.cost,
    solutions: solutions.length,
    nodesVisited
  };
}

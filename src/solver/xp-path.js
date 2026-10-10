import { simulateAdventureChestOpening } from "../loot/simulate.js";
import { DOMINANT_ADVENTURE_LEVELS } from "../loot/tables.js";
import { getItemXp } from "../loot/xp.js";
import { validateCardId, validateInteger, validateLevel, validateSeed, validateVaultPercentage } from "../validation.js";
import { yieldToHost } from "./yield-to-host.js";

// Find the replay order that banks the most XP from a fixed seed.
//
// Because the seed advances deterministically, the level you pick for open #1
// changes every draw after it. So this is a search, not a per-open choice:
// a weak first open at a low level can set up a much better second one.
//
// Vault keys pay for themselves — each key found refunds an opening, which is
// why the search can run deeper than `openings` suggests.
export async function findOptimalXpPath({
  startSeed,
  eventType,
  cardId,
  maxLevel,
  vaultPercentage = 0,
  openings,
  // No limit by default. Keys can keep refunding openings, so an uncapped
  // search may not terminate on its own. Set a finite cap or use shouldStop.
  maxOpens = Infinity,
  onProgress = () => {},
  shouldStop = () => false
}) {
  validateSeed(startSeed);
  validateLevel(maxLevel, "maximum level");
  validateVaultPercentage(vaultPercentage);
  validateInteger(openings, "openings");
  if (maxOpens !== Infinity) validateInteger(maxOpens, "maximum opens");
  validateCardId(cardId);
  if (!cardId.startsWith("adventure_")) throw new Error("XP search requires an adventure chest");
  const adventureType = cardId.slice("adventure_".length);
  if (eventType !== undefined && eventType !== adventureType) {
    throw new Error("event type must match the adventure chest");
  }
  eventType = adventureType;

  let best = { path: [], xp: -1 };
  let nodesVisited = 0;
  let lastYield = Date.now();
  let truncated = false;
  let stopped = false;

  const levels = DOMINANT_ADVENTURE_LEVELS.filter((level) => level <= maxLevel);
  if (!levels.includes(maxLevel)) levels.push(maxLevel);

  // Keep one mutable route and an explicit DFS stack. Refunded paths can be
  // very deep; retaining a copied prefix at every level costs quadratic space.
  const currentPath = [];
  const stack = [{ seed: startSeed, xp: 0, openingsLeft: openings, nextLevel: 0 }];

  function saveBest(xp) {
    if (xp > best.xp) best = { path: [...currentPath], xp };
  }

  function backtrack() {
    stack.pop();
    if (stack.length > 0) currentPath.pop();
  }

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (current.nextLevel === 0) {
      stopped = Boolean(shouldStop());
      if (stopped || current.openingsLeft <= 0 || currentPath.length >= maxOpens) {
        if (currentPath.length >= maxOpens && current.openingsLeft > 0) truncated = true;
        saveBest(current.xp);
        if (stopped) break;
        backtrack();
        continue;
      }

      if (currentPath.length > best.path.length) await onProgress(currentPath.length);
    }

    if (current.nextLevel >= levels.length) {
      backtrack();
      continue;
    }
    // Cancellation may have arrived while reporting progress or yielding.
    stopped = Boolean(shouldStop());
    if (stopped) {
      saveBest(current.xp);
      break;
    }

    const level = levels[current.nextLevel++];
    const result = simulateAdventureChestOpening(
      current.seed, level, eventType, vaultPercentage, cardId
    );
    const openingXp = result.items.reduce((sum, item) => sum + getItemXp(item), 0);
    const keysFound = result.items.filter((item) => item.baseName.endsWith("KeyIcon")).length;

    // Yield on a time budget rather than a node count, so cheap searches
    // never pay for a yield and deep ones stay interruptible.
    nodesVisited++;
    if (Date.now() - lastYield > 40) {
      await yieldToHost();
      lastYield = Date.now();
    }

    currentPath.push({ level, items: result.items, xp: openingXp, usedSeed: current.seed });
    stack.push({
      seed: result.nextSeed,
      xp: current.xp + openingXp,
      openingsLeft: current.openingsLeft - 1 + keysFound,
      nextLevel: 0
    });
  }

  return { ...best, nodesVisited, truncated, stopped, maxOpens };
}

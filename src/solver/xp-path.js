import { simulateAdventureChestOpening } from "../loot/simulate.js";
import { DOMINANT_ADVENTURE_LEVELS } from "../loot/tables.js";
import { getItemXp } from "../loot/xp.js";

// Find the replay order that banks the most XP from a fixed seed.
//
// Because the seed advances deterministically, the level you pick for open #1
// changes every draw after it. So this is a search, not a per-open choice:
// a weak first open at a low level can set up a much better second one.
//
// Vault keys pay for themselves — each key found refunds an opening, which is
// why the search can run deeper than `openings` suggests.
// Yield to the event loop so the UI can repaint and Stop stays responsive.
// setTimeout is throttled to ~1/second in a backgrounded tab, which would
// stall the search whenever you switch away, so prefer MessageChannel.
let channel = null;
function yieldToHost() {
  if (typeof MessageChannel === "undefined") {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!channel) {
    channel = new MessageChannel();
    channel.port1.start?.();
  }
  return new Promise((resolve) => {
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
}

export async function findOptimalXpPath({
  startSeed,
  eventType,
  cardId,
  maxLevel,
  vaultPercentage = 0,
  openings,
  // No limit by default. Be aware that key refunds can outpace spending: with
  // ~5 branches per node and a decent vault rate some branch nearly always
  // drops a key, so an uncapped search may not terminate on its own — that is
  // what `shouldStop` is for. Set a finite value to bound path length.
  maxOpens = Infinity,
  onProgress = () => {},
  shouldStop = () => false
}) {
  let best = { path: [], xp: -1 };
  let nodesVisited = 0;
  let lastYield = Date.now();
  let truncated = false;

  const levels = DOMINANT_ADVENTURE_LEVELS.filter((level) => level <= maxLevel);
  if (!levels.includes(maxLevel)) levels.push(maxLevel);

  async function search(currentSeed, currentPath, currentXp, openingsLeft) {
    if (shouldStop() || openingsLeft <= 0 || currentPath.length >= maxOpens) {
      if (currentPath.length >= maxOpens && openingsLeft > 0) truncated = true;
      if (currentXp > best.xp) best = { path: currentPath, xp: currentXp };
      return;
    }

    if (currentPath.length > best.path.length) await onProgress(currentPath.length);

    for (const level of levels) {
      if (shouldStop()) break;

      const result = simulateAdventureChestOpening(
        currentSeed, level, eventType, vaultPercentage, cardId
      );
      const openingXp = result.items.reduce((sum, item) => sum + getItemXp(item), 0);
      const keysFound = result.items.filter((i) => i.baseName.endsWith("KeyIcon")).length;

      // Yield on a time budget rather than a node count, so cheap searches
      // never pay for a yield and deep ones stay interruptible.
      nodesVisited++;
      if (Date.now() - lastYield > 40) {
        await yieldToHost();
        lastYield = Date.now();
      }

      await search(
        result.nextSeed,
        [...currentPath, { level, items: result.items, xp: openingXp, usedSeed: currentSeed }],
        currentXp + openingXp,
        openingsLeft - 1 + keysFound
      );
    }
  }

  await search(startSeed, [], 0, openings);
  return { ...best, nodesVisited, truncated, maxOpens };
}

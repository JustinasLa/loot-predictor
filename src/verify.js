import { predictChain } from "./loot/simulate.js";

// Verify a prediction against reality using two savegame exports taken
// before and after opening chests.
//
// The chest's persisted Seed is the ground truth: if the simulation is
// correct, chaining `before.seed` forward by the number of opens that
// happened in between must land exactly on `after.seed`. That check needs
// no loot data at all, so a seed match isolates the PRNG and draw order
// from any error in the loot tables.
export function verifyChest(cardId, before, after) {
  const opens = after.openedCount - before.openedCount;

  if (before.openedCount == null || after.openedCount == null) {
    return { cardId, status: "skipped", reason: "no open counter for this chest" };
  }
  if (opens < 0) {
    return { cardId, status: "skipped", reason: "counter went backwards — saves out of order?" };
  }
  if (opens === 0) {
    return {
      cardId,
      status: before.initialSeed === after.initialSeed ? "unchanged" : "mismatch",
      opens: 0,
      expectedSeed: after.initialSeed,
      actualSeed: before.initialSeed,
      reason: "no opens between the two saves"
    };
  }

  const chain = predictChain(before.initialSeed, cardId, opens, {
    level: before.level,
    vaultPercentage: before.vaultPercentage ?? 0
  });

  const predictedSeed = chain[chain.length - 1].nextSeed;

  return {
    cardId,
    status: predictedSeed === after.initialSeed ? "match" : "mismatch",
    opens,
    expectedSeed: after.initialSeed,
    actualSeed: predictedSeed,
    chain
  };
}

// Run verifyChest across every chest present in both saves.
export function verifyAll(before, after) {
  const results = [];
  for (const cardId of Object.keys(before)) {
    if (!after[cardId]) continue;
    results.push(verifyChest(cardId, before[cardId], after[cardId]));
  }
  // Chests that actually moved are the informative ones — surface them first.
  const rank = { mismatch: 0, match: 1, unchanged: 2, skipped: 3 };
  return results.sort((a, b) => rank[a.status] - rank[b.status]);
}

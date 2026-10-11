import { CHEST_ID_MAP, EGG_RARITY_MAP } from "../loot/tables.js";

// Synthetic seeds, never a player's save. Keep the label stable so restored
// demo sessions remain visibly different from an imported save file.
export const DEMO_FILENAME = "Example save · demo";

export function createDemoSave() {
  const chests = Object.entries(CHEST_ID_MAP).map(([chestId, cardId], index) => [
    cardId,
    {
      initialSeed: 48271 + index * 7919,
      openedCount: 0,
      chestId: Number(chestId),
      ...(cardId.startsWith("adventure_") ? { level: 25 } : {})
    }
  ]);
  const eggs = Object.entries(EGG_RARITY_MAP).map(([eggRarity, cardId], index) => [
    cardId, { initialSeed: 104729 + index * 9973, eggRarity: Number(eggRarity) }
  ]);
  // Big boxes make the first preview useful: six items from a broad pool.
  chests.sort(([left], [right]) => Number(right === "big") - Number(left === "big"));
  return Object.fromEntries([...chests, ...eggs]);
}

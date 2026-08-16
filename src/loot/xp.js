import {
  LOOT_TABLES, ADVENTURE_LOOT_RATES, XP_VALUES_ITEMS, XP_VALUES_EGGS
} from "./tables.js";

// Pet food and vault keys are worth no XP; everything else scores by rarity,
// with eggs on their own (much steeper) scale.
export function getItemXp(item) {
  if (
    !item || !item.rarity ||
    item.baseName === "PetFood" ||
    (item.baseName && item.baseName.endsWith("Key"))
  ) {
    return 0;
  }

  const rarity = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
  return item.name.startsWith("Pet Egg")
    ? XP_VALUES_EGGS[rarity] || 0
    : XP_VALUES_ITEMS[rarity] || 0;
}

export function totalXp(items) {
  return items.reduce((sum, item) => sum + getItemXp(item), 0);
}

// Expected XP per open, for comparing an actual result against the average.
export function getAverageXpForAdventure(level) {
  const levelData = ADVENTURE_LOOT_RATES[level - 1];
  if (!levelData) return 0;

  let avgXpPerItem = 0;
  for (const rarity in levelData.rates) {
    const prob = levelData.rates[rarity] / 100;
    const key = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    avgXpPerItem += prob * (XP_VALUES_ITEMS[key] || 0);
  }
  return avgXpPerItem * levelData.items;
}

export const AVERAGE_XP = {};

for (const chestId in LOOT_TABLES) {
  const chest = LOOT_TABLES[chestId];
  let avgXpPerItem = 0;
  for (const drop of chest.table) {
    const prob = drop.weight / chest.totalWeight;
    const key = drop.result.rarity.charAt(0).toUpperCase() + drop.result.rarity.slice(1);
    avgXpPerItem += prob * (
      drop.result.type === "Pet Egg"
        ? XP_VALUES_EGGS[key] || 0
        : XP_VALUES_ITEMS[key] || 0
    );
  }
  AVERAGE_XP[chestId] = avgXpPerItem * chest.itemsPerChest;
}

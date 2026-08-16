import { LOOT_TABLES, ITEM_POOLS } from "./tables.js";

// Split a card id into the chest type and its variant, e.g.
//   "adventure_Zeus" -> ["adventure", "Zeus"]
//   "egg_Rare"       -> ["egg", "Rare"]
//   "big"            -> ["big", null]
export function splitCardId(cardId) {
  return cardId.includes("_") ? cardId.split("_") : [cardId, null];
}

// Everything a given chest can actually drop, so the picker only ever offers
// items that are reachable from it.
export function getAvailableItemsForChest(cardId) {
  const [chestType, eventType] = splitCardId(cardId);
  const available = new Map();

  const addPool = (poolName, rarity, type) => {
    for (const baseName of ITEM_POOLS[poolName] || []) {
      available.set(baseName, { baseName, rarity, type });
    }
  };

  if (chestType.startsWith("adventure")) {
    for (const rarity of ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"]) {
      addPool(`${rarity}_${eventType}`, rarity, "Equipment");
    }
  } else if (chestType === "egg") {
    addPool(`${eventType}Pet`, eventType, "Pet");
  } else {
    const config = LOOT_TABLES[chestType === "event" ? "event" : chestType];
    if (config) {
      for (const entry of config.table) {
        const { type, rarity } = entry.result;
        let poolName = rarity;
        if (type === "Pet Egg") poolName += "Egg";
        if (rarity === "Ultimate" && eventType) poolName += `_${eventType}`;
        addPool(poolName, rarity, type);
      }
    }
  }

  return [...available.values()].sort(
    (a, b) => a.rarity.localeCompare(b.rarity) || a.baseName.localeCompare(b.baseName)
  );
}

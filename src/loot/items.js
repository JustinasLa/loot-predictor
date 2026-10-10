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

  const addItem = (baseName, rarity, type) => {
    // Hunts match by base name. Some mapped items occur in multiple rarity
    // pools, so show all matching rarities instead of promising only one.
    const rarities = new Set(available.get(baseName)?.rarities);
    rarities.add(rarity);
    available.set(baseName, {
      baseName, rarity: [...rarities].join(" / "), rarities: [...rarities], type
    });
  };

  const addPool = (poolName, rarity, type) => {
    for (const baseName of ITEM_POOLS[poolName] || []) {
      addItem(baseName, rarity, type);
    }
  };

  if (chestType.startsWith("adventure")) {
    for (const rarity of ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"]) {
      addPool(`${rarity}_${eventType}`, rarity, "Equipment");
    }
  } else if (chestType === "egg") {
    addPool(`${eventType}Pet`, eventType, "Pet");
  } else {
    const config = Object.hasOwn(LOOT_TABLES, chestType) ? LOOT_TABLES[chestType] : null;
    if (config) {
      for (const entry of config.table) {
        const { type, rarity } = entry.result;
        if (type === "Pet Food") {
          addItem("PetFood", "None", type);
          continue;
        }
        let poolName = rarity;
        if (type === "Pet Egg") poolName += "Egg";
        if (rarity === "Ultimate" && eventType) poolName += `_${eventType}`;
        addPool(poolName, rarity, type);
      }
      if (chestType === "pet") addItem("PetFood", "None", "Pet Food");
    }
  }

  return [...available.values()].sort(
    (a, b) => a.rarity.localeCompare(b.rarity) || a.baseName.localeCompare(b.baseName)
  );
}

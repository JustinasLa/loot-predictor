import { UnityRandom } from "../rng/unity-random.js";
import { LOOT_TABLES, ADVENTURE_LOOT_RATES, ITEM_POOLS } from "./tables.js";

// Draw order per chest, exactly as the engine consumes it:
//   per item: draw 1 -> prize type (weighted), draw 2 -> item within pool
//   after all items: one final draw -> the seed persisted for the NEXT open
// That trailing draw is why chests chain: nextSeed feeds the following open.

export function determinePrizeType(roll, table) {
  let cumulativeWeight = 0;
  for (const item of table) {
    cumulativeWeight += item.weight;
    if (roll < cumulativeWeight) return item.result;
  }
  return table[table.length - 1].result;
}

export function getSpecificItem(rng, prize, eventType = null) {
  let itemName = "N/A", itemRoll = -1, baseName = "", actualRarity = prize.rarity;

  if (prize.type === "Pet Food") {
    itemRoll = rng.range(6, 15);
    itemName = `${itemRoll} Pet Food`;
    baseName = "PetFood";
    actualRarity = "Common";
  } else {
    let poolName = prize.rarity;
    if (prize.type === "Pet Egg") poolName += "Egg";
    if (eventType === "Zeus" || eventType === "Pirate") {
      poolName += "_" + eventType;
    } else if (prize.rarity === "Ultimate" && eventType && eventType != "pet_box") {
      poolName += "_" + eventType;
    }
    const pool = ITEM_POOLS[poolName] || [];

    itemRoll = eventType == "pet_box" ? 0 : rng.range(0, pool.length);
    baseName = pool[itemRoll] || `${poolName}_NotFound`;
    itemName = `${prize.type}: ${baseName} (${prize.rarity})`;
  }

  return { itemName, itemRoll, baseName, rarity: actualRarity };
}

export function simulateChestOpening(seed, config, eventType = null) {
  const rng = new UnityRandom(seed);
  const items = [];

  for (let i = 0; i < config.itemsPerChest; i++) {
    const typeRoll = rng.range(0, config.totalWeight);
    const prize = determinePrizeType(typeRoll, config.table);
    const { itemName, itemRoll, baseName, rarity } = getSpecificItem(
      rng,
      prize,
      config.title == "Pet Box" ? "pet_box" : eventType
    );
    items.push({ name: itemName, typeRoll, itemRoll, baseName, rarity });
  }

  if (config.title === "Pet Box") {
    items.push({
      name: "150 Pet Food", typeRoll: "Guaranteed", itemRoll: "150",
      baseName: "PetFood", rarity: "common"
    });
  }

  return { items, nextSeed: rng.range(0, 2147483648) };
}

export function simulateEggOpening(seed, rarity) {
  const rng = new UnityRandom(seed);
  const pool = ITEM_POOLS[rarity + "Pet"] || [];
  const itemRoll = rng.range(0, pool.length);
  const baseName = pool[itemRoll];
  const itemName = `Pet: ${baseName} (${rarity})`;
  return {
    items: [{ name: itemName, typeRoll: "N/A", itemRoll, baseName, rarity }],
    nextSeed: rng.range(0, 2147483648)
  };
}

export function simulateAdventureChestOpening(seed, level, eventType, vaultPercentage, typeAdventure = "") {
  const rng = new UnityRandom(seed);
  const items = [];
  let keyDropsAt = -1;

  const levelData = ADVENTURE_LOOT_RATES[level - 1];
  if (!levelData) return { items: [], nextSeed: seed, error: "Invalid level" };

  const table = [];
  let totalWeight = 0;
  for (const [rarity, rate] of Object.entries(levelData.rates)) {
    const weight = rate * 10000;
    table.push({ result: { type: "Equipment", rarity }, weight });
    totalWeight += weight;
  }

  for (let i = 0; i < levelData.items; i++) {
    const typeRoll = rng.range(0, totalWeight);
    const prize = determinePrizeType(typeRoll, table);
    const { itemName, itemRoll, baseName, rarity } = getSpecificItem(rng, prize, eventType);
    items.push({ name: itemName, typeRoll, itemRoll, baseName, rarity, level });
  }

  // The key roll is always consumed, regardless of vault percentage.
  const keyRoll = rng.range(0, 100);
  if (keyRoll < vaultPercentage) {
    items.push({
      name: `${eventType} Vault Key`,
      baseName: typeAdventure.includes("Zeus") ? "ZeusKeyIcon" : "PirateKeyIcon",
      rarity: "Common", typeRoll: "Vault", itemRoll: "Key", level
    });
  }
  for (let i = 1; i <= 100; i++) {
    if (keyRoll < i) { keyDropsAt = i; break; }
  }

  return { items, nextSeed: rng.range(0, 2147483648), keyRoll, keyDropsAt };
}

// Walk one chest forward `count` times, chaining seed -> nextSeed.
export function predictChain(seed, cardId, count, opts = {}) {
  const out = [];
  let current = seed;

  for (let i = 0; i < count; i++) {
    let result;

    if (cardId.startsWith("egg_")) {
      result = simulateEggOpening(current, cardId.slice(4));
    } else if (cardId.startsWith("adventure_")) {
      const eventType = cardId.slice(10);
      result = simulateAdventureChestOpening(
        current, opts.level ?? 1, eventType, opts.vaultPercentage ?? 0, cardId
      );
    } else if (cardId.startsWith("event_")) {
      result = simulateChestOpening(current, LOOT_TABLES.event, cardId.slice(6));
    } else {
      const config = LOOT_TABLES[cardId];
      if (!config) throw new Error(`unknown chest type: ${cardId}`);
      result = simulateChestOpening(current, config);
    }

    out.push({ open: i + 1, seed: current, ...result });
    current = result.nextSeed;
  }

  return out;
}

import { describe, expect, it, vi } from "vitest";
import {
  determinePrizeType, getSpecificItem, simulateChestOpening,
  simulateEggOpening, simulateAdventureChestOpening, predictChain,
} from "../src/loot/simulate.js";
import { getAvailableItemsForChest, splitCardId } from "../src/loot/items.js";
import {
  LOOT_TABLES, ADVENTURE_LOOT_RATES, ITEM_POOLS, CHEST_ID_MAP, EGG_RARITY_MAP,
  DOMINANT_ADVENTURE_LEVELS, DOMINANT_ADVENTURE_LEVELS_FOR_ITEMS,
} from "../src/loot/tables.js";

describe("loot table integrity", () => {
  it.each(Object.entries(LOOT_TABLES))("%s weights sum to the declared total", (_, config) => {
    expect(config.table.reduce((sum, drop) => sum + drop.weight, 0)).toBe(config.totalWeight);
    expect(config.itemsPerChest).toBeGreaterThan(0);
    for (const entry of config.table) expect(entry.weight).toBeGreaterThan(0);
  });

  it("contains 100 ordered adventure levels, complete pools and valid search levels", () => {
    expect(ADVENTURE_LOOT_RATES).toHaveLength(100);
    for (const [index, level] of ADVENTURE_LOOT_RATES.entries()) {
      expect(level.level).toBe(index + 1);
      expect(Object.values(level.rates).reduce((sum, rate) => sum + rate, 0)).toBeCloseTo(100, 8);
      expect(level.items).toBe(index < 4 ? 1 : index < 24 ? 2 : index < 39 ? 3 : index < 59 ? 4 : 5);
      for (const rarity of Object.keys(level.rates)) {
        for (const event of ["Zeus", "Pirate"]) expect(ITEM_POOLS[`${rarity}_${event}`].length).toBeGreaterThan(0);
      }
    }
    for (const levels of [DOMINANT_ADVENTURE_LEVELS, DOMINANT_ADVENTURE_LEVELS_FOR_ITEMS]) {
      expect(new Set(levels).size).toBe(levels.length);
      expect(levels.every((level) => level >= 1 && level <= 100)).toBe(true);
    }
    for (const pool of Object.values(ITEM_POOLS)) {
      expect(pool.length).toBeGreaterThan(0);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });
});

describe("prize and item selection", () => {
  it("uses half-open cumulative weights and falls back to the last prize", () => {
    const table = [{ weight: 2, result: "first" }, { weight: 3, result: "last" }];
    expect(determinePrizeType(0, table)).toBe("first");
    expect(determinePrizeType(1, table)).toBe("first");
    expect(determinePrizeType(2, table)).toBe("last");
    expect(determinePrizeType(4, table)).toBe("last");
    expect(determinePrizeType(5, table)).toBe("last");
  });

  it.each([
    ["Equipment", "Common", null, "Hat_Cashier", 15],
    ["Pet Egg", "Rare", null, "Pet_Egg_Rare", 1],
    ["Equipment", "Common", "Zeus", "Ring_Bronze", 4],
    ["Equipment", "Epic", "Pirate", "Necklace_Pearls", 4],
    ["Equipment", "Ultimate", "Space", "Body_Robot", 3],
    ["Equipment", "Common", "Space", "Hat_Cashier", 15],
  ])("selects %s %s from %s", (type, rarity, event, baseName, poolLength) => {
    const rng = { range: vi.fn(() => 0) };
    expect(getSpecificItem(rng, { type, rarity }, event)).toEqual({
      itemName: `${type}: ${baseName} (${rarity})`, itemRoll: 0, baseName, rarity,
    });
    expect(rng.range).toHaveBeenCalledWith(0, poolLength);
  });

  it("defaults to the normal pool, rolls food amounts, and skips pet-box item draws", () => {
    const rng = { range: vi.fn(() => 6) };
    expect(getSpecificItem(rng, { type: "Pet Food", rarity: "None" })).toEqual({ itemName: "6 Pet Food", itemRoll: 6, baseName: "PetFood", rarity: "Common" });
    expect(rng.range).toHaveBeenCalledWith(6, 15);
    rng.range.mockClear();
    expect(getSpecificItem(rng, { type: "Pet Egg", rarity: "Ultimate" }, "pet_box").baseName).toBe("Pet_Egg_Ultimate");
    expect(rng.range).not.toHaveBeenCalled();
  });

  it("reports unmapped or out-of-range items", () => {
    const rng = { range: vi.fn(() => 0) };
    expect(getSpecificItem(rng, { type: "Equipment", rarity: "Unknown" }).baseName).toBe("Unknown_NotFound");
    expect(rng.range).toHaveBeenCalledWith(0, 0);
    rng.range.mockReturnValue(999);
    expect(getSpecificItem(rng, { type: "Equipment", rarity: "Common" }).baseName).toBe("Common_NotFound");
  });
});

describe("opening simulation", () => {
  it("has a fixed big-chest result and consumes the trailing seed draw", () => {
    const open = simulateChestOpening(42, LOOT_TABLES.big);
    expect(open.items.map((item) => [item.baseName, item.typeRoll, item.itemRoll])).toEqual([
      ["Hat_Round", 6697, 2], ["Body_RedGray", 1258, 7],
      ["Hat_Chef", 1688, 3], ["Body_Waiter", 7262, 7],
      ["Tool_MetalSpatula", 1740, 11], ["Hat_Chef", 2351, 3],
    ]);
    expect(open.nextSeed).toBe(1085775344);
    expect(open.items.every((item) => item.name.includes(item.baseName))).toBe(true);
  });

  it("pet boxes draw only prize types and guarantee 150 food", () => {
    const open = simulateChestOpening(1, LOOT_TABLES.pet);
    expect(open.items.map((item) => item.baseName)).toEqual(["Pet_Egg_Common", "Pet_Egg_Common", "Pet_Egg_Common", "PetFood"]);
    expect(open.items[3]).toMatchObject({ name: "150 Pet Food", typeRoll: "Guaranteed", itemRoll: "150", rarity: "Common" });
    expect(open.nextSeed).toBe(1657007234);
  });

  it("opens pets from eggs and rejects an unmapped egg rarity", () => {
    expect(simulateEggOpening(42, "Rare")).toEqual({
      items: [{ name: "Pet: Pet_GoldenRetriever (Rare)", typeRoll: "N/A", itemRoll: 1, baseName: "Pet_GoldenRetriever", rarity: "Rare" }],
      nextSeed: 302596119,
    });
    expect(() => simulateEggOpening(42, "Unknown")).toThrow("unknown chest type: egg_Unknown");
  });

  it("always consumes the vault roll and drops a key strictly above its threshold", () => {
    const without = simulateAdventureChestOpening(42, 1, "Zeus", 0);
    expect(without).toMatchObject({ nextSeed: 1122627734, keyRoll: 12, keyDropsAt: 13 });
    expect(without.items.map((item) => item.baseName)).toEqual(["Ring_Bronze"]);
    expect(simulateAdventureChestOpening(42, 1, "Zeus", 12).items).toHaveLength(1);
    const withKey = simulateAdventureChestOpening(42, 1, "Zeus", 13);
    expect(withKey.items.at(-1)).toMatchObject({ baseName: "ZeusKeyIcon", typeRoll: "Vault", level: 1 });
    expect(withKey.nextSeed).toBe(without.nextSeed);
    expect(simulateAdventureChestOpening(42, 1, "Pirate", 100).items.at(-1).baseName).toBe("PirateKeyIcon");
    expect(simulateAdventureChestOpening(42, 1, "Zeus")).toEqual(without);
  });

  it.each([0, -1, 1.5, 101, NaN])("rejects adventure level %s", (level) => {
    expect(() => simulateAdventureChestOpening(42, level, "Zeus", 0)).toThrow("level must be an integer from 1 to 100");
    expect(() => predictChain(42, "adventure_Zeus", 2, { level })).toThrow("level must be an integer from 1 to 100");
  });

  it("uses integer rarity boundaries rather than floating-point weight artifacts", () => {
    const result = simulateAdventureChestOpening(42285, 77, "Zeus", 0);
    expect(result.items[1]).toMatchObject({ typeRoll: 475200, rarity: "Rare", baseName: "Ring_Plastic" });
  });

  it.each(["__proto__", "constructor", "event", "egg_Common", "egg_Unknown", "adventure_Unknown", "event_Unknown", null])("rejects unsupported chest %s even for an empty chain", (cardId) => {
    expect(() => predictChain(12, cardId, 1)).toThrow("unknown chest type:");
    expect(() => predictChain(12, cardId, 0)).toThrow("unknown chest type:");
  });

  it.each([-1, 1.1, NaN, Infinity, "2", Number.MAX_SAFE_INTEGER + 1])("rejects invalid chain count %s", (count) => {
    expect(() => predictChain(1, "big", count)).toThrow("count must be an integer");
  });

  it("rejects unknown event variants and invalid vault percentages", () => {
    expect(() => simulateChestOpening(12, LOOT_TABLES.event)).toThrow("unknown chest type: event_null");
    expect(() => simulateAdventureChestOpening(12, 1, "Unknown", 0)).toThrow("unknown chest type: adventure_Unknown");
    expect(() => simulateAdventureChestOpening(12, 1, "Zeus", 101)).toThrow("vault percentage");
    expect(() => predictChain(12, "adventure_Zeus", 0, { vaultPercentage: -1 })).toThrow("vault percentage");
  });

  it.each([...Object.values(CHEST_ID_MAP), ...Object.values(EGG_RARITY_MAP)])("chains three %s openings", (cardId) => {
    const chain = predictChain(42, cardId, 3, { level: 100, vaultPercentage: 100 });
    expect(chain).toHaveLength(3);
    expect(chain[0].seed).toBe(42);
    for (const [index, open] of chain.entries()) {
      expect(open.open).toBe(index + 1);
      expect(open.nextSeed).toBeGreaterThanOrEqual(0);
      expect(open.nextSeed).toBeLessThan(2147483648);
      expect(open.items.length).toBeGreaterThan(0);
      if (index) expect(open.seed).toBe(chain[index - 1].nextSeed);
    }
  });

  it("uses default adventure options and explicit zero without replacing it", () => {
    expect(predictChain(42, "adventure_Zeus", 1)[0]).toMatchObject(simulateAdventureChestOpening(42, 1, "Zeus", 0, "adventure_Zeus"));
    expect(() => predictChain(42, "adventure_Zeus", 1, { level: 0 })).toThrow("level must be an integer");
    expect(predictChain(1, "big", 0)).toEqual([]);
    expect(predictChain(1, "adventure_Zeus", 0)).toEqual([]);
    expect(() => predictChain(1, "unknown", 1)).toThrow("unknown chest type: unknown");
  });
});

describe("item picker pools", () => {
  it.each([["big", ["big", null]], ["egg_Rare", ["egg", "Rare"]], ["adventure_Zeus", ["adventure", "Zeus"]]])("splits %s", (cardId, expected) => {
    expect(splitCardId(cardId)).toEqual(expected);
  });

  it.each([...Object.values(CHEST_ID_MAP), ...Object.values(EGG_RARITY_MAP)])("lists unique sorted reachable items for %s", (cardId) => {
    const items = getAvailableItemsForChest(cardId);
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((item) => item.baseName)).size).toBe(items.length);
    const sorted = [...items].sort((a, b) => a.rarity.localeCompare(b.rarity) || a.baseName.localeCompare(b.baseName));
    expect(items).toEqual(sorted);
    for (const open of predictChain(1, cardId, 5, { level: 100 })) {
      for (const item of open.items.filter((item) => item.baseName !== "PetFood")) {
        expect(items.map((item) => item.baseName)).toContain(item.baseName);
      }
    }
  });

  it("handles missing pools, unknown chests and event types without variants", () => {
    expect(getAvailableItemsForChest("unknown")).toEqual([]);
    expect(getAvailableItemsForChest("adventure_Unknown")).toEqual([]);
    expect(getAvailableItemsForChest("egg_Unknown")).toEqual([]);
    expect(getAvailableItemsForChest("event").every((item) => item.rarity !== "Ultimate")).toBe(true);
    expect(getAvailableItemsForChest("pet").map((item) => item.baseName)).toContain("Pet_Egg_Ultimate");
  });
});

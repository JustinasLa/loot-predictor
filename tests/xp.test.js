import { afterEach, describe, expect, it, vi } from "vitest";
import { getItemXp, totalXp, getAverageXpForAdventure, AVERAGE_XP } from "../src/loot/xp.js";
import { ADVENTURE_LOOT_RATES, XP_VALUES_ITEMS, XP_VALUES_EGGS } from "../src/loot/tables.js";
import { item } from "./fixtures.js";

afterEach(() => vi.doUnmock("../src/loot/tables.js"));

describe("XP scoring", () => {
  it.each(Object.entries(XP_VALUES_ITEMS))("scores equipment and pets of rarity %s", (rarity, xp) => {
    expect(getItemXp(item("Equipment", rarity))).toBe(xp);
    expect(getItemXp({ ...item("Pet", rarity.toLowerCase()), name: `Pet: Pet (${rarity})` })).toBe(xp);
  });

  it.each(Object.entries(XP_VALUES_EGGS))("scores %s eggs on the egg scale", (rarity, xp) => {
    expect(getItemXp({ ...item("Pet_Egg", rarity), name: `Pet Egg: Pet_Egg (${rarity})` })).toBe(xp);
  });

  it.each([null, {}, { rarity: "" }, item("PetFood"), item("VaultKey"), item("ZeusKeyIcon"), item("PirateKeyIcon")])("gives zero XP to %j", (value) => {
    expect(getItemXp(value)).toBe(0);
  });

  it("scores missing base names and unknown rarities defensively", () => {
    expect(getItemXp({ rarity: "Common", name: "Equipment" })).toBe(4);
    expect(getItemXp(item("Missing", "Unknown"))).toBe(0);
    expect(getItemXp({ rarity: "Unknown", name: "Pet Egg: Missing" })).toBe(0);
    expect(totalXp([])).toBe(0);
    expect(totalXp([item(), item("Epic", "Epic"), item("PetFood")])).toBe(26);
  });

  it("calculates fixed chest and adventure expectations including egg XP", () => {
    expect(AVERAGE_XP.small).toBeCloseTo(2 * (24000 + 10800 + 6600 + 2500 + 1250) / 10025);
    expect(AVERAGE_XP.big).toBeCloseTo(6 * (19200 + 27000 + 33000 + 13000 + 30000 + 10625) / 10025);
    expect(AVERAGE_XP.pet).toBeCloseTo(3 * (147500 + 140000 + 165000 + 59500 + 50000) / 9990);
    expect(getAverageXpForAdventure(1)).toBeCloseTo(4 * 0.9915 + 9 * 0.0085);
    expect(getAverageXpForAdventure(100)).toBeCloseTo(5 * (4 * 0.47 + 9 * 0.3 + 22 * 0.15 + 26 * 0.05 + 61 * 0.02 + 144 * 0.01));
    expect(getAverageXpForAdventure(0)).toBe(0);
    expect(getAverageXpForAdventure(101)).toBe(0);
  });

  it("ignores unknown adventure rarities in future loot tables", () => {
    ADVENTURE_LOOT_RATES.push({ rates: { Unknown: 100 }, items: 1 });
    try { expect(getAverageXpForAdventure(101)).toBe(0); }
    finally { ADVENTURE_LOOT_RATES.pop(); }
  });

  it("ignores unpriced eggs and equipment when calculating future chest averages", async () => {
    vi.resetModules();
    vi.doMock("../src/loot/tables.js", async () => {
      const actual = await vi.importActual("../src/loot/tables.js");
      return { ...actual, LOOT_TABLES: {
        unknown: { totalWeight: 2, itemsPerChest: 1, table: [
          { weight: 1, result: { rarity: "Unknown", type: "Pet Egg" } },
          { weight: 1, result: { rarity: "Unknown", type: "Equipment" } },
        ] },
      } };
    });
    expect((await import("../src/loot/xp.js")).AVERAGE_XP.unknown).toBe(0);
  });
});

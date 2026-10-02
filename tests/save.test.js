import { describe, expect, it } from "vitest";
import { parseSavegame } from "../src/save/parse.js";
import { CHEST_ID_MAP, EGG_RARITY_MAP } from "../src/loot/tables.js";
import { savegame } from "./fixtures.js";

describe("parseSavegame", () => {
  it("accepts hash-prefixed and unwrapped saves and preserves seed metadata", () => {
    const save = savegame();
    const states = parseSavegame(`aW50ZWdyaXR5\n${JSON.stringify(save)}\n`);
    expect(states.big).toEqual({ initialSeed: 42, openedCount: 12, chestId: 1 });
    expect(states.egg_Rare).toEqual({ initialSeed: 42, eggRarity: 1 });
    expect(states.adventure_Zeus.level).toBe(5);
    expect(states.adventure_Pirate.level).toBe(24);
    expect(parseSavegame(JSON.stringify(save.Data))).toEqual(states);
  });

  it("maps every supported chest and egg and skips unknown ids", () => {
    const character = {
      EquipmentChestSavegames: [...Object.keys(CHEST_ID_MAP), 999].map((ChestId) => ({ ChestId, Seed: -1, OpenedCount: 0 })),
      PetEggSeeds: [...Object.keys(EGG_RARITY_MAP), 999].map((EggRarity) => ({ EggRarity, Seed: 0 })),
    };
    const states = parseSavegame(JSON.stringify({ GameSavegame: { CharacterSavegame: character } }));
    expect(Object.keys(states).sort()).toEqual([...Object.values(CHEST_ID_MAP), ...Object.values(EGG_RARITY_MAP)].sort());
    expect(states.small.initialSeed).toBe(-1);
  });

  it.each([{}, { CharacterSavegame: {} }, { AdventuresSavegame: {} }])("handles absent optional save sections: %j", (GameSavegame) => {
    expect(parseSavegame(JSON.stringify({ GameSavegame }))).toEqual({});
  });

  it("uses level one for missing/zero levels and ignores adventures without a chest", () => {
    const save = savegame();
    save.Data.GameSavegame.AdventuresSavegame.AdventureInfos = { Greek: {}, Pirates: { UnlockedLevel: 0 } };
    const states = parseSavegame(JSON.stringify(save));
    expect(states.adventure_Zeus.level).toBe(1);
    expect(states.adventure_Pirate.level).toBe(1);
    save.Data.GameSavegame.CharacterSavegame = {};
    expect(parseSavegame(JSON.stringify(save))).toEqual({});
  });

  it.each(["", "hash only", "{", "}"])("rejects files without a JSON body: %j", (text) => {
    expect(() => parseSavegame(text)).toThrow("no json");
  });

  it("rejects malformed JSON and non-savegame JSON", () => {
    expect(() => parseSavegame("{broken}")).toThrow(SyntaxError);
    expect(() => parseSavegame("{}")).toThrow("not a valid savegame");
  });
});

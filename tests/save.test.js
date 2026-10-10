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

  it.each([{}, { CharacterSavegame: {} }, { AdventuresSavegame: {} }])("rejects saves without supported records: %j", (GameSavegame) => {
    expect(() => parseSavegame(JSON.stringify({ GameSavegame }))).toThrow("no supported chests or eggs");
  });

  it("uses level one for missing/zero levels and ignores adventures without a chest", () => {
    const save = savegame();
    save.Data.GameSavegame.AdventuresSavegame.AdventureInfos = { Greek: {}, Pirates: { UnlockedLevel: 0 } };
    const states = parseSavegame(JSON.stringify(save));
    expect(states.adventure_Zeus.level).toBe(1);
    expect(states.adventure_Pirate.level).toBe(1);
    save.Data.GameSavegame.CharacterSavegame = {};
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("no supported chests or eggs");
  });

  it.each(["", "hash only", "{", "}"])("rejects files without a JSON body: %j", (text) => {
    expect(() => parseSavegame(text)).toThrow("no json");
  });

  it("rejects malformed JSON and non-savegame JSON", () => {
    expect(() => parseSavegame("{broken}")).toThrow(SyntaxError);
    expect(() => parseSavegame("{}")).toThrow("not a valid savegame");
  });

  it.each([null, 42, {}])("requires savegame text: %j", (text) => {
    expect(() => parseSavegame(text)).toThrow("savegame must be text");
  });

  it.each([null, [], "bad", 1])("rejects non-object root sections: %j", (value) => {
    expect(() => parseSavegame(JSON.stringify({ Data: value }))).toThrow("Data must be an object");
    expect(() => parseSavegame(JSON.stringify({ GameSavegame: value }))).toThrow("GameSavegame must be an object");
  });

  it.each(["CharacterSavegame", "AdventuresSavegame"])("rejects malformed optional object %s", (field) => {
    const save = savegame();
    save.Data.GameSavegame[field] = [];
    expect(() => parseSavegame(JSON.stringify(save))).toThrow(`${field} must be an object`);
  });

  it.each(["EquipmentChestSavegames", "PetEggSeeds"])("rejects malformed record arrays and entries in %s", (field) => {
    const save = savegame();
    save.Data.GameSavegame.CharacterSavegame[field] = {};
    expect(() => parseSavegame(JSON.stringify(save))).toThrow(`${field} must be an array`);
    save.Data.GameSavegame.CharacterSavegame[field] = [null];
    expect(() => parseSavegame(JSON.stringify(save))).toThrow(`${field}[0] must be an object`);
  });

  it.each([undefined, null, "42", 1.5, -2147483649, 2147483648])("rejects malformed seeds on supported records: %s", (Seed) => {
    const save = savegame();
    save.Data.GameSavegame.CharacterSavegame.EquipmentChestSavegames[0].Seed = Seed;
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("EquipmentChestSavegames[0] (big).Seed");
    save.Data.GameSavegame.CharacterSavegame.EquipmentChestSavegames[0].Seed = 42;
    save.Data.GameSavegame.CharacterSavegame.PetEggSeeds[0].Seed = Seed;
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("PetEggSeeds[0] (egg_Rare).Seed");
  });

  it.each(["__proto__", "constructor", "invalid", -1, 1.5, null])("rejects malformed record IDs: %s", (id) => {
    const save = savegame();
    save.Data.GameSavegame.CharacterSavegame.EquipmentChestSavegames[0].ChestId = id;
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("EquipmentChestSavegames[0].ChestId");
    save.Data.GameSavegame.CharacterSavegame.EquipmentChestSavegames[0].ChestId = 1;
    save.Data.GameSavegame.CharacterSavegame.PetEggSeeds[0].EggRarity = id;
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("PetEggSeeds[0].EggRarity");
  });

  it("skips numeric future IDs without requiring their unknown schemas", () => {
    const save = savegame();
    save.Data.GameSavegame.CharacterSavegame.EquipmentChestSavegames.push({ ChestId: 999 });
    save.Data.GameSavegame.CharacterSavegame.PetEggSeeds.push({ EggRarity: "999" });
    expect(parseSavegame(JSON.stringify(save))).toEqual(parseSavegame(JSON.stringify(savegame())));
  });

  it("validates provided counts and duplicate supported IDs", () => {
    const save = savegame();
    const character = save.Data.GameSavegame.CharacterSavegame;
    character.EquipmentChestSavegames[0].OpenedCount = -1;
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("OpenedCount");
    delete character.EquipmentChestSavegames[0].OpenedCount;
    expect(parseSavegame(JSON.stringify(save)).big.openedCount).toBeUndefined();
    character.EquipmentChestSavegames.push({ ChestId: 1, Seed: 1 });
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("duplicate chest big");
    character.EquipmentChestSavegames.pop();
    character.PetEggSeeds.push({ EggRarity: 1, Seed: 1 });
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("duplicate egg egg_Rare");
  });

  it.each([-1, 1.5, 101, "5", null])("rejects invalid unlocked levels: %s", (UnlockedLevel) => {
    const save = savegame();
    save.Data.GameSavegame.AdventuresSavegame.AdventureInfos.Greek.UnlockedLevel = UnlockedLevel;
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("AdventureInfos.Greek.UnlockedLevel");
  });

  it("validates adventure metadata structures and defaults absent levels to one", () => {
    const save = savegame();
    save.Data.GameSavegame.AdventuresSavegame.AdventureInfos = [];
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("AdventureInfos must be an object");
    save.Data.GameSavegame.AdventuresSavegame.AdventureInfos = { Greek: null };
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("AdventureInfos.Greek must be an object");
    delete save.Data.GameSavegame.AdventuresSavegame;
    expect(parseSavegame(JSON.stringify(save)).adventure_Zeus.level).toBe(1);
  });

  it("accepts saves containing only eggs and optional missing metadata", () => {
    const save = { GameSavegame: { CharacterSavegame: { PetEggSeeds: [{ EggRarity: 1, Seed: -2147483648 }] } } };
    expect(parseSavegame(JSON.stringify(save))).toEqual({ egg_Rare: { initialSeed: -2147483648, eggRarity: 1 } });
    delete save.GameSavegame.CharacterSavegame.PetEggSeeds;
    expect(() => parseSavegame(JSON.stringify(save))).toThrow("no supported chests or eggs");
  });
});

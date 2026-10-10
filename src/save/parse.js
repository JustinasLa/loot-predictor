import { CHEST_ID_MAP, EGG_RARITY_MAP } from "../loot/tables.js";
import { validateInteger, validateSeed, validateLevel } from "../validation.js";

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function optionalObject(value, label) {
  return value === undefined ? {} : requireObject(value, label);
}

function optionalArray(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function numericId(value, label) {
  // Accept decimal ID strings as well as numeric IDs; seeds stay JSON numbers.
  const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return validateInteger(id, label);
}

// Savegame files are prefixed with a base64 integrity hash before the JSON
// body, so slice from the first { to the last } instead of parsing directly.
export function parseSavegame(text) {
  if (typeof text !== "string") throw new TypeError("savegame must be text");
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd < jsonStart) throw new Error("no json body in savegame");

  const savegame = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
  const data = savegame.Data === undefined ? savegame : requireObject(savegame.Data, "Data");
  const gameData = data.GameSavegame;
  requireObject(gameData, "not a valid savegame: GameSavegame");

  const cardStates = {};
  const character = optionalObject(gameData.CharacterSavegame, "CharacterSavegame");
  const chests = optionalArray(character.EquipmentChestSavegames, "EquipmentChestSavegames");
  const eggs = optionalArray(character.PetEggSeeds, "PetEggSeeds");

  for (const [index, chest] of chests.entries()) {
    const context = `EquipmentChestSavegames[${index}]`;
    requireObject(chest, context);
    const chestId = numericId(chest.ChestId, `${context}.ChestId`);
    if (!Object.hasOwn(CHEST_ID_MAP, chestId)) continue;
    const cardId = CHEST_ID_MAP[chestId];
    if (Object.hasOwn(cardStates, cardId)) throw new Error(`${context}: duplicate chest ${cardId}`);
    cardStates[cardId] = {
      initialSeed: validateSeed(chest.Seed, `${context} (${cardId}).Seed`),
      openedCount: chest.OpenedCount === undefined ? undefined : validateInteger(chest.OpenedCount, `${context}.OpenedCount`),
      chestId
    };
  }

  for (const [index, egg] of eggs.entries()) {
    const context = `PetEggSeeds[${index}]`;
    requireObject(egg, context);
    const eggRarity = numericId(egg.EggRarity, `${context}.EggRarity`);
    if (!Object.hasOwn(EGG_RARITY_MAP, eggRarity)) continue;
    const cardId = EGG_RARITY_MAP[eggRarity];
    if (Object.hasOwn(cardStates, cardId)) throw new Error(`${context}: duplicate egg ${cardId}`);
    cardStates[cardId] = {
      initialSeed: validateSeed(egg.Seed, `${context} (${cardId}).Seed`), eggRarity
    };
  }

  const adventures = optionalObject(gameData.AdventuresSavegame, "AdventuresSavegame");
  const adventureInfos = optionalObject(adventures.AdventureInfos, "AdventureInfos");
  for (const [name, cardId] of [["Greek", "adventure_Zeus"], ["Pirates", "adventure_Pirate"]]) {
    const info = optionalObject(adventureInfos[name], `AdventureInfos.${name}`);
    const unlocked = info.UnlockedLevel;
    // Keep the legacy convention that a saved level of zero starts at level one.
    const level = unlocked === undefined || unlocked === 0 ? 1 : validateLevel(unlocked, `AdventureInfos.${name}.UnlockedLevel`);
    if (Object.hasOwn(cardStates, cardId)) cardStates[cardId].level = level;
  }

  if (Object.keys(cardStates).length === 0) throw new Error("savegame contains no supported chests or eggs");
  return cardStates;
}

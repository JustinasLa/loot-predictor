import { CHEST_ID_MAP, EGG_RARITY_MAP } from "../loot/tables.js";

// Savegame files are prefixed with a base64 integrity hash before the JSON
// body, so slice from the first { to the last } instead of parsing directly.
export function parseSavegame(text) {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("no JSON found in file");

  const savegame = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
  const data = savegame.Data || savegame;
  const gameData = data.GameSavegame;
  if (!gameData) throw new Error("invalid savegame format");

  const cardStates = {};
  const character = gameData.CharacterSavegame || {};

  for (const chest of character.EquipmentChestSavegames || []) {
    const cardId = CHEST_ID_MAP[chest.ChestId];
    if (!cardId) continue;
    cardStates[cardId] = {
      initialSeed: chest.Seed,
      openedCount: chest.OpenedCount,
      chestId: chest.ChestId
    };
  }

  for (const egg of character.PetEggSeeds || []) {
    const cardId = EGG_RARITY_MAP[egg.EggRarity];
    if (!cardId) continue;
    cardStates[cardId] = { initialSeed: egg.Seed, eggRarity: egg.EggRarity };
  }

  const adventureInfos = gameData.AdventuresSavegame?.AdventureInfos || {};
  if (adventureInfos.Greek && cardStates["adventure_Zeus"]) {
    cardStates["adventure_Zeus"].level = adventureInfos.Greek.UnlockedLevel || 1;
  }
  if (adventureInfos.Pirates && cardStates["adventure_Pirate"]) {
    cardStates["adventure_Pirate"].level = adventureInfos.Pirates.UnlockedLevel || 1;
  }

  return cardStates;
}

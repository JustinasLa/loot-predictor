export function savegame() {
  return {
    Data: {
      GameSavegame: {
        CharacterSavegame: {
          EquipmentChestSavegames: [
            { ChestId: 1, Seed: 42, OpenedCount: 12 },
            { ChestId: 0, Seed: 1, OpenedCount: 0 },
            { ChestId: 9, Seed: 42, OpenedCount: 7 },
            { ChestId: 10, Seed: 1, OpenedCount: 2 },
            { ChestId: 4, Seed: 42, OpenedCount: 0 },
            { ChestId: 6, Seed: 1, OpenedCount: 0 },
          ],
          PetEggSeeds: [{ EggRarity: 1, Seed: 42 }],
        },
        AdventuresSavegame: {
          AdventureInfos: {
            Greek: { UnlockedLevel: 5 },
            Pirates: { UnlockedLevel: 24 },
          },
        },
      },
    },
  };
}

export function item(baseName = "Ring_Bronze", rarity = "Common") {
  return { baseName, rarity, name: `Equipment: ${baseName} (${rarity})` };
}

export function step(level = 4, usedSeed = 42, items = [item()]) {
  return { level, usedSeed, items, xp: 4, hits: [items[0].baseName] };
}

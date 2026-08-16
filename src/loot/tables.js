// Loot tables, item pools and savegame id maps.
// Ported verbatim from the reference implementation (github.com/1vcian/ev),
// which mapped them empirically from real Eatventure openings.

export const LOOT_TABLES = {
        small: { title: 'Small Box', itemsPerChest: 2, totalWeight: 10025, table: [{ result: { type: 'Equipment', rarity: 'Common' }, weight: 6000 }, { result: { type: 'Equipment', rarity: 'Rare' }, weight: 1200 }, { result: { type: 'Equipment', rarity: 'Epic' }, weight: 300 }, { result: { type: 'Pet Egg', rarity: 'Common' }, weight: 100 }, { result: { type: 'Pet Egg', rarity: 'Rare' }, weight: 25 }, { result: { type: 'Pet Food', rarity: 'None' }, weight: 2400 },] },
        big: { title: 'Big Box', itemsPerChest: 6, totalWeight: 10025, table: [{ result: { type: 'Equipment', rarity: 'Common' }, weight: 4800 }, { result: { type: 'Equipment', rarity: 'Rare' }, weight: 3000 }, { result: { type: 'Equipment', rarity: 'Epic' }, weight: 1500 }, { result: { type: 'Equipment', rarity: 'Legendary' }, weight: 500 }, { result: { type: 'Pet Egg', rarity: 'Epic' }, weight: 200 }, { result: { type: 'Pet Egg', rarity: 'Legendary' }, weight: 25 },] },
        clan: { title: 'Clan Chest', itemsPerChest: 6, totalWeight: 10000, table: [{ result: { type: 'Equipment', rarity: 'Rare' }, weight: 5300 }, { result: { type: 'Equipment', rarity: 'Epic' }, weight: 3300 }, { result: { type: 'Equipment', rarity: 'Legendary' }, weight: 1200 }, { result: { type: 'Equipment', rarity: 'Mythic' }, weight: 200 },] },
        event: { title: 'Event Chest', itemsPerChest: 6, totalWeight: 10000, table: [{ result: { type: 'Equipment', rarity: 'Common' }, weight: 4800 }, { result: { type: 'Equipment', rarity: 'Rare' }, weight: 3000 }, { result: { type: 'Equipment', rarity: 'Epic' }, weight: 1500 }, { result: { type: 'Equipment', rarity: 'Legendary' }, weight: 500 }, { result: { type: 'Equipment', rarity: 'Ultimate' }, weight: 200 },] },
        pet: { title: 'Pet Box', itemsPerChest: 3, totalWeight: 9990, table: [{ result: { type: 'Pet Egg', rarity: 'Common' }, weight: 5900 }, { result: { type: 'Pet Egg', rarity: 'Rare' }, weight: 2800 }, { result: { type: 'Pet Egg', rarity: 'Epic' }, weight: 1100 }, { result: { type: 'Pet Egg', rarity: 'Legendary' }, weight: 140 }, { result: { type: 'Pet Egg', rarity: 'Ultimate' }, weight: 50 },] }
    };

export const ADVENTURE_LOOT_RATES = [
        // Level, Common, Rare, Epic, Legendary, Ultimate, Mythic, Items Count
        { level: 1, rates: { Common: 99.15, Rare: 0.85 }, items: 1 }, { level: 2, rates: { Common: 98.30, Rare: 1.70 }, items: 1 },
        { level: 3, rates: { Common: 97.45, Rare: 2.55 }, items: 1 }, { level: 4, rates: { Common: 96.60, Rare: 3.40 }, items: 1 },
        { level: 5, rates: { Common: 95.75, Rare: 4.25 }, items: 2 }, { level: 6, rates: { Common: 94.90, Rare: 5.10 }, items: 2 },
        { level: 7, rates: { Common: 94.05, Rare: 5.95 }, items: 2 }, { level: 8, rates: { Common: 93.20, Rare: 6.80 }, items: 2 },
        { level: 9, rates: { Common: 92.35, Rare: 7.65 }, items: 2 }, { level: 10, rates: { Common: 91.10, Rare: 8.50, Epic: 0.40 }, items: 2 },
        { level: 11, rates: { Common: 89.85, Rare: 9.35, Epic: 0.80 }, items: 2 }, { level: 12, rates: { Common: 88.60, Rare: 10.20, Epic: 1.20 }, items: 2 },
        { level: 13, rates: { Common: 87.35, Rare: 11.05, Epic: 1.60 }, items: 2 }, { level: 14, rates: { Common: 86.10, Rare: 11.90, Epic: 2.00 }, items: 2 },
        { level: 15, rates: { Common: 84.85, Rare: 12.75, Epic: 2.40 }, items: 2 }, { level: 16, rates: { Common: 83.60, Rare: 13.60, Epic: 2.80 }, items: 2 },
        { level: 17, rates: { Common: 82.35, Rare: 14.45, Epic: 3.20 }, items: 2 }, { level: 18, rates: { Common: 81.10, Rare: 15.30, Epic: 3.60 }, items: 2 },
        { level: 19, rates: { Common: 79.85, Rare: 16.15, Epic: 4.00 }, items: 2 }, { level: 20, rates: { Common: 78.48, Rare: 17.00, Epic: 4.40, Legendary: 0.12 }, items: 2 },
        { level: 21, rates: { Common: 77.11, Rare: 17.85, Epic: 4.80, Legendary: 0.24 }, items: 2 }, { level: 22, rates: { Common: 75.74, Rare: 18.70, Epic: 5.20, Legendary: 0.36 }, items: 2 },
        { level: 23, rates: { Common: 74.37, Rare: 19.55, Epic: 5.60, Legendary: 0.48 }, items: 2 }, { level: 24, rates: { Common: 73.00, Rare: 20.40, Epic: 6.00, Legendary: 0.60 }, items: 2 },
        { level: 25, rates: { Common: 71.63, Rare: 21.25, Epic: 6.40, Legendary: 0.72 }, items: 3 }, { level: 26, rates: { Common: 70.26, Rare: 22.10, Epic: 6.80, Legendary: 0.84 }, items: 3 },
        { level: 27, rates: { Common: 68.89, Rare: 22.95, Epic: 7.20, Legendary: 0.96 }, items: 3 }, { level: 28, rates: { Common: 67.52, Rare: 23.80, Epic: 7.60, Legendary: 1.08 }, items: 3 },
        { level: 29, rates: { Common: 66.15, Rare: 24.65, Epic: 8.00, Legendary: 1.20 }, items: 3 }, { level: 30, rates: { Common: 64.74, Rare: 25.50, Epic: 8.40, Legendary: 1.32, Ultimate: 0.04 }, items: 3 },
        { level: 31, rates: { Common: 63.33, Rare: 26.35, Epic: 8.80, Legendary: 1.44, Ultimate: 0.08 }, items: 3 }, { level: 32, rates: { Common: 61.92, Rare: 27.20, Epic: 9.20, Legendary: 1.56, Ultimate: 0.12 }, items: 3 },
        { level: 33, rates: { Common: 60.51, Rare: 28.05, Epic: 9.60, Legendary: 1.68, Ultimate: 0.16 }, items: 3 }, { level: 34, rates: { Common: 59.10, Rare: 28.90, Epic: 10.00, Legendary: 1.80, Ultimate: 0.20 }, items: 3 },
        { level: 35, rates: { Common: 57.69, Rare: 29.75, Epic: 10.40, Legendary: 1.92, Ultimate: 0.24 }, items: 3 }, { level: 36, rates: { Common: 56.88, Rare: 30.00, Epic: 10.80, Legendary: 2.04, Ultimate: 0.28 }, items: 3 },
        { level: 37, rates: { Common: 56.32, Rare: 30.00, Epic: 11.20, Legendary: 2.16, Ultimate: 0.32 }, items: 3 }, { level: 38, rates: { Common: 55.76, Rare: 30.00, Epic: 11.60, Legendary: 2.28, Ultimate: 0.36 }, items: 3 },
        { level: 39, rates: { Common: 55.20, Rare: 30.00, Epic: 12.00, Legendary: 2.40, Ultimate: 0.40 }, items: 3 }, { level: 40, rates: { Common: 54.64, Rare: 30.00, Epic: 12.40, Legendary: 2.52, Ultimate: 0.44 }, items: 4 },
        { level: 41, rates: { Common: 54.08, Rare: 30.00, Epic: 12.80, Legendary: 2.64, Ultimate: 0.48 }, items: 4 }, { level: 42, rates: { Common: 53.52, Rare: 30.00, Epic: 13.20, Legendary: 2.76, Ultimate: 0.52 }, items: 4 },
        { level: 43, rates: { Common: 52.96, Rare: 30.00, Epic: 13.60, Legendary: 2.88, Ultimate: 0.56 }, items: 4 }, { level: 44, rates: { Common: 52.40, Rare: 30.00, Epic: 14.00, Legendary: 3.00, Ultimate: 0.60 }, items: 4 },
        { level: 45, rates: { Common: 51.84, Rare: 30.00, Epic: 14.40, Legendary: 3.12, Ultimate: 0.64 }, items: 4 }, { level: 46, rates: { Common: 51.28, Rare: 30.00, Epic: 14.80, Legendary: 3.24, Ultimate: 0.68 }, items: 4 },
        { level: 47, rates: { Common: 50.92, Rare: 30.00, Epic: 15.00, Legendary: 3.36, Ultimate: 0.72 }, items: 4 }, { level: 48, rates: { Common: 50.76, Rare: 30.00, Epic: 15.00, Legendary: 3.48, Ultimate: 0.76 }, items: 4 },
        { level: 49, rates: { Common: 50.60, Rare: 30.00, Epic: 15.00, Legendary: 3.60, Ultimate: 0.80 }, items: 4 },
        { level: 50, rates: { Common: 50.42, Rare: 30.00, Epic: 15.00, Legendary: 3.72, Ultimate: 0.84, Mythic: 0.02 }, items: 4 },
        { level: 51, rates: { Common: 50.24, Rare: 30.00, Epic: 15.00, Legendary: 3.84, Ultimate: 0.88, Mythic: 0.04 }, items: 4 }, { level: 52, rates: { Common: 50.06, Rare: 30.00, Epic: 15.00, Legendary: 3.96, Ultimate: 0.92, Mythic: 0.06 }, items: 4 },
        { level: 53, rates: { Common: 49.88, Rare: 30.00, Epic: 15.00, Legendary: 4.08, Ultimate: 0.96, Mythic: 0.08 }, items: 4 }, { level: 54, rates: { Common: 49.70, Rare: 30.00, Epic: 15.00, Legendary: 4.20, Ultimate: 1.00, Mythic: 0.10 }, items: 4 },
        { level: 55, rates: { Common: 49.52, Rare: 30.00, Epic: 15.00, Legendary: 4.32, Ultimate: 1.04, Mythic: 0.12 }, items: 4 }, { level: 56, rates: { Common: 49.34, Rare: 30.00, Epic: 15.00, Legendary: 4.44, Ultimate: 1.08, Mythic: 0.14 }, items: 4 },
        { level: 57, rates: { Common: 49.16, Rare: 30.00, Epic: 15.00, Legendary: 4.56, Ultimate: 1.12, Mythic: 0.16 }, items: 4 }, { level: 58, rates: { Common: 48.98, Rare: 30.00, Epic: 15.00, Legendary: 4.68, Ultimate: 1.16, Mythic: 0.18 }, items: 4 },
        { level: 59, rates: { Common: 48.80, Rare: 30.00, Epic: 15.00, Legendary: 4.80, Ultimate: 1.20, Mythic: 0.20 }, items: 4 }, { level: 60, rates: { Common: 48.62, Rare: 30.00, Epic: 15.00, Legendary: 4.92, Ultimate: 1.24, Mythic: 0.22 }, items: 5 },
        { level: 61, rates: { Common: 48.48, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.28, Mythic: 0.24 }, items: 5 }, { level: 62, rates: { Common: 48.42, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.32, Mythic: 0.26 }, items: 5 },
        { level: 63, rates: { Common: 48.36, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.36, Mythic: 0.28 }, items: 5 }, { level: 64, rates: { Common: 48.30, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.40, Mythic: 0.30 }, items: 5 },
        { level: 65, rates: { Common: 48.24, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.44, Mythic: 0.32 }, items: 5 }, { level: 66, rates: { Common: 48.18, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.48, Mythic: 0.34 }, items: 5 },
        { level: 67, rates: { Common: 48.12, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.52, Mythic: 0.36 }, items: 5 }, { level: 68, rates: { Common: 48.06, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.56, Mythic: 0.38 }, items: 5 },
        { level: 69, rates: { Common: 48.00, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.60, Mythic: 0.40 }, items: 5 }, { level: 70, rates: { Common: 47.94, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.64, Mythic: 0.42 }, items: 5 },
        { level: 71, rates: { Common: 47.88, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.68, Mythic: 0.44 }, items: 5 }, { level: 72, rates: { Common: 47.82, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.72, Mythic: 0.46 }, items: 5 },
        { level: 73, rates: { Common: 47.76, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.76, Mythic: 0.48 }, items: 5 }, { level: 74, rates: { Common: 47.70, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.80, Mythic: 0.50 }, items: 5 },
        { level: 75, rates: { Common: 47.64, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.84, Mythic: 0.52 }, items: 5 }, { level: 76, rates: { Common: 47.58, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.88, Mythic: 0.54 }, items: 5 },
        { level: 77, rates: { Common: 47.52, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.92, Mythic: 0.56 }, items: 5 }, { level: 78, rates: { Common: 47.46, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 1.96, Mythic: 0.58 }, items: 5 },
        { level: 79, rates: { Common: 47.40, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.60 }, items: 5 }, { level: 80, rates: { Common: 47.38, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.62 }, items: 5 },
        { level: 81, rates: { Common: 47.36, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.64 }, items: 5 }, { level: 82, rates: { Common: 47.34, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.66 }, items: 5 },
        { level: 83, rates: { Common: 47.32, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.68 }, items: 5 }, { level: 84, rates: { Common: 47.30, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.70 }, items: 5 },
        { level: 85, rates: { Common: 47.28, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.72 }, items: 5 }, { level: 86, rates: { Common: 47.26, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.74 }, items: 5 },
        { level: 87, rates: { Common: 47.24, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.76 }, items: 5 }, { level: 88, rates: { Common: 47.22, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.78 }, items: 5 },
        { level: 89, rates: { Common: 47.20, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.80 }, items: 5 }, { level: 90, rates: { Common: 47.18, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.82 }, items: 5 },
        { level: 91, rates: { Common: 47.16, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.84 }, items: 5 }, { level: 92, rates: { Common: 47.14, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.86 }, items: 5 },
        { level: 93, rates: { Common: 47.12, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.88 }, items: 5 }, { level: 94, rates: { Common: 47.10, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.90 }, items: 5 },
        { level: 95, rates: { Common: 47.08, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.92 }, items: 5 }, { level: 96, rates: { Common: 47.06, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.94 }, items: 5 },
        { level: 97, rates: { Common: 47.04, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.96 }, items: 5 }, { level: 98, rates: { Common: 47.02, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 0.98 }, items: 5 },
        { level: 99, rates: { Common: 47.00, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 1.00 }, items: 5 }, { level: 100, rates: { Common: 47.00, Rare: 30.00, Epic: 15.00, Legendary: 5.00, Ultimate: 2.00, Mythic: 1.00 }, items: 5 }
    ];

export const ITEM_POOLS = {
        Common: ["Hat_Cashier", "Hat_Barista", "Hat_Beanie", "Hat_Chef", "Hat_Cashier_Blue", "Body_Barista", "Body_BlueWhite", "Body_RedGray", "Body_WhiteShirt_Belt", "Body_RedShirt_Belt", "Tool_WoodSpoon", "Tool_MetalSpatula", "Tool_Hammer", "Tool_SoupSpoon", "Tool_Knife"],
        Rare: ["Hat_SushiChef", "Hat_TrafficCone", "Hat_Round", "Hat_Fireman", "Hat_CoolCap", "Body_JumperYellow", "Body_JumperRedBlue", "Body_Waiter", "Body_BowTieRed", "Body_Apron_White", "Tool_NoodleSpoon", "Tool_FlourSpoon", "Tool_CheeseGrater", "Tool_KetchupBottle", "Tool_Broom"],
        Epic: ["Hat_Hoodie", "Hat_Glasses", "Hat_Mafia", "Hat_Chef_Black", "Hat_ChefTall", "Body_Coat", "Body_Box", "Body_Kimono_Black", "Body_JumperBlackWhite", "Body_Apron_Purple", "Tool_Whisk", "Tool_RollingPin", "Tool_PizzaCutter", "Tool_Mug", "Tool_Wok"],
        Legendary: ["Hat_Leperchaun", "Hat_ElderBeard", "Hat_ChefTall_Dark", "Hat_CapPurple", "Hat_SushiMaster", "Body_ItalianChef", "Body_TankTop_White", "Body_ToolBelt", "Body_Kimono_Blue", "Body_Barrel", "Tool_Mixer", "Tool_PepperMill", "Tool_ChopSticks", "Tool_CookBook", "Tool_Chopper"],
        Mythic: ["Body_WarriorApron", "Hat_WarriorHelmet", "Tool_WarriorCleaver", "Tool_WarriorTenderiser"],
        Ultimate_MiddleAges: ["Body_RoyalRobe", "Hat_RoyalCrown", "Tool_RoyalSceptre"],
        Ultimate_Mine: ["Body_ToolBelt", "Hat_MineLamp", "Tool_Pickaxe_Special"],
        Ultimate_SeaPort: ["Body_Shark", "Head_Shark", "Tool_Anchor"],
        Ultimate_Space: ["Body_Robot", "Head_Robot", "Tool_LaserGun"],
        Ultimate_Alchemist: ["Body_Bandolier", "Hat_Goggles", "Tool_Flask"],

        Common_Zeus: ["Ring_Bronze", "Ring_Wooden", "Ring_Rubber", "Ring_Plaster"],
        Rare_Zeus: ["Ring_Silver", "Ring_Onion", "Ring_Candy", "Ring_Plastic"],
        Epic_Zeus: ["Ring_Gold", "Ring_Wreath", "Ring_Bagel", "Ring_Donut"],
        Legendary_Zeus: ["Ring_Snake", "Ring_Bee", "Ring_Lucky", "Ring_Winged"],
        Ultimate_Zeus: ["Ring_Evil", "Ring_Nature", "Ring_Sea", "Ring_Love"],
        Mythic_Zeus: ["Ring_Thunder"],

        Common_Pirate: ["Necklace_Lai", "Necklace_Bow", "Necklace_Scarf", "Necklace_Bands"],
        Rare_Pirate: ["Necklace_Bandana", "Necklace_Salt", "Necklace_Shelfish", "Necklace_Leather"],
        Epic_Pirate: ["Necklace_Pearls", "Necklace_Gold", "Necklace_Diamond", "Necklace_Dog"],
        Legendary_Pirate: ["Necklace_Sausage", "Necklace_Compass", "Necklace_Beads", "Necklace_Shark"],
        Ultimate_Pirate: ["Necklace_Pirate", "Necklace_Anchor", "Necklace_Nazar", "Necklace_Key"],
        Mythic_Pirate: ["Necklace_Trident"],

        CommonEgg: ["Pet_Egg_Common"], RareEgg: ["Pet_Egg_Rare"], EpicEgg: ["Pet_Egg_Epic"], LegendaryEgg: ["Pet_Egg_Legendary"], UltimateEgg: ["Pet_Egg_Ultimate"],
        RarePet: ["Pet_HouseCat", "Pet_GoldenRetriever"],
        EpicPet: ["Pet_DarkHorse", "Pet_Penguin", "Pet_Pony", "Pet_Tortoise", "Pet_Turtle"],
        LegendaryPet: ["Pet_Panda", "Pet_Roomba"],
        UltimatePet: ["Pet_BabyDragon", "Pet_RedPanda", "Pet_Mole", "Pet_BabyKraken"]
    };

export const XP_VALUES_ITEMS = { Common: 4, Rare: 9, Epic: 22, Legendary: 26, Ultimate: 61, Mythic: 144 };
export const XP_VALUES_EGGS = { Common: 25, Rare: 50, Epic: 150, Legendary: 425, Ultimate: 1000 };

// Adventure levels worth replaying: the rate curve only changes meaningfully
// at these points, so the XP search branches on them instead of all 100.
export const DOMINANT_ADVENTURE_LEVELS = [4, 24, 39, 59, 100];

// savegame -> card id maps (from the file-upload handler)
export const CHEST_ID_MAP = {
    0: 'small', 1: 'big', 9: 'adventure_Zeus', 10: 'adventure_Pirate',
    4: 'event_SeaPort', 3: 'event_Space', 2: 'event_Mine',
    5: 'event_MiddleAges', 15: 'event_Alchemist', 7: 'clan', 6: 'pet'
};

export const EGG_RARITY_MAP = { 1: 'egg_Rare', 2: 'egg_Epic', 3: 'egg_Legendary', 4: 'egg_Ultimate' };

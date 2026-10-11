// Display names and original game artwork are deliberately separate from the
// predictor's internal IDs. See docs/ASSETS.md for sources and ownership.
const SOURCE_COMMIT = "f427d12473f3d78f10be7450cfc95ab35703fd44";
const SOURCE_ROOT = `https://raw.githubusercontent.com/1vcian/ev/${SOURCE_COMMIT}/src/`;
const BASE_URL = import.meta.env?.BASE_URL ?? "/";

const ITEM_NAMES = {
  Hat_Cashier: "Red Cap",
  Hat_Barista: "Green Cap",
  Hat_Beanie: "Blue Beanie",
  Hat_Chef: "Chef's Hat",
  Hat_Cashier_Blue: "Blue Cap",
  Body_Barista: "Green Apron",
  Body_BlueWhite: "Blue T-Shirt",
  Body_RedGray: "Red T-Shirt",
  Body_WhiteShirt_Belt: "Brown Buckle Belt",
  Body_RedShirt_Belt: "Black Buckle Belt",
  Tool_WoodSpoon: "Wooden Spoon",
  Tool_MetalSpatula: "Spatula",
  Tool_Hammer: "Hammer",
  Tool_SoupSpoon: "Ladle",
  Tool_Knife: "Chef's Knife",
  Hat_SushiChef: "Sushi Hat",
  Hat_TrafficCone: "Cone",
  Hat_Round: "White Hat",
  Hat_Fireman: "Fireman Hat",
  Hat_CoolCap: "Cool Cap",
  Body_JumperYellow: "Yellow Hoodie",
  Body_JumperRedBlue: "Blue Hoodie",
  Body_Waiter: "Tux",
  Body_BowTieRed: "Bow Tie",
  Body_Apron_White: "White Apron",
  Tool_NoodleSpoon: "Pasta Spoon",
  Tool_FlourSpoon: "Scooper",
  Tool_CheeseGrater: "Cheese Grater",
  Tool_KetchupBottle: "Ketchup",
  Tool_Broom: "Broom",
  Hat_Hoodie: "Hood",
  Hat_Glasses: "Red Glasses",
  Hat_Mafia: "Mafia Hat",
  Hat_Chef_Black: "Black Chef's Hat",
  Hat_ChefTall: "Tall Hat",
  Body_Coat: "Robe",
  Body_Box: "Box",
  Body_Kimono_Black: "Kimono White Belt",
  Body_JumperBlackWhite: "Black & White Sweater",
  Body_Apron_Purple: "Purple Apron",
  Tool_Whisk: "Whisk",
  Tool_RollingPin: "Rolling Pin",
  Tool_PizzaCutter: "Pizza Cutter",
  Tool_Mug: "Mug",
  Tool_Wok: "Wok",
  Hat_Leperchaun: "Irish Hat",
  Hat_ElderBeard: "Elder Beard",
  Hat_ChefTall_Dark: "Tall Black Hat",
  Hat_CapPurple: "Purple Cap",
  Hat_SushiMaster: "Sushi Master",
  Body_ItalianChef: "Italian Chef",
  Body_TankTop_White: "Tank Top",
  Body_ToolBelt: "Tool Belt",
  Body_Kimono_Blue: "Kimono Black Belt",
  Body_Barrel: "Barrel",
  Tool_Mixer: "Mixer",
  Tool_PepperMill: "Pepper Mill",
  Tool_ChopSticks: "Chopsticks",
  Tool_CookBook: "Cook Book",
  Tool_Chopper: "Chef's Cleaver",
  Body_WarriorApron: "Armoured Apron",
  Hat_WarriorHelmet: "Chef's Helmet",
  Tool_WarriorCleaver: "Warrior's Cleaver",
  Tool_WarriorTenderiser: "Warrior's Tenderiser",
  Body_RoyalRobe: "Royal Robe",
  Hat_RoyalCrown: "Royal Crown",
  Tool_RoyalSceptre: "Royal Sceptre",
  Hat_MineLamp: "Torch Helmet",
  Tool_Pickaxe_Special: "Pickaxe",
  Body_Shark: "Shark Body",
  Head_Shark: "Shark Head",
  Tool_Anchor: "Anchor",
  Body_Robot: "Robot Suit",
  Head_Robot: "Robot Head",
  Tool_LaserGun: "Laser Gun",
  Body_Bandolier: "Alchemist Bandolier",
  Hat_Goggles: "Alchemist Goggles",
  Tool_Flask: "Potion Flask",
  Ring_Bronze: "Bronze Ring",
  Ring_Wooden: "Wooden Ring",
  Ring_Rubber: "Rubber Bands",
  Ring_Plaster: "Plaster Ring",
  Ring_Silver: "Silver Ring",
  Ring_Onion: "Onion Ring",
  Ring_Candy: "Candy Ring",
  Ring_Plastic: "Plastic Ring",
  Ring_Gold: "Gold Ring",
  Ring_Wreath: "Wreath Ring",
  Ring_Bagel: "Bagel Ring",
  Ring_Donut: "Donut Ring",
  Ring_Snake: "Snake Ring",
  Ring_Bee: "Bee Ring",
  Ring_Lucky: "Lucky Ring",
  Ring_Winged: "Winged Ring",
  Ring_Evil: "Ring of Evil",
  Ring_Nature: "Ring of Nature",
  Ring_Sea: "Ring of Seas",
  Ring_Love: "Ring of Love",
  Ring_Thunder: "Ring of Thunder",
  Necklace_Lai: "Lei",
  Necklace_Bow: "Bow Tie",
  Necklace_Scarf: "Scarf",
  Necklace_Bands: "Party Bands",
  Necklace_Bandana: "Bandana",
  Necklace_Salt: "Salt Shaker",
  Necklace_Shelfish: "Shellfish",
  Necklace_Leather: "Leather",
  Necklace_Pearls: "Pearls",
  Necklace_Gold: "Gold Chain",
  Necklace_Diamond: "Diamond Chain",
  Necklace_Dog: "Dog Collar",
  Necklace_Sausage: "Sausages",
  Necklace_Compass: "Compass",
  Necklace_Beads: "Beads",
  Necklace_Shark: "Shark Tooth",
  Necklace_Pirate: "Pirate Skull",
  Necklace_Anchor: "Anchor",
  Necklace_Nazar: "Nazar",
  Necklace_Key: "Treasure Key",
  Necklace_Trident: "Trident",
  Pet_Egg_Common: "Common Egg",
  Pet_Egg_Rare: "Rare Egg",
  Pet_Egg_Epic: "Epic Egg",
  Pet_Egg_Legendary: "Legendary Egg",
  Pet_Egg_Ultimate: "Ultimate Egg",
  Pet_HouseCat: "Cat",
  Pet_GoldenRetriever: "Dog",
  Pet_DarkHorse: "Dark Horse",
  Pet_Penguin: "Penguin",
  Pet_Pony: "Pony",
  Pet_Tortoise: "Tortoise",
  Pet_Turtle: "Turtle",
  Pet_Panda: "Panda",
  Pet_Roomba: "Vroomba",
  Pet_BabyDragon: "Baby Dragon",
  Pet_RedPanda: "Red Panda",
  Pet_Mole: "Mole",
  Pet_BabyKraken: "Baby Kraken",
  Pet_Chicken: "Chicken",
  PetFood: "Pet Food",
  ZeusKeyIcon: "Zeus Vault Key",
  PirateKeyIcon: "Pirate Vault Key",
};

const CHESTS = {
  small: ["Small Box", "2 rewards, including equipment, eggs or pet food.", "SmallChestIcon"],
  big: ["Big Box", "6 rewards, including equipment and pet eggs.", "BigChestIcon"],
  clan: ["Club Box", "6 equipment rewards. Your chance to find Mythic blueprints.", "ClubChestIcon"],
  pet: ["Pet Box", "3 pet eggs and 150 pet food in every box.", "PetChestIcon"],
  event_MiddleAges: ["Middle Ages Box", "6 rewards. Look for the Royal Crown, Royal Robe and Royal Sceptre.", "MiddleAgesChestIcon"],
  event_Mine: ["Mine Box", "6 rewards. Look for the Torch Helmet, Tool Belt and Pickaxe.", "MineChestIcon"],
  event_SeaPort: ["Seaport Box", "6 rewards. Look for Shark equipment and the Anchor.", "SeaportChestIcon"],
  event_Space: ["Moon Box", "6 rewards. Look for the Robot Head, Robot Suit and Laser Gun.", "SpaceChestIcon"],
  event_Alchemist: ["Alchemist Box", "6 rewards. Look for Alchemist equipment and the Potion Flask.", "PotionChest"],
  adventure_Zeus: ["Zeus' Feast", "Find rings. Your adventure level changes the rewards.", "GreekAdventureIcon"],
  adventure_Pirate: ["Hangry Pirates", "Find necklaces. Your adventure level changes the rewards.", "PirateEventIcon"],
  egg_Common: ["Common Egg", "See which pet is inside your egg.", "Pet_Egg_Common"],
  egg_Rare: ["Rare Egg", "Hatch a Cat or a Dog.", "Pet_Egg_Rare"],
  egg_Epic: ["Epic Egg", "See which Epic pet is waiting to hatch.", "Pet_Egg_Epic"],
  egg_Legendary: ["Legendary Egg", "Hatch a Panda or a Vroomba.", "Pet_Egg_Legendary"],
  egg_Ultimate: ["Ultimate Egg", "See which Ultimate pet is waiting to hatch.", "Pet_Egg_Ultimate"],
};

// Only allowlisted IDs ever reach an image URL. Unknown save values cannot
// inject paths, trigger external requests, or inherit Object prototype keys.
function assetUrl(knownId) {
  return `${BASE_URL}assets/items/${knownId}.webp`;
}

function readableName(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value.trim()
    .replace(/^(?:Hat|Head|Body|Tool|Ring|Necklace|Pet)_/, "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function itemCategory(id) {
  if (id === "PetFood") return "Pet Food";
  if (id.endsWith("KeyIcon")) return "Vault Key";
  if (id.startsWith("Pet_Egg")) return "Pet Egg";
  // Called only with an allowlisted ID; each remaining family is explicit.
  return {
    Pet: "Pet", Hat: "Head", Head: "Head", Body: "Body",
    Tool: "Tool", Ring: "Ring", Necklace: "Necklace",
  }[id.split("_")[0]];
}

/** Friendly labels and local, authentic game artwork for a predicted item. */
export function getItemPresentation(itemOrBaseName) {
  const id = typeof itemOrBaseName === "string"
    ? itemOrBaseName
    : itemOrBaseName?.baseName;
  const known = typeof id === "string" && Object.hasOwn(ITEM_NAMES, id);
  const name = known ? ITEM_NAMES[id] : readableName(id ?? itemOrBaseName?.name, "Unknown item");
  return {
    name,
    image: known ? assetUrl(id) : null,
    alt: name,
    category: known ? itemCategory(id) : "Item",
    sourceUrl: known ? `${SOURCE_ROOT}${id}.png` : null,
  };
}

/** Chest labels preserve the predictor's card IDs and saved state. */
export function getChestPresentation(cardId) {
  const entry = typeof cardId === "string" && Object.hasOwn(CHESTS, cardId) ? CHESTS[cardId] : null;
  if (!entry) {
    const name = readableName(cardId, "Unknown box");
    return { name, description: "See the rewards in your next opening.", image: null, alt: name };
  }
  const [name, description, asset] = entry;
  return { name, description, image: assetUrl(asset), alt: name };
}

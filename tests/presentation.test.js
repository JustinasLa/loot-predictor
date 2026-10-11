import { afterEach, describe, expect, it, vi } from "vitest";
import { getChestPresentation, getItemPresentation } from "../src/ui/presentation.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("friendly game item presentation", () => {
  it.each([
    ["Hat_Cashier", "Red Cap", "Head"],
    ["Head_Robot", "Robot Head", "Head"],
    ["Body_Shark", "Shark Body", "Body"],
    ["Tool_LaserGun", "Laser Gun", "Tool"],
    ["Ring_Bronze", "Bronze Ring", "Ring"],
    ["Necklace_Trident", "Trident", "Necklace"],
    ["Pet_Roomba", "Vroomba", "Pet"],
    ["Pet_Egg_Legendary", "Legendary Egg", "Pet Egg"],
    ["PetFood", "Pet Food", "Pet Food"],
    ["ZeusKeyIcon", "Zeus Vault Key", "Vault Key"],
    ["PirateKeyIcon", "Pirate Vault Key", "Vault Key"],
  ])("labels %s with its game name and category", (id, name, category) => {
    const presentation = getItemPresentation(id);
    expect(presentation).toMatchObject({ name, alt: name, category });
    expect(presentation.image).toBe(`/assets/items/${id}.webp`);
    expect(new URL(presentation.sourceUrl).protocol).toBe("https:");
  });

  it("uses the stable item ID rather than an untrusted saved display name", () => {
    const savedItem = { baseName: "Tool_LaserGun", name: '<img src="x" onerror="alert(1)">', itemRoll: 4 };
    expect(getItemPresentation(savedItem)).toEqual(getItemPresentation("Tool_LaserGun"));
    expect(savedItem.name).toContain("<img");
  });

  it.each([
    ["Tool_newChef-Tool", "New Chef Tool"],
    ["  Ring_mysteryRing  ", "Mystery Ring"],
    [{ name: "  futureReward  " }, "Future Reward"],
    [{ baseName: "future_item", name: "Ignored name" }, "Future item"],
  ])("provides a readable fallback for an unmapped item %j", (input, name) => {
    expect(getItemPresentation(input)).toEqual({ name, alt: name, category: "Item", image: null, sourceUrl: null });
  });

  it.each([undefined, null, {}, "", " \t ", 42, { baseName: 42 }, { name: false }])(
    "handles missing or malformed item data %j", (input) => {
      expect(getItemPresentation(input)).toEqual({
        name: "Unknown item", alt: "Unknown item", category: "Item", image: null, sourceUrl: null,
      });
    },
  );

  it.each(["constructor", "toString", "__proto__", "../private", "https://example.com/track.png"])(
    "never creates an image URL from an unknown identifier %s", (id) => {
      expect(getItemPresentation(id).image).toBeNull();
      expect(getItemPresentation(id).sourceUrl).toBeNull();
      expect(getChestPresentation(id).image).toBeNull();
    },
  );
});

describe("friendly box presentation", () => {
  it.each([
    ["clan", "Club Box", "ClubChestIcon", "Mythic blueprints"],
    ["event_Space", "Moon Box", "SpaceChestIcon", "Laser Gun"],
    ["adventure_Zeus", "Zeus' Feast", "GreekAdventureIcon", "Find rings"],
    ["adventure_Pirate", "Hangry Pirates", "PirateEventIcon", "Find necklaces"],
    ["egg_Legendary", "Legendary Egg", "Pet_Egg_Legendary", "Panda or a Vroomba"],
  ])("explains %s in player-facing terms", (id, name, asset, description) => {
    const presentation = getChestPresentation(id);
    expect(presentation).toMatchObject({ name, alt: name, image: `/assets/items/${asset}.webp` });
    expect(presentation.description).toContain(description);
  });

  it("keeps an unfamiliar chest usable with a readable label", () => {
    expect(getChestPresentation("future_eventBox")).toEqual({
      name: "Future event Box", alt: "Future event Box", image: null,
      description: "See the rewards in your next opening.",
    });
  });

  it.each([undefined, null, 123, "", "  "])("labels invalid chest data %j", (input) => {
    expect(getChestPresentation(input)).toMatchObject({ name: "Unknown box", alt: "Unknown box", image: null });
  });

  it("defaults local asset URLs to the site root when a build base is unavailable", async () => {
    vi.stubEnv("BASE_URL", undefined);
    vi.resetModules();
    const presentation = await import("../src/ui/presentation.js");
    expect(presentation.getItemPresentation("PetFood").image).toBe("/assets/items/PetFood.webp");
    expect(presentation.getChestPresentation("small").image).toBe("/assets/items/SmallChestIcon.webp");
  });
});

import { describe, expect, it } from "vitest";
import { getAvailableItemsForChest } from "../src/loot/items.js";
import { predictChain } from "../src/loot/simulate.js";
import { findItemLinear } from "../src/solver/find-items.js";

describe("item picker target semantics", () => {
  it.each(["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"])
    ("treats inherited object property %s as an unknown chest", (cardId) => {
      expect(getAvailableItemsForChest(cardId)).toEqual([]);
    });

  it("labels Mine tool belts with both rarities accepted by the hunt", () => {
    const belts = getAvailableItemsForChest("event_Mine")
      .filter((item) => item.baseName === "Body_ToolBelt");
    expect(belts).toEqual([{
      baseName: "Body_ToolBelt", type: "Equipment",
      rarity: "Legendary / Ultimate", rarities: ["Legendary", "Ultimate"]
    }]);

    const result = findItemLinear(18, "event_Mine", [belts[0].baseName], { limit: 1 });
    expect(result.found).toBe(true);
    expect(result.path[0].items.filter((item) => item.baseName === belts[0].baseName))
      .toMatchObject([{ rarity: "Legendary" }]);
  });

  it("keeps the tool belt Legendary in chests without the Mine Ultimate pool", () => {
    for (const cardId of ["big", "clan", "event_Space"]) {
      expect(getAvailableItemsForChest(cardId)
        .find((item) => item.baseName === "Body_ToolBelt"))
        .toMatchObject({ rarity: "Legendary", rarities: ["Legendary"] });
    }
  });

  it.each(["small", "pet"])("offers the PetFood target that %s can produce", (cardId) => {
    const food = getAvailableItemsForChest(cardId)
      .find((item) => item.baseName === "PetFood");
    expect(food).toEqual({
      baseName: "PetFood", type: "Pet Food", rarity: "None", rarities: ["None"]
    });
    expect(predictChain(1, cardId, 5).flatMap((open) => open.items)
      .some((item) => item.baseName === food.baseName)).toBe(true);
    expect(findItemLinear(1, cardId, [food.baseName], { limit: 5 }).found).toBe(true);
  });

  it.each(["big", "clan", "event_Mine", "adventure_Zeus", "egg_Rare"])
    ("does not offer PetFood for %s", (cardId) => {
      expect(getAvailableItemsForChest(cardId).map((item) => item.baseName))
        .not.toContain("PetFood");
    });

  it("returns independent rarity metadata on each call", () => {
    const first = getAvailableItemsForChest("event_Mine");
    first.find((item) => item.baseName === "Body_ToolBelt").rarities.push("Common");
    expect(getAvailableItemsForChest("event_Mine")
      .find((item) => item.baseName === "Body_ToolBelt").rarities)
      .toEqual(["Legendary", "Ultimate"]);
  });
});

// Loot table data, mapped empirically from real openings.
// Each roll is assumed to consume two RNG draws: one for the category,
// one for the item within that category. Verify this before filling in.

export const TABLES = {
  common_chest: {
    categories: [
      // { name: "coins", weight: 60, items: ["small", "medium", "large"] },
    ]
  }
  // TODO: rare_chest, epic_chest, pet_egg, ...
};

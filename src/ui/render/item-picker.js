// The Find picture picker: one toggle tile per item the box can drop.
import { getItemPresentation } from "../presentation.js";
import { el, artwork, rarityTone } from "./dom.js";
import { appendItemContent } from "./items.js";

/** Small silent rarity tiles for a list of items (or base names). */
export function itemSprites(items, className = "find-sprites") {
  const row = el("span", className);
  row.setAttribute("aria-hidden", "true");
  for (const entry of items) {
    const item = typeof entry === "string" ? { baseName: entry, rarity: "None" } : entry;
    const tile = el("span", "item-tile item-tile--mini");
    tile.dataset.rarity = rarityTone(item.rarity);
    tile.append(artwork(getItemPresentation(item)));
    row.append(tile);
  }
  return row;
}

function matches(item, query, rarity) {
  const name = getItemPresentation(item).name;
  const matchesQuery = `${name} ${item.baseName} ${item.rarity}`.toLowerCase().includes(query);
  const rarities = item.rarities || item.rarity.split(" / ");
  return matchesQuery && (rarity === "all" || rarities.some((value) => value.toLowerCase() === rarity));
}

/** Draws the picker and returns how many items are visible after filtering. */
export function renderItemPicker(container, items, selected, onToggle, filters = {}) {
  const focused = container.ownerDocument.activeElement;
  const focusedItem = container.contains(focused)
    ? { baseName: focused.dataset.baseName, rarity: focused.dataset.rarity }
    : null;
  let focusedChip;
  container.textContent = "";
  if (items.length === 0) {
    container.append(el("p", "empty", "Nothing to find in this box."));
    return 0;
  }

  const query = (filters.query || "").trim().toLowerCase();
  const rarity = (filters.rarity || "all").toLowerCase();
  const visible = items.filter((item) => matches(item, query, rarity));
  if (visible.length === 0) {
    container.append(el("p", "empty", "No match."));
    return 0;
  }

  for (const item of visible) {
    const on = selected.has(item.baseName);
    const chip = el("button", "item-chip");
    chip.type = "button";
    chip.dataset.baseName = item.baseName;
    chip.dataset.rarity = item.rarity;
    chip.dataset.on = on ? "yes" : "no";
    chip.setAttribute("aria-pressed", String(on));
    const tile = appendItemContent(chip, item, { showQuantity: false });
    if (on) {
      const check = el("span", "item-check");
      check.setAttribute("aria-hidden", "true");
      tile.append(check);
    }
    chip.addEventListener("click", () => onToggle(item.baseName));
    container.append(chip);
    if (focusedItem && item.baseName === focusedItem.baseName && item.rarity === focusedItem.rarity) focusedChip = chip;
  }
  focusedChip?.focus({ preventScroll: true });
  return visible.length;
}

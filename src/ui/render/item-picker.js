// The Find picture picker: one toggle chip per item the box can drop.
import { getItemPresentation } from "../presentation.js";
import { el } from "./dom.js";
import { appendItemContent } from "./items.js";

export function renderItemPicker(container, items, selected, onToggle, filters = {}) {
  const focused = container.ownerDocument.activeElement;
  const focusedItem = container.contains(focused)
    ? { baseName: focused.dataset.baseName, rarity: focused.dataset.rarity }
    : null;
  let focusedChip;
  container.textContent = "";
  if (items.length === 0) {
    container.append(el("p", "empty", "Nothing to find in this box."));
    return;
  }

  const query = (filters.query || "").trim().toLowerCase();
  const rarity = (filters.rarity || "all").toLowerCase();
  const visible = items.filter((item) => {
    const name = getItemPresentation(item).name;
    const matchesQuery = `${name} ${item.baseName} ${item.rarity}`.toLowerCase().includes(query);
    const rarities = item.rarities || item.rarity.split(" / ");
    return matchesQuery && (rarity === "all" || rarities.some((value) => value.toLowerCase() === rarity));
  });
  if (visible.length === 0) {
    container.append(el("p", "empty", "No match."));
    return;
  }

  for (const item of visible) {
    const chip = el("button", "item-chip");
    chip.type = "button";
    chip.dataset.baseName = item.baseName;
    chip.dataset.rarity = item.rarity;
    chip.dataset.on = selected.has(item.baseName) ? "yes" : "no";
    chip.setAttribute("aria-pressed", String(selected.has(item.baseName)));
    const tile = appendItemContent(chip, item, { showQuantity: false });
    if (selected.has(item.baseName)) {
      const check = el("span", "item-check");
      check.setAttribute("aria-hidden", "true");
      tile.append(check);
    }
    chip.addEventListener("click", () => onToggle(item.baseName));
    container.append(chip);
    if (focusedItem && item.baseName === focusedItem.baseName && item.rarity === focusedItem.rarity) focusedChip = chip;
  }
  focusedChip?.focus({ preventScroll: true });
}

// Item tiles: real game art on a rarity-coloured tile, name underneath.
import { getItemPresentation } from "../presentation.js";
import { el, artwork, rarityTone } from "./dom.js";

export function itemQuantity(item) {
  // itemRoll is normally a pool index, not a quantity. Only food uses it as
  // an amount, including the guaranteed "150" string in Pet Box rewards.
  if (item.baseName !== "PetFood") return null;
  const amount = Number(item.itemRoll ?? item.name?.match(/^(\d+)\s+Pet Food\b/i)?.[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Fills `node` with a rarity tile plus the name (and a visually hidden rarity). */
export function appendItemContent(node, item, { showQuantity = true } = {}) {
  const presentation = getItemPresentation(item);
  const rarity = item.rarity === "None" ? "Resource" : item.rarity;
  const tile = el("span", "item-tile");
  tile.dataset.rarity = rarityTone(item.rarity);
  tile.title = rarity ? `${presentation.name} · ${rarity}` : presentation.name;
  tile.append(artwork(presentation));
  const quantity = showQuantity ? itemQuantity(item) : null;
  if (quantity != null) {
    const badge = el("span", "item-quantity", `x${quantity}`);
    badge.setAttribute("aria-label", `Quantity: ${quantity}`);
    tile.append(badge);
  }
  if (typeof item.baseName === "string" && item.baseName.endsWith("KeyIcon")) {
    const key = el("span", "badge badge--gold item-key", "Key");
    key.setAttribute("aria-hidden", "true");
    tile.append(key);
  }
  node.append(tile);
  const copy = el("span", "item-copy");
  copy.append(el("span", "item-name", presentation.name));
  if (rarity) copy.append(el("span", "item-rarity sr-only", rarity));
  node.append(copy);
  return tile;
}

export function renderItems(items, hits = []) {
  const list = el("ul", "item-grid");
  for (const item of items) {
    const row = el("li", "item-row");
    row.dataset.baseName = item.baseName;
    row.dataset.rarity = item.rarity;
    const tile = appendItemContent(row, item);
    if (hits.includes(item.baseName)) {
      row.dataset.hit = "yes";
      tile.append(el("span", "target-hit badge badge--gold", "Yours!"));
    }
    list.append(row);
  }
  return list;
}

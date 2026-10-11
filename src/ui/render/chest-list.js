// Box picker tiles: the box sprite on its coloured backing, name underneath.
import { getChestPresentation } from "../presentation.js";
import { el, artwork } from "./dom.js";

const BOX_TONES = new Set([
  "small", "big", "clan", "pet", "mine", "seaport", "space", "middleages", "alchemist", "zeus", "pirate",
]);

/** The `--box-*` backing colour key for a card id ("event_SeaPort" -> "seaport"). */
export function boxTone(cardId) {
  if (cardId.startsWith("egg_")) return "egg";
  const key = cardId.replace(/^(?:event|adventure)_/, "").toLowerCase();
  return BOX_TONES.has(key) ? key : "unknown";
}

/** The rail group a card id belongs to. */
export function boxGroup(cardId) {
  if (cardId.startsWith("adventure_")) return "adventures";
  if (cardId.startsWith("event_")) return "events";
  if (cardId.startsWith("egg_")) return "eggs";
  return "boxes";
}

/** Box art on its backing square, shared by the tiles and the box header. */
export function boxArt(cardId) {
  const art = artwork(getChestPresentation(cardId), "chest", { letters: 1 });
  art.classList.add("box-art");
  art.dataset.box = boxTone(cardId);
  return art;
}

// Preserve the native button that held keyboard focus when lists redraw.
export function renderChestList(container, cardStates, activeId, onSelect) {
  const focused = container.ownerDocument.activeElement;
  const focusedId = container.contains(focused) ? focused.dataset.cardId : null;
  let focusedRow;
  container.textContent = "";
  for (const [id, state] of Object.entries(cardStates)) {
    const presentation = getChestPresentation(id);
    const row = el("button", "box-tile");
    row.type = "button";
    row.dataset.cardId = id;
    row.dataset.on = id === activeId ? "yes" : "no";
    const art = boxArt(id);
    if (id === activeId) {
      row.classList.add("is-active");
      row.setAttribute("aria-current", "true");
      const check = el("span", "box-check");
      check.setAttribute("aria-hidden", "true");
      art.append(check);
    }
    const badges = el("span", "box-badges");
    if (state.level) badges.append(el("span", "badge badge--level", `Lv ${state.level}`));
    if (state.opened) badges.append(el("span", "badge badge--opened", `${state.opened} opened`));
    if (badges.childElementCount) art.append(badges);
    row.append(art, el("span", "chest-name", presentation.name));
    row.addEventListener("click", () => onSelect(id));
    container.append(row);
    if (id === focusedId) focusedRow = row;
  }
  focusedRow?.focus({ preventScroll: true });
}

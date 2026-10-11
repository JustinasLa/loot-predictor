// Openings already recorded, newest first.
import { getChestPresentation } from "../presentation.js";
import { el } from "./dom.js";
import { openingCard } from "./opening-card.js";

function emptyHistory() {
  const empty = el("div", "empty");
  const art = el("img", "empty-art");
  art.src = getChestPresentation("small").image;
  art.alt = "";
  art.width = 72;
  art.height = 72;
  empty.append(art, el("p", null, "Nothing opened yet."));
  return empty;
}

export function renderHistory(container, cardId, history) {
  container.textContent = "";
  if (history.length === 0) {
    container.append(emptyHistory());
    return;
  }
  for (const open of history) {
    const box = openingCard(open, { cardId, number: open.open, past: true });
    box.classList.add("is-past");
    container.append(box);
  }
}

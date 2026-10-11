// Openings already recorded, newest first.
import { el } from "./dom.js";
import { openingCard } from "./opening-card.js";

export function renderHistory(container, cardId, history) {
  container.textContent = "";
  if (history.length === 0) {
    container.append(el("p", "empty", "Nothing opened yet."));
    return;
  }
  for (const open of history) {
    const box = openingCard(open, { cardId, number: open.open, past: true });
    box.classList.add("is-past");
    container.append(box);
  }
}

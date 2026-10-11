// The upcoming openings in the Next tab.
import { openingCard } from "./opening-card.js";

export function renderResults(container, cardId, chain, onOpen) {
  container.textContent = "";
  for (const [index, open] of chain.entries()) {
    const count = index + 1;
    container.append(openingCard(open, {
      cardId, number: open.open, count, container,
      onOpen: onOpen ? () => onOpen(count) : null,
    }));
  }
}

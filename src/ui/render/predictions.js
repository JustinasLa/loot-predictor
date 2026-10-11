// The upcoming openings in the Next tab.
import { openingCard } from "./opening-card.js";

const COLLAPSE_MS = 180;
const MAX_LEAVING = 5;

function reducedMotion(view) {
  return !view.matchMedia || view.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * After marking, the opened cards fold away above the list (height and opacity,
 * 180ms) and the new card 1 drops its ribbon in. The folding copies live in a
 * silent sibling (`.out-leaving`), so `#out` only ever holds the real cards.
 */
function collapseOpened(container, opened, heights) {
  const leaving = container.previousElementSibling;
  const view = container.ownerDocument.defaultView;
  if (!leaving?.classList.contains("out-leaving") || reducedMotion(view)) return;
  container.firstElementChild.classList.add("is-arriving");
  leaving.textContent = "";
  for (const [index, card] of opened.entries()) {
    const ghost = card.cloneNode(true);
    for (const button of ghost.querySelectorAll("button")) button.remove();
    ghost.style.height = `${heights[index]}px`;
    leaving.append(ghost);
  }
  // Force a layout so the browser starts from the measured heights.
  void leaving.offsetHeight;
  for (const ghost of leaving.children) ghost.classList.add("is-collapsing");
  view.setTimeout(() => { leaving.textContent = ""; }, COLLAPSE_MS + 40);
}

export function renderResults(container, cardId, chain, onOpen) {
  container.textContent = "";
  for (const [index, open] of chain.entries()) {
    const count = index + 1;
    container.append(openingCard(open, {
      cardId, number: open.open, count, container,
      onOpen: onOpen ? () => {
        const opened = [...container.children].slice(0, Math.min(count, MAX_LEAVING));
        const heights = opened.map((card) => card.offsetHeight);
        onOpen(count);
        // Only animate when the cards were really replaced by a redraw.
        if (!opened[0].isConnected && container.firstElementChild?.classList.contains("open-box")) {
          collapseOpened(container, opened, heights);
        }
      } : null,
    }));
  }
}

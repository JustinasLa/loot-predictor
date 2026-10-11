// One opening: a header, the item tiles, hidden seed details and one button.
import { getChestPresentation } from "../presentation.js";
import { el } from "./dom.js";
import { renderItems } from "./items.js";

export function predictionDetails(open) {
  const details = el("details", "prediction-details");
  details.append(el("summary", null, "Prediction details"));
  const seed = open.usedSeed ?? open.seed;
  const parts = [];
  if (seed != null) parts.push(`Seed ${seed}`);
  if (open.nextSeed != null) parts.push(`Next seed ${open.nextSeed}`);
  if (open.keyRoll != null) parts.push(`Key roll ${open.keyRoll}`);
  if (parts.length === 0) return null;
  details.append(el("p", "seed-text", parts.join(" · ")));
  return details;
}

export function markButton(count, onClick, container) {
  const first = count === 1;
  const button = el("button",
    first ? "open-card-btn btn btn--go btn--lg btn--block" : "open-card-btn btn btn--ghost btn--sm",
    first ? "I opened it!" : "Opened up to here");
  button.type = "button";
  button.title = first ? "Marks this box opened" : `Marks ${count} boxes opened`;
  button.addEventListener("click", () => {
    const document = container.ownerDocument;
    const hadFocus = document.activeElement === button;
    onClick();
    // Recording openings replaces the cards. Keep keyboard users at the next
    // action without overriding deliberate focus changes made by the app.
    if (hadFocus && !button.isConnected && document.activeElement === document.body) {
      const next = container.querySelector(".open-card-btn");
      if (next) next.focus({ preventScroll: true });
      else {
        container.tabIndex = -1;
        container.focus({ preventScroll: true });
      }
    }
  });
  return button;
}

function cardTitle({ number, count, past, route }) {
  if (past) return el("h3", "open-title", `Opened #${number}`);
  if (route) return el("h4", "open-title", `Step ${number}`);
  if (count === 1) return el("h3", "open-title", "Next box");
  const title = el("h3", "open-title open-number", `#${number}`);
  title.setAttribute("aria-label", `Opening ${number}`);
  return title;
}

export function openingCard(open, { cardId, number, count, onOpen, container, past = false, route = false }) {
  const box = el("article", "open-box panel");
  const head = el("div", "open-head");
  if (!past && count === 1) {
    box.classList.add("is-next");
    const ribbon = el("span", "open-ribbon", "NEXT");
    ribbon.setAttribute("aria-hidden", "true");
    head.append(ribbon);
  }
  const heading = el("div", "open-heading");
  heading.append(cardTitle({ number, count, past, route }));
  const level = open.level ?? open.items.find((item) => item.level != null)?.level;
  const name = cardId ? getChestPresentation(cardId).name : "Adventure chest";
  const subtitle = [name];
  if (level != null) subtitle.push(`Level ${level}`);
  if (open.xp != null) subtitle.push(`+${open.xp} XP`);
  heading.append(el("p", "open-subtitle", subtitle.join(" · ")));
  head.append(heading);
  box.append(head, renderItems(open.items, open.hits));
  const details = predictionDetails(open);
  if (details) box.append(details);
  if (onOpen) box.append(markButton(count, onOpen, container));
  return box;
}

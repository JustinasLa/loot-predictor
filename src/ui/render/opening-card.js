// One opening: a header, the item tiles, hidden seed details and one button.
// The box header already names the box, so cards only carry what changes:
// the NEXT ribbon or #number, and for adventures the level and XP.
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

/** "I opened it!" on the next card; "I opened up to #N" on the later ones. */
export function markButton(count, onClick, container, number = count) {
  const first = count === 1;
  const button = el("button",
    first ? "open-card-btn btn btn--go btn--lg btn--block" : "open-card-btn btn btn--ghost btn--sm",
    first ? "I opened it!" : `I opened up to #${number}`);
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

// Every card title is an h3: route cards sit under the tab's h2 too.
function cardTitle({ number, count, past }) {
  if (past) return el("h3", "open-title", `Opened #${number}`);
  if (count === 1) return el("h3", "open-title sr-only", "Next box");
  const title = el("h3", "open-title open-number", `#${number}`);
  title.setAttribute("aria-label", `Opening ${number}`);
  return title;
}

const formatNumber = (value) => value.toLocaleString("en-US");

export function openingCard(open, { number, count, onOpen, container, past = false }) {
  const box = el("article", past ? "open-box panel is-past" : "open-box panel");
  const head = el("div", "open-head");
  const next = !past && count === 1;
  if (next) {
    box.classList.add("is-next");
    const ribbon = el("span", "open-ribbon", "NEXT");
    ribbon.setAttribute("aria-hidden", "true");
    head.append(ribbon);
  }
  const heading = el("div", "open-heading");
  heading.append(cardTitle({ number, count, past }));
  const level = open.level ?? open.items.find((item) => item.level != null)?.level;
  if (level != null) heading.append(el("span", "open-level", `Lv ${level}`));
  if (open.xp != null) heading.append(el("span", "xp-pill", `+${formatNumber(open.xp)} XP`));
  // Nothing visible besides the ribbon: the header takes no room.
  if (next && heading.childElementCount === 1) head.classList.add("is-bare");
  head.append(heading);
  box.append(head, renderItems(open.items, open.hits));
  const details = predictionDetails(open);
  if (details) box.append(details);
  if (onOpen) box.append(markButton(count, onOpen, container, number));
  return box;
}

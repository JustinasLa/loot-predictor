// DOM construction lives here; game calculations stay in the prediction engine.
import { getChestPresentation, getItemPresentation } from "./presentation.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function artwork(presentation, kind = "item") {
  const frame = el("span", `${kind}-art`);
  frame.setAttribute("aria-hidden", "true");
  const fallback = () => {
    frame.textContent = "";
    frame.classList.add("is-fallback");
    const initials = presentation.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
    frame.append(el("span", `${kind}-fallback`, initials.toUpperCase()));
  };
  if (presentation.image) {
    const image = el("img", `${kind}-image`);
    image.src = presentation.image;
    // The adjacent visible name labels the artwork without duplicate speech.
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 64;
    image.height = 64;
    image.addEventListener("error", fallback, { once: true });
    frame.append(image);
  } else {
    fallback();
  }
  return frame;
}

function itemQuantity(item) {
  // itemRoll is normally a pool index, not a quantity. Only food uses it as
  // an amount, including the guaranteed "150" string in Pet Box rewards.
  if (item.baseName !== "PetFood") return null;
  const amount = Number(item.itemRoll ?? item.name?.match(/^(\d+)\s+Pet Food\b/i)?.[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function appendItemContent(node, item, { showQuantity = true } = {}) {
  const presentation = getItemPresentation(item);
  node.append(artwork(presentation));
  const copy = el("span", "item-copy");
  copy.append(el("span", "item-name", presentation.name));
  const rarity = item.rarity === "None" ? "Resource" : item.rarity;
  if (rarity) copy.append(el("span", "item-rarity", rarity));
  node.append(copy);
  const quantity = showQuantity ? itemQuantity(item) : null;
  if (quantity != null) {
    const badge = el("span", "item-quantity", `×${quantity}`);
    badge.setAttribute("aria-label", `Quantity: ${quantity}`);
    node.append(badge);
  }
}

function renderItems(items, hits = []) {
  const list = el("ul", "item-grid");
  for (const item of items) {
    const row = el("li", "item-row");
    row.dataset.baseName = item.baseName;
    row.dataset.rarity = item.rarity;
    appendItemContent(row, item);
    if (hits.includes(item.baseName)) {
      row.dataset.hit = "yes";
      row.append(el("span", "target-hit", "Wanted item"));
    }
    list.append(row);
  }
  return list;
}

function predictionDetails(open) {
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

function markButton(count, onClick, container) {
  const button = el("button", "open-card-btn", count === 1 ? "Mark opened" : `Mark first ${count} opened`);
  button.type = "button";
  button.title = count === 1
    ? "After opening this in Eatventure, mark it opened to update your progress here."
    : `After opening this and the ${count - 1} before it in Eatventure, mark all ${count} opened to update your progress here.`;
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

function openingCard(open, { cardId, number, count, onOpen, container, past = false, route = false }) {
  const box = el("article", "open-box");
  const head = el("div", "open-head");
  const numberBadge = el("span", "open-number", number);
  numberBadge.setAttribute("aria-hidden", "true");
  head.append(numberBadge);
  const heading = el("div", "open-heading");
  heading.append(el(route ? "h4" : "h3", "open-title", `${past ? "Opened" : route ? "Step" : "Opening"} ${number}`));
  const level = open.level ?? open.items.find((item) => item.level != null)?.level;
  const name = cardId ? getChestPresentation(cardId).name : "Adventure chest";
  const subtitle = [name];
  if (level != null) subtitle.push(`Level ${level}`);
  if (open.xp != null) subtitle.push(`+${open.xp} XP`);
  heading.append(el("p", "open-subtitle", subtitle.join(" · ")));
  head.append(heading);
  if (onOpen) head.append(markButton(count, onOpen, container));
  box.append(head, renderItems(open.items, open.hits));
  const details = predictionDetails(open);
  if (details) box.append(details);
  return box;
}

// Preserve the native button that held keyboard focus when lists redraw.
export function renderChestList(container, cardStates, activeId, onSelect) {
  const focused = container.ownerDocument.activeElement;
  const focusedId = container.contains(focused) ? focused.dataset.cardId : null;
  let focusedRow;
  container.textContent = "";
  for (const [id, state] of Object.entries(cardStates)) {
    const presentation = getChestPresentation(id);
    const row = el("button", "channel-row");
    row.type = "button";
    row.dataset.cardId = id;
    row.dataset.on = id === activeId ? "yes" : "no";
    if (id === activeId) {
      row.classList.add("is-active");
      row.setAttribute("aria-current", "true");
    }
    row.append(artwork(presentation, "chest"));
    const copy = el("span", "chest-copy");
    copy.append(el("span", "chest-name", presentation.name));
    copy.append(el("span", "chest-description", presentation.description));
    row.append(copy);
    if (state.level) row.append(el("span", "channel-badge", `Level ${state.level}`));
    row.addEventListener("click", () => onSelect(id));
    container.append(row);
    if (id === focusedId) focusedRow = row;
  }
  focusedRow?.focus({ preventScroll: true });
}

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

// Openings already recorded, newest first.
export function renderHistory(container, cardId, history) {
  container.textContent = "";
  if (history.length === 0) {
    container.append(el("p", "empty-text", "No openings recorded yet. Open a box in Eatventure, then mark it opened here."));
    return;
  }
  for (const open of history) {
    const box = openingCard(open, { cardId, number: open.open, past: true });
    box.classList.add("is-past");
    container.append(box);
  }
}

export function renderXpPath(container, solution, baseline, freeOpenings, onOpen, doneCount = 0, cardId) {
  container.textContent = "";
  if (!solution || solution.xp < 0 || solution.path.length === 0) {
    container.append(el("p", "empty-text", solution?.stopped
      ? "Search stopped before a plan was found. Try again to find a plan."
      : "No plan found. Check your level and available openings, then try again."));
    return;
  }

  const summary = el("div", "xp-summary");
  summary.append(el("span", "xp-total", `${solution.xp} XP`));
  const delta = solution.xp - baseline.xp;
  const percent = baseline.xp > 0 ? Math.round((delta / baseline.xp) * 100) : null;
  const percentLabel = percent == null ? "" : ` (${delta > 0 ? "+" : ""}${percent}%)`;
  const baselineLabel = `${baseline.xp} XP in ${countLabel(baseline.opens, "opening")}`;
  const comparison = el("span", "xp-delta");
  comparison.dataset.sign = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  comparison.textContent = delta > 0
    ? `+${delta} XP${percentLabel} compared with always using your highest level (${baselineLabel}).`
    : delta < 0
      ? `${-delta} XP less${percentLabel} than always using your highest level (${baselineLabel}).`
      : `The same XP as always using your highest level (${baselineLabel}).`;
  summary.append(comparison);

  const keys = solution.path.reduce((count, step) =>
    count + step.items.filter((item) => item.baseName.endsWith("KeyIcon")).length, 0);
  summary.append(el("span", "xp-spend", keys > 0
    ? `${countLabel(solution.path.length, "opening")} from ${countLabel(freeOpenings, "available opening")}. ${countLabel(keys, "bonus opening")} from key drops.`
    : `${countLabel(solution.path.length, "opening")} from ${countLabel(freeOpenings, "available opening")}. No extra keys found.`));
  if (solution.truncated) summary.append(el("span", "xp-warn", `Search reached the ${solution.maxOpens}-opening limit. This is the best plan found so far.`));
  if (solution.stopped) summary.append(el("span", "xp-warn", "Search stopped early. This is the best plan found so far."));
  if (doneCount > 0) summary.append(el("span", "xp-progress", doneCount >= solution.path.length
    ? "Plan complete. Progress updated."
    : `${doneCount} of ${solution.path.length} openings recorded. Progress updated.`));
  container.append(summary);

  // A button records every pending step up to it, at the levels in this plan.
  for (const [index, step] of solution.path.entries()) {
    if (index < doneCount) continue;
    container.append(openingCard(step, {
      cardId, number: index + 1, count: index + 1 - doneCount, route: true, container,
      onOpen: onOpen ? () => onOpen(solution.path.slice(doneCount, index + 1)) : null,
    }));
  }
}

export function renderItemPicker(container, items, selected, onToggle, filters = {}) {
  const focused = container.ownerDocument.activeElement;
  const focusedItem = container.contains(focused)
    ? { baseName: focused.dataset.baseName, rarity: focused.dataset.rarity }
    : null;
  let focusedChip;
  container.textContent = "";
  if (items.length === 0) {
    container.append(el("p", "empty-text", "There are no searchable items for this box yet. Choose another box to continue."));
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
    container.append(el("p", "empty-text", "No items match your search. Try another name or choose All rarities."));
    return;
  }

  for (const item of visible) {
    const chip = el("button", "item-chip");
    chip.type = "button";
    chip.dataset.baseName = item.baseName;
    chip.dataset.rarity = item.rarity;
    chip.dataset.on = selected.has(item.baseName) ? "yes" : "no";
    chip.setAttribute("aria-pressed", String(selected.has(item.baseName)));
    appendItemContent(chip, item, { showQuantity: false });
    if (selected.has(item.baseName)) {
      const check = el("span", "item-check", "✓");
      check.setAttribute("aria-hidden", "true");
      chip.append(check);
    }
    chip.addEventListener("click", () => onToggle(item.baseName));
    container.append(chip);
    if (focusedItem && item.baseName === focusedItem.baseName && item.rarity === focusedItem.rarity) focusedChip = chip;
  }
  focusedChip?.focus({ preventScroll: true });
}

function renderFindPath(path, label, note, onOpen, cardId, container) {
  const wrap = el("section", "route-block");
  wrap.append(el("h3", "col-head", label));
  if (note) wrap.append(el("p", "route-note", note));
  for (const [index, step] of path.entries()) {
    const count = index + 1;
    wrap.append(openingCard(step, {
      cardId, number: count, count, route: true, container,
      onOpen: onOpen ? () => onOpen(path.slice(0, count)) : null,
    }));
  }
  return wrap;
}

export function renderFindResult(container, result, targets, onOpen, cardId) {
  container.textContent = "";
  const incomplete = result.complete === false || result.stopped || result.truncated;
  if (incomplete) {
    const reason = result.stopped
      ? "Search stopped before it finished."
      : result.truncated
        ? "Search reached its limit before it finished."
        : "Search ended before it finished.";
    const notice = el("p", "empty-text", result.found
      ? `${reason} These are the best routes found so far.`
      : `${reason} Try searching again to find a route.`);
    notice.setAttribute("role", "status");
    container.append(notice);
    if (!result.found) return;
  }
  if (!result.found) {
    const message = result.missing
      ? `Not found in ${countLabel(result.opens, "opening")}. Still needed: ${result.missing.map((name) => getItemPresentation(name).name).join(", ")}.`
      : `No route found within ${countLabel(result.maxDepth, "opening")}. Try a longer search or choose fewer items.`;
    const failure = el("p", "error-box", message);
    failure.setAttribute("role", "alert");
    container.append(failure);
    return;
  }

  if (result.path) {
    const summary = el("div", "xp-summary");
    summary.append(el("span", "xp-total", countLabel(result.opens, "opening")));
    summary.append(el("span", "xp-spend", `To collect ${countLabel(targets.length, "selected item")} from your current position.`));
    container.append(summary, renderFindPath(result.path, "Your route", null, onOpen, cardId, container));
    return;
  }

  const summary = el("div", "xp-summary");
  summary.append(el("span", "xp-total", countLabel(result.shortest.path.length, "opening")));
  summary.append(el("span", "xp-spend", result.same
    ? `Uses ${countLabel(result.cheapest.cost, "chest")}. ${countLabel(result.solutions, "route")} checked.`
    : `The ${incomplete ? "lowest-cost route found" : "lowest-cost route"} uses ${countLabel(result.cheapest.cost, "chest")} across ${countLabel(result.cheapest.path.length, "opening")}.`));
  container.append(summary);
  container.append(renderFindPath(result.shortest.path,
    incomplete ? "Fewest openings found" : "Fewest openings",
    `${countLabel(result.shortest.path.length, "opening")} · ${countLabel(result.shortest.cost, "chest")} used`,
    onOpen, cardId, container));
  if (!result.same) {
    const extraOpenNote = result.cheapest.path.length > result.shortest.path.length
      ? ". Keys found along the way cover the extra openings." : "";
    container.append(renderFindPath(result.cheapest.path,
      incomplete ? "Lowest cost found" : "Lowest cost",
      `${countLabel(result.cheapest.path.length, "opening")} · ${countLabel(result.cheapest.cost, "chest")} used${extraOpenNote}`,
      onOpen, cardId, container));
  }
}

export function renderError(container, message) {
  container.textContent = "";
  const error = el("p", "error-box", `Something went wrong: ${message}`);
  error.setAttribute("role", "alert");
  container.append(error);
}

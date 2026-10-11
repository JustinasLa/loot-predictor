// XP planner results: a big +XP banner (with its chips inside) and one step
// card per planned opening: NEXT or #N, a "Lv 12" badge and its XP pill.
import { getItemPresentation } from "../presentation.js";
import { el, countLabel, artwork } from "./dom.js";
import { openingCard } from "./opening-card.js";
import { boxArt } from "./chest-list.js";

const number = (value) => value.toLocaleString("en-US");

function emptyState(cardId, text) {
  const empty = el("div", "empty xp-empty");
  if (cardId) empty.append(boxArt(cardId));
  empty.append(el("p", "xp-empty-text", text));
  return empty;
}

// The comparison is "always open at your top level", in plain words.
function banner(xp, baseline) {
  const delta = xp - baseline.xp;
  const sign = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const always = baseline.level != null ? `always opening at Lv ${baseline.level}` : "always opening at your top level";
  const box = el("div", `xp-summary banner ${sign === "up" ? "banner--go" : "xp-summary--flat"}`);
  const headline = el("p", sign === "up" ? "xp-delta display-text" : "xp-delta",
    sign === "up" ? `+${number(delta)} XP`
      : sign === "down" ? `${number(-delta)} XP less` : "Same XP");
  headline.dataset.sign = sign;
  box.append(headline);
  const versus = el("p", "xp-versus",
    sign === "up" ? `More XP than ${always}` : sign === "down" ? `Than ${always}` : `As ${always}`);
  // The exact comparison stays one hover away; key refunds can make it
  // shorter or longer than the plan.
  versus.title = `${number(baseline.xp)} XP in ${countLabel(baseline.opens, "opening")}`;
  box.append(versus);
  return box;
}

function chip(className, text) {
  return el("span", `xp-chip ${className}`, text);
}

// The visible chip uses the short game copy; screen readers get the full sentence.
function progressChip(done, total) {
  const complete = done >= total;
  const progress = chip("xp-progress", null);
  if (complete) progress.classList.add("is-done");
  const visible = el("span", null, complete ? "Plan done!" : `${done} of ${total} done`);
  visible.setAttribute("aria-hidden", "true");
  progress.append(visible, el("span", "sr-only", complete
    ? " Plan complete."
    : ` ${done} of ${countLabel(total, "opening")} recorded.`));
  return progress;
}

function chips(solution, doneCount) {
  const row = el("div", "xp-chips");
  row.append(chip("xp-spend", countLabel(solution.path.length, "open")));
  const keys = solution.path.flatMap((step) => step.items.filter((item) => item.baseName.endsWith("KeyIcon")));
  if (keys.length > 0) {
    const keyChip = chip("xp-keys", null);
    keyChip.append(artwork(getItemPresentation(keys[0])), el("span", null, countLabel(keys.length, "bonus key")));
    row.append(keyChip);
  }
  if (solution.truncated) {
    const limit = chip("xp-warn", "Best so far");
    limit.title = "Hit the opening limit";
    row.append(limit);
  }
  if (solution.stopped) row.append(chip("xp-warn", "Stopped early"));
  if (doneCount > 0) row.append(progressChip(doneCount, solution.path.length));
  return row;
}

// A planned step is the shared opening card: its "Lv N" badge is the level
// to pick, and the XP pill is what that opening earns.
function stepCard(step, options) {
  const card = openingCard(step, options);
  card.classList.add("xp-step");
  return card;
}

export function renderXpPath(container, solution, baseline, freeOpenings, onOpen, doneCount = 0, cardId) {
  container.textContent = "";
  if (!solution || solution.xp < 0 || solution.path.length === 0) {
    container.append(emptyState(cardId, solution?.stopped
      ? "Stopped."
      : "No plan found. Try more keys or a higher level."));
    return;
  }

  const summary = banner(solution.xp, baseline);
  summary.append(chips(solution, doneCount));
  container.append(summary);

  // A button records every pending step up to it, at the levels in this plan.
  const steps = el("div", "xp-steps");
  for (const [index, step] of solution.path.entries()) {
    if (index < doneCount) continue;
    steps.append(stepCard(step, {
      cardId, number: index + 1, count: index + 1 - doneCount, container,
      onOpen: onOpen ? () => onOpen(solution.path.slice(doneCount, index + 1)) : null,
    }));
  }
  container.append(steps);
}

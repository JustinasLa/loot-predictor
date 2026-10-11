// XP planner results: a big +XP banner, a row of chips and one step card per
// planned opening ("Open at level 12" with its XP pill).
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

// The line under the banner keeps the opening count of the comparison, since
// key refunds can make the top-level baseline shorter or longer than the plan.
function banner(xp, baseline) {
  const baselineXp = baseline.xp;
  const delta = xp - baselineXp;
  const sign = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const box = el("div", `xp-summary banner ${sign === "up" ? "banner--go" : "xp-summary--flat"}`);
  const headline = el("p", sign === "up" ? "xp-delta display-text" : "xp-delta",
    sign === "up" ? `+${number(delta)} XP`
      : sign === "down" ? `${number(-delta)} XP less than top level`
        : "Same as top level");
  headline.dataset.sign = sign;
  box.append(headline);
  box.append(el("p", "xp-versus", `vs ${number(baselineXp)} XP in ${countLabel(baseline.opens, "opening")} at top level`));
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

// Re-title the shared opening card for a planned step: the level is what the
// player has to pick, and the XP pill is what that opening earns.
function stepCard(step, index, options) {
  const card = openingCard(step, options);
  card.classList.add("xp-step");
  const title = card.querySelector(".open-title");
  title.textContent = step.level != null ? `Open at level ${step.level}` : `Step ${index + 1}`;
  card.querySelector(".open-subtitle").remove();
  if (step.xp != null) title.after(el("span", "xp-pill", `+${number(step.xp)} XP`));
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

  container.append(banner(solution.xp, baseline), chips(solution, doneCount));

  // A button records every pending step up to it, at the levels in this plan.
  const steps = el("div", "xp-steps");
  for (const [index, step] of solution.path.entries()) {
    if (index < doneCount) continue;
    steps.append(stepCard(step, index, {
      cardId, number: index + 1, count: index + 1 - doneCount, route: true, container,
      onOpen: onOpen ? () => onOpen(solution.path.slice(doneCount, index + 1)) : null,
    }));
  }
  container.append(steps);
}

// XP planner results: a summary plus one step card per planned opening.
import { el, countLabel } from "./dom.js";
import { openingCard } from "./opening-card.js";

export function renderXpPath(container, solution, baseline, freeOpenings, onOpen, doneCount = 0, cardId) {
  container.textContent = "";
  if (!solution || solution.xp < 0 || solution.path.length === 0) {
    container.append(el("p", "empty", solution?.stopped
      ? "Search stopped before a plan was found. Try again to find a plan."
      : "No plan found. Check your level and available openings, then try again."));
    return;
  }

  const summary = el("div", "xp-summary banner banner--go");
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

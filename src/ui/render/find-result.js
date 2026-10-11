// Find results: the route(s) that reach the picked items.
import { getItemPresentation } from "../presentation.js";
import { el, countLabel } from "./dom.js";
import { openingCard } from "./opening-card.js";

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
    const notice = el("p", "banner banner--gold", result.found
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
    const summary = el("div", "xp-summary banner banner--go");
    summary.append(el("span", "xp-total", countLabel(result.opens, "opening")));
    summary.append(el("span", "xp-spend", `To collect ${countLabel(targets.length, "selected item")} from your current position.`));
    container.append(summary, renderFindPath(result.path, "Your route", null, onOpen, cardId, container));
    return;
  }

  const summary = el("div", "xp-summary banner banner--go");
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

// Find results: one big banner, then the route's opening cards with the
// wanted items marked "Yours!". Returns what happened, so the app can offer
// the right follow-up actions outside the result container.
import { el, countLabel } from "./dom.js";
import { openingCard } from "./opening-card.js";
import { itemSprites } from "./item-picker.js";

let toggleGroups = 0;

const asItem = (entry) => (typeof entry === "string" ? { baseName: entry, rarity: "None" } : entry);
const foundText = (path) => `Found in ${countLabel(path.length, "open")}!`;

function banner(className, text, role) {
  const node = el("div", `banner ${className}`);
  if (role) node.setAttribute("role", role);
  node.append(el("p", "find-banner-text", text));
  return node;
}

function stepCard(step, index, { adventure, onOpen, path, cardId, container }) {
  const count = index + 1;
  const card = openingCard(step, {
    cardId, number: count, count, route: true, container,
    onOpen: onOpen ? () => onOpen(path.slice(0, count)) : null,
  });
  const title = card.querySelector(".open-title");
  if (adventure && step.level != null) {
    title.textContent = `Open at level ${step.level}`;
  } else if (count === 1) {
    title.textContent = "Next box";
  } else {
    title.textContent = `#${count}`;
    title.setAttribute("aria-label", `Opening ${count}`);
  }
  return card;
}

function routeBlock(route, options) {
  const block = el("section", "route-block");
  block.dataset.route = route.key;
  block.append(el("h3", "sr-only", route.title));
  // Openings with nothing wanted fold into one disclosure, so the cards that
  // matter stay on screen. Their buttons keep their order in the DOM.
  let skipped = [];
  const flush = () => {
    if (skipped.length > 1) {
      const fold = el("details", "find-skip");
      fold.append(el("summary", "find-skip-summary", `+${countLabel(skipped.length, "open")}`), ...skipped);
      block.append(fold);
    } else {
      block.append(...skipped);
    }
    skipped = [];
  };
  for (const [index, step] of route.path.entries()) {
    const card = stepCard(step, index, { ...options, path: route.path });
    if (index > 0 && !step.hits?.length) {
      card.classList.add("is-plain");
      skipped.push(card);
    } else {
      flush();
      block.append(card);
    }
  }
  flush();
  return block;
}

function routeToggle(routes, blocks, title) {
  const group = el("div", "route-toggle");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Route");
  const name = `find-route-${++toggleGroups}`;
  for (const [index, route] of routes.entries()) {
    const pill = el("label", "route-pill");
    const radio = el("input", "sr-only");
    radio.type = "radio";
    radio.name = name;
    radio.value = route.key;
    radio.checked = index === 0;
    radio.addEventListener("change", () => {
      for (const [other, block] of blocks.entries()) block.classList.toggle("is-hidden", other !== index);
      title.textContent = foundText(route.path);
    });
    pill.append(radio, el("span", "route-pill-text", route.label));
    group.append(pill);
  }
  return group;
}

export function renderFindResult(container, result, targets, onOpen, cardId) {
  container.textContent = "";
  const wanted = targets.map(asItem);
  const byName = new Map(wanted.map((item) => [item.baseName, item]));
  const incomplete = result.complete === false || !!result.stopped || !!result.truncated;
  const limit = !result.stopped && !!result.truncated;

  if (!result.found) {
    if (incomplete) {
      container.append(banner("banner--gold find-incomplete", limit ? "Hit the search limit." : "Stopped.", "status"));
      return limit ? "limit" : "stopped";
    }
    const opens = result.missing ? result.opens : result.maxDepth;
    const missing = (result.missing ?? [...byName.keys()]).map((name) => byName.get(name) ?? asItem(name));
    const miss = banner("find-miss", `Not in the next ${opens.toLocaleString()} ${opens === 1 ? "open" : "opens"}.`, "alert");
    miss.append(itemSprites(missing));
    container.append(miss);
    return "missing";
  }

  if (incomplete) {
    container.append(banner("banner--gold find-incomplete",
      limit ? "Hit the search limit. Best so far:" : "Stopped early. Best so far:", "status"));
  }

  const adventure = !result.path;
  const routes = result.path
    ? [{ key: "route", title: "Route", path: result.path }]
    : [{ key: "fastest", title: "Fastest", path: result.shortest.path,
      label: `Fastest · ${countLabel(result.shortest.path.length, "open")}` }];
  if (!result.path && !result.same) {
    routes.push({ key: "fewest-keys", title: "Fewest keys", path: result.cheapest.path,
      label: `Fewest keys · ${countLabel(Math.max(0, result.cheapest.cost), "key")}` });
  }

  const found = banner("banner--go find-found", foundText(routes[0].path));
  const title = found.firstChild;
  title.classList.add("display-text");
  found.append(itemSprites(wanted));
  container.append(found);

  const blocks = routes.map((route, index) => {
    const block = routeBlock(route, { adventure, onOpen, cardId, container });
    if (index > 0) block.classList.add("is-hidden");
    return block;
  });
  if (blocks.length > 1) container.append(routeToggle(routes, blocks, title));
  container.append(...blocks);
  return "found";
}

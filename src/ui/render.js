// DOM rendering helpers. Keep all element construction here so app.js
// stays prediction logic + wiring.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Renders one sidebar category's chests as Discord-style channel rows.
// `activeId` gets the highlighted state; clicking a row calls `onSelect`.
export function renderChestList(container, cardStates, activeId, onSelect) {
  container.textContent = "";
  for (const [id, st] of Object.entries(cardStates)) {
    const row = el("button", "channel-row");
    row.type = "button";
    row.dataset.on = id === activeId ? "yes" : "no";
    if (id === activeId) row.classList.add("is-active");
    row.append(el("span", "hash", "#"));
    row.append(el("span", null, id));
    if (st.level) row.append(el("span", "channel-badge", `lvl ${st.level}`));
    row.addEventListener("click", () => onSelect(id));
    container.append(row);
  }
}

function renderOpen(open, cardId, position, onOpen) {
  const box = el("div", "open-box");

  const head = el("div", "open-head");
  const level = open.level ?? open.items.find((item) => item.level != null)?.level;
  const levelLabel = cardId.startsWith("adventure_") && level != null ? ` · level ${level}` : "";
  head.append(el("span", "open-title", `${cardId} · open #${open.open}${levelLabel}`));

  const seedText =
    open.keyRoll !== undefined
      ? `seed ${open.seed} · key roll ${open.keyRoll} → ${open.nextSeed}`
      : `seed ${open.seed} → ${open.nextSeed}`;
  head.append(el("span", "seed-text", seedText));

  // Opening card N means consuming every box up to and including it, since
  // the seed chain runs through them, so the label spells out the cost.
  if (onOpen) {
    const btn = el("button", "open-card-btn", position === 1 ? "open" : `open ×${position}`);
    btn.title = position === 1
      ? "open this box, advance the seed"
      : `open this box and the ${position - 1} before it lol`;
    btn.addEventListener("click", () => onOpen(position));
    head.append(btn);
  }

  box.append(head);

  const list = el("ul", "flex flex-col gap-1 list-none m-0 p-0");
  for (const item of open.items) {
    const li = el("li", "item-row");
    li.dataset.rarity = item.rarity;
    li.append(el("span", null, item.name));
    li.append(el("span", "item-rarity", item.rarity));
    list.append(li);
  }
  box.append(list);

  return box;
}

export function renderResults(container, cardId, chain, onOpen) {
  container.textContent = "";
  for (const [i, open] of chain.entries()) {
    container.append(renderOpen(open, cardId, i + 1, onOpen));
  }
}

// Opens already walked past, newest first.
export function renderHistory(container, cardId, history) {
  container.textContent = "";
  if (history.length === 0) {
    container.append(el("p", "empty-text", "nothing opened yet lmao"));
    return;
  }
  for (const open of history) {
    const box = renderOpen(open, cardId);
    box.classList.add("is-past");
    container.append(box);
  }
}

// `doneCount` steps at the head of the path have already been opened against
// the live seed, so they drop off the list. The steps after them are still
// valid, each was solved from the seed those opens produce, so the path can
// be worked box by box instead of vanishing after the first commit.
export function renderXpPath(container, solution, baseline, freeOpenings, onOpen, doneCount = 0) {
  container.textContent = "";

  if (!solution || solution.xp < 0 || solution.path.length === 0) {
    container.append(el("p", "empty-text",
      solution?.stopped ? "search stopped before a path was found" : "no path found bro"));
    return;
  }

  const summary = el("div", "xp-summary");
  summary.append(el("span", "xp-total", `${solution.xp} XP`));

  const delta = solution.xp - baseline.xp;
  const pct = baseline.xp > 0 ? Math.round((delta / baseline.xp) * 100) : null;
  const percentLabel = pct == null ? "" : ` (${delta > 0 ? "+" : ""}${pct}%)`;
  const baselineLabel = `(${baseline.xp} xp in ${baseline.opens} opens)`;
  const cmp = el("span", "xp-delta");
  cmp.dataset.sign = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  cmp.textContent =
    delta > 0
      ? `+${delta} xp${percentLabel} vs always max level fr ${baselineLabel}`
      : delta < 0
        ? `${-delta} xp less${percentLabel} than always max level ${baselineLabel}`
        : `same as always max level ngl ${baselineLabel}`;
  summary.append(cmp);

  // Keys refund an opening, so a path can be longer than the free openings.
  const keys = solution.path.reduce(
    (n, step) => n + step.items.filter((i) => i.baseName.endsWith("KeyIcon")).length, 0
  );
  const spend = el("span", "xp-spend");
  spend.textContent =
    keys > 0
      ? `${solution.path.length} opens from ${freeOpenings} free, ${keys} key(s) refunded lol`
      : `${solution.path.length} opens from ${freeOpenings} free, no keys dropped tbh`;
  summary.append(spend);

  if (solution.truncated) {
    summary.append(el("span", "xp-warn",
      `search reached the ${solution.maxOpens}-open limit`));
  }

  if (solution.stopped) {
    summary.append(el("span", "xp-warn", "search stopped early; showing the best path found"));
  }

  if (doneCount > 0) {
    summary.append(el("span", "xp-progress",
      doneCount >= solution.path.length
        ? "path done, seed saved lmao"
        : `${doneCount} of ${solution.path.length} opened, seed saved`));
  }

  container.append(summary);

  for (const [i, step] of solution.path.entries()) {
    if (i < doneCount) continue;   // already opened, off the list

    const box = el("div", "open-box");

    const head = el("div", "open-head");
    head.append(el("span", "open-title", `step ${i + 1} · level ${step.level}`));
    head.append(el("span", "seed-text", `seed ${step.usedSeed} · +${step.xp} XP`));

    // Committing step N means opening every step still pending up to it, at
    // the levels this path specifies, that is what advances and persists the
    // seed.
    if (onOpen) {
      const count = i + 1 - doneCount;
      const btn = el("button", "open-card-btn", count === 1 ? "open" : `open ×${count}`);
      btn.title = count === 1
        ? "open this box at this level, save the new seed"
        : `open this box and the ${count - 1} before it, save the new seed`;
      btn.addEventListener("click", () => onOpen(solution.path.slice(doneCount, i + 1)));
      head.append(btn);
    }

    box.append(head);

    const list = el("ul", "flex flex-col gap-1 list-none m-0 p-0");
    for (const item of step.items) {
      const li = el("li", "item-row");
      li.dataset.rarity = item.rarity;
      li.append(el("span", null, item.name));
      li.append(el("span", "item-rarity", item.rarity));
      list.append(li);
    }
    box.append(list);
    container.append(box);
  }
}

export function renderItemPicker(container, items, selected, onToggle) {
  container.textContent = "";
  if (items.length === 0) {
    container.append(el("p", "empty-text", "chest got no item pool mapped, idk"));
    return;
  }

  for (const item of items) {
    const chip = el("button", "item-chip");
    chip.dataset.rarity = item.rarity;
    chip.dataset.on = selected.has(item.baseName) ? "yes" : "no";
    chip.append(el("span", null, item.baseName));
    chip.append(el("span", "item-rarity", item.rarity));
    chip.addEventListener("click", () => onToggle(item.baseName));
    container.append(chip);
  }
}

function renderFindPath(path, label, note, onOpen) {
  const wrap = el("div", "flex flex-col gap-2 mt-1");
  wrap.append(el("h3", "col-head", label));
  if (note) wrap.append(el("p", "text-discord-text-muted text-[0.8rem] mb-1", note));

  for (const [i, step] of path.entries()) {
    const box = el("div", "open-box");
    const head = el("div", "open-head");
    head.append(el("span", "open-title",
      step.level ? `step ${i + 1} · level ${step.level}` : `open ${i + 1}`));
    if (step.usedSeed !== undefined || step.seed !== undefined) {
      head.append(el("span", "seed-text", `seed ${step.usedSeed ?? step.seed}`));
    }

    // Committing step N means opening every step up to it, at the levels
    // this route specifies, that is what advances and persists the seed.
    if (onOpen) {
      const count = i + 1;
      const btn = el("button", "open-card-btn", count === 1 ? "open" : `open ×${count}`);
      btn.title = count === 1
        ? "open this box, save the new seed"
        : `open this box and the ${count - 1} before it, save the new seed`;
      btn.addEventListener("click", () => onOpen(path.slice(0, count)));
      head.append(btn);
    }

    box.append(head);

    const list = el("ul", "flex flex-col gap-1 list-none m-0 p-0");
    for (const item of step.items) {
      const li = el("li", "item-row");
      li.dataset.rarity = item.rarity;
      if (step.hits?.includes(item.baseName)) li.dataset.hit = "yes";
      li.append(el("span", null, item.name));
      li.append(el("span", "item-rarity", item.rarity));
      list.append(li);
    }
    box.append(list);
    wrap.append(box);
  }
  return wrap;
}

export function renderFindResult(container, result, targets, onOpen) {
  container.textContent = "";

  const incomplete = result.complete === false || result.stopped || result.truncated;
  if (incomplete) {
    const reason = result.stopped
      ? "search stopped before completion"
      : result.truncated
        ? `search reached ${result.maxNodes == null ? "its node limit" : `the ${result.maxNodes.toLocaleString()}-node limit`} before completion`
        : "search ended before completion";
    const notice = el("p", "empty-text", result.found
      ? `${reason}; routes shown are the best found so far`
      : `${reason}; continue searching to find a route`);
    notice.setAttribute("role", "status");
    container.append(notice);
    if (!result.found) return;
  }

  if (!result.found) {
    const msg = result.missing
      ? `didnt find it in ${result.opens} opens, still missing: ${result.missing.join(", ")}`
      : `no route found within ${result.maxDepth} opens rip`;
    const failure = el("p", "error-box", msg);
    failure.setAttribute("role", "alert");
    container.append(failure);
    return;
  }

  // Linear (non-adventure) result: one chain, no choices to compare.
  if (result.path) {
    const summary = el("div", "xp-summary");
    summary.append(el("span", "xp-total", `${result.opens} opens`));
    summary.append(el("span", "xp-spend",
      `to grab ${targets.length} item(s) from the current seed`));
    container.append(summary);
    container.append(renderFindPath(result.path, "route", null, onOpen));
    return;
  }

  const summary = el("div", "xp-summary");
  summary.append(el("span", "xp-total", `${result.shortest.path.length} opens`));
  summary.append(el("span", "xp-spend",
    result.same
      ? `costs ${result.cheapest.cost} chest(s), ${result.solutions} route(s) considered`
      : `${incomplete ? "fewest opens found, lowest cost found" : "fewest opens, cheapest route"} costs ${result.cheapest.cost} chest(s) in ${result.cheapest.path.length} opens`));
  container.append(summary);

  container.append(renderFindPath(
    result.shortest.path, incomplete ? "fewest opens found" : "fewest opens",
    `${result.shortest.path.length} opens, ${result.shortest.cost} chest(s) spent`,
    onOpen
  ));

  if (!result.same) {
    const extraOpenNote = result.cheapest.path.length > result.shortest.path.length
      ? ", key refunds pay for the extra opens" : "";
    container.append(renderFindPath(
      result.cheapest.path, incomplete ? "lowest cost found" : "cheapest",
      `${result.cheapest.path.length} opens, ${result.cheapest.cost} chest(s) spent${extraOpenNote}`,
      onOpen
    ));
  }
}

export function renderError(container, message) {
  container.textContent = "";
  container.append(el("p", "error-box", `bruh error: ${message}`));
}

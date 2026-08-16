// DOM rendering helpers. Keep all element construction here so app.js
// stays prediction logic + wiring.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function renderChests(select, cardStates) {
  select.textContent = "";
  for (const [id, st] of Object.entries(cardStates)) {
    const opt = el("option", null, st.level ? `${id} — level ${st.level}` : id);
    opt.value = id;
    select.append(opt);
  }
  select.disabled = false;
}

function renderOpen(open, cardId, position, onOpen) {
  const box = el("div", "open");

  const head = el("div", "open-head");
  head.append(el("span", "open-title", `${cardId} · open #${open.open}`));

  const seedText =
    open.keyRoll !== undefined
      ? `seed ${open.seed} · key roll ${open.keyRoll} → ${open.nextSeed}`
      : `seed ${open.seed} → ${open.nextSeed}`;
  head.append(el("span", "seed", seedText));

  // Opening card N means consuming every box up to and including it, since
  // the seed chain runs through them — so the label spells out the cost.
  if (onOpen) {
    const btn = el("button", "open-card-btn", position === 1 ? "Open" : `Open ×${position}`);
    btn.title = position === 1
      ? "Open this box and advance the seed"
      : `Open this box and the ${position - 1} before it`;
    btn.addEventListener("click", () => onOpen(position));
    head.append(btn);
  }

  box.append(head);

  const list = el("ul", "items");
  for (const item of open.items) {
    const li = el("li");
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
    container.append(el("p", "empty", "Nothing opened yet."));
    return;
  }
  for (const open of history) {
    const box = renderOpen(open, cardId);
    box.classList.add("is-past");
    container.append(box);
  }
}

export function renderVerification(container, results) {
  container.textContent = "";

  if (results.length === 0) {
    container.append(el("p", "empty", "No chests appear in both savegames."));
    return;
  }

  const moved = results.filter((r) => r.status === "match" || r.status === "mismatch");
  if (moved.length === 0) {
    container.append(
      el("p", "empty", "No chests were opened between these two saves — nothing to verify.")
    );
  }

  for (const result of results) {
    const box = el("div", "result");
    box.dataset.status = result.status;

    box.append(el("span", "badge", result.status));

    const detail = el("span", "result-detail");
    if (result.status === "match") {
      detail.append(
        el("strong", null, result.cardId),
        document.createTextNode(
          ` — ${result.opens} open(s), predicted seed ${result.actualSeed} = actual`
        )
      );
    } else if (result.status === "mismatch") {
      detail.append(
        el("strong", null, result.cardId),
        document.createTextNode(
          ` — ${result.opens} open(s), predicted ${result.actualSeed}, game had ${result.expectedSeed}`
        )
      );
    } else {
      detail.append(
        el("strong", null, result.cardId),
        document.createTextNode(` — ${result.reason}`)
      );
    }
    box.append(detail);

    if (result.chain) {
      const details = el("details");
      details.append(el("summary", null, `what those ${result.opens} open(s) contained`));
      const inner = el("div", "out");
      for (const open of result.chain) inner.append(renderOpen(open, result.cardId));
      details.append(inner);
      box.append(el("span"), details);
    }

    container.append(box);
  }
}

export function renderXpPath(container, solution, baseline, freeOpenings) {
  container.textContent = "";

  if (!solution || solution.xp < 0 || solution.path.length === 0) {
    container.append(el("p", "empty", "No path found."));
    return;
  }

  const summary = el("div", "xp-summary");
  summary.append(el("span", "xp-total", `${solution.xp} XP`));

  const delta = solution.xp - baseline.xp;
  const pct = baseline.xp > 0 ? Math.round((delta / baseline.xp) * 100) : 0;
  const cmp = el("span", "xp-delta");
  cmp.dataset.sign = delta > 0 ? "up" : "flat";
  cmp.textContent =
    delta > 0
      ? `+${delta} XP (+${pct}%) vs always max level (${baseline.xp} XP in ${baseline.opens} opens)`
      : `same as always max level (${baseline.xp} XP in ${baseline.opens} opens)`;
  summary.append(cmp);

  // Keys refund an opening, so a path can be longer than the free openings.
  const keys = solution.path.reduce(
    (n, step) => n + step.items.filter((i) => i.baseName.endsWith("KeyIcon")).length, 0
  );
  const spend = el("span", "xp-spend");
  spend.textContent =
    keys > 0
      ? `${solution.path.length} opens from ${freeOpenings} free — ${keys} key(s) refunded`
      : `${solution.path.length} opens from ${freeOpenings} free — no keys dropped`;
  summary.append(spend);

  if (solution.truncated) {
    summary.append(el("span", "xp-warn",
      `path hit your ${solution.maxOpens}-open limit — keys kept refunding`));
  }

  container.append(summary);

  for (const [i, step] of solution.path.entries()) {
    const box = el("div", "open");

    const head = el("div", "open-head");
    head.append(el("span", "open-title", `step ${i + 1} · level ${step.level}`));
    head.append(el("span", "seed", `seed ${step.usedSeed} · +${step.xp} XP`));
    box.append(head);

    const list = el("ul", "items");
    for (const item of step.items) {
      const li = el("li");
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
    container.append(el("p", "empty", "This chest has no item pool mapped."));
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

function renderFindPath(path, label, note) {
  const wrap = el("div", "find-route");
  wrap.append(el("h3", "route-head", label));
  if (note) wrap.append(el("p", "route-note", note));

  for (const [i, step] of path.entries()) {
    const box = el("div", "open");
    const head = el("div", "open-head");
    head.append(el("span", "open-title",
      step.level ? `step ${i + 1} · level ${step.level}` : `open ${i + 1}`));
    if (step.usedSeed !== undefined || step.seed !== undefined) {
      head.append(el("span", "seed", `seed ${step.usedSeed ?? step.seed}`));
    }
    box.append(head);

    const list = el("ul", "items");
    for (const item of step.items) {
      const li = el("li");
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

export function renderFindResult(container, result, targets) {
  container.textContent = "";

  if (!result.found) {
    const msg = result.missing
      ? `Not found in ${result.opens} opens. Still missing: ${result.missing.join(", ")}`
      : `No route found within ${result.maxDepth} opens.`;
    container.append(el("p", "error", msg));
    return;
  }

  // Linear (non-adventure) result: one chain, no choices to compare.
  if (result.path) {
    const summary = el("div", "xp-summary");
    summary.append(el("span", "xp-total", `${result.opens} opens`));
    summary.append(el("span", "xp-spend",
      `to collect ${targets.length} item(s) from the current seed`));
    container.append(summary);
    container.append(renderFindPath(result.path, "Route"));
    return;
  }

  const summary = el("div", "xp-summary");
  summary.append(el("span", "xp-total", `${result.shortest.path.length} opens`));
  summary.append(el("span", "xp-spend",
    result.same
      ? `costs ${result.cheapest.cost} chest(s) · ${result.solutions} route(s) considered`
      : `fewest opens · cheapest route costs ${result.cheapest.cost} chest(s) in ${result.cheapest.path.length} opens`));
  container.append(summary);

  container.append(renderFindPath(
    result.shortest.path, "Fewest opens",
    `${result.shortest.path.length} opens, ${result.shortest.cost} chest(s) spent`
  ));

  if (!result.same) {
    container.append(renderFindPath(
      result.cheapest.path, "Cheapest",
      `${result.cheapest.path.length} opens, ${result.cheapest.cost} chest(s) spent — key refunds pay for the extra opens`
    ));
  }
}

export function renderError(container, message) {
  container.textContent = "";
  container.append(el("p", "error", `Error: ${message}`));
}

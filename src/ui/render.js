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

function renderOpen(open, cardId) {
  const box = el("div", "open");

  const head = el("div", "open-head");
  head.append(el("span", "open-title", `${cardId} · open #${open.open}`));

  const seedText =
    open.keyRoll !== undefined
      ? `seed ${open.seed} · key roll ${open.keyRoll} → ${open.nextSeed}`
      : `seed ${open.seed} → ${open.nextSeed}`;
  head.append(el("span", "seed", seedText));
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

export function renderResults(container, cardId, chain) {
  container.textContent = "";
  for (const open of chain) container.append(renderOpen(open, cardId));
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

export function renderError(container, message) {
  container.textContent = "";
  container.append(el("p", "error", `Error: ${message}`));
}

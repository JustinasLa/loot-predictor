// DOM rendering helpers. Keep all element construction here so app.js
// stays prediction logic + wiring.

export function renderChests(select, cardStates) {
  select.textContent = "";
  for (const [id, st] of Object.entries(cardStates)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = st.level ? `${id} (level ${st.level})` : id;
    select.append(opt);
  }
}

export function renderResults(container, cardId, chain) {
  container.textContent = "";

  for (const open of chain) {
    const section = document.createElement("section");

    const head = document.createElement("h3");
    head.textContent = `${cardId} — open #${open.open} (seed ${open.seed})`;
    section.append(head);

    const list = document.createElement("ol");
    for (const item of open.items) {
      const li = document.createElement("li");
      li.textContent = item.name;
      li.dataset.rarity = item.rarity;
      list.append(li);
    }
    section.append(list);

    const foot = document.createElement("small");
    foot.textContent =
      open.keyRoll !== undefined
        ? `key roll ${open.keyRoll} · next seed ${open.nextSeed}`
        : `next seed ${open.nextSeed}`;
    section.append(foot);

    container.append(section);
  }
}

export function renderError(container, message) {
  container.textContent = `Error: ${message}`;
}

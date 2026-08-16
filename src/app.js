import { parseSavegame } from "./save/parse.js";
import { predictChain } from "./loot/simulate.js";
import { verifyAll } from "./verify.js";
import * as storage from "./storage.js";
import {
  renderChests, renderResults, renderHistory, renderVerification, renderError
} from "./ui/render.js";

// `saved` is the untouched baseline from the file; `live` tracks the seed as
// you walk it forward. Both survive a refresh — only loading a new savegame
// replaces them.
let saved = {};
let live = {};
const compare = { before: null, after: null };

const $ = (sel) => document.querySelector(sel);

function readSave(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { resolve(parseSavegame(e.target.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("could not read file"));
    reader.readAsText(file);
  });
}

function currentId() {
  return $("#chest").value;
}

function currentState() {
  const state = live[currentId()];
  if (!state) throw new Error("load a savegame first");
  return state;
}

function chainOpts(state) {
  return {
    level: state.level,
    vaultPercentage: Number($("#vault").value) || 0
  };
}

function persist() {
  storage.save({
    saved,
    live,
    ui: {
      cardId: currentId(),
      count: $("#count").value,
      vault: $("#vault").value
    }
  });
}

function enableControls() {
  for (const id of ["#seed", "#reset", "#open-custom-go"]) $(id).disabled = false;
  for (const btn of document.querySelectorAll(".open-btn")) btn.disabled = false;
}

// Advance the live seed by `times` opens, recording what each one produced.
function openChest(times) {
  const cardId = currentId();
  const state = currentState();

  for (let i = 0; i < times; i++) {
    const [open] = predictChain(state.seed, cardId, 1, chainOpts(state));
    state.history.unshift({ ...open, open: ++state.opened });
    state.seed = open.nextSeed;
  }

  refresh();
}

function resetChest() {
  const state = currentState();
  state.seed = saved[currentId()].initialSeed;
  state.opened = 0;
  state.history = [];
  refresh();
}

// Redraw everything that depends on the live seed, then checkpoint.
function refresh() {
  const out = $("#out");
  try {
    const cardId = currentId();
    const state = currentState();

    $("#seed").value = state.seed;
    $("#history-count").textContent = state.opened ? `(${state.opened})` : "";
    $("#open-status").textContent = state.opened
      ? `${state.opened} open(s) ahead of the savegame`
      : "at savegame seed";

    renderResults(
      out, cardId,
      predictChain(state.seed, cardId, Number($("#count").value) || 5, chainOpts(state))
    );
    renderHistory($("#history"), cardId, state.history);
    persist();
  } catch (err) {
    renderError(out, err.message);
  }
}

function adoptSave(parsed) {
  saved = parsed;
  live = Object.fromEntries(
    Object.entries(saved).map(([id, st]) => [
      id, { seed: st.initialSeed, level: st.level, opened: 0, history: [] }
    ])
  );
  renderChests($("#chest"), saved);
  enableControls();
  refresh();
}

function restore() {
  const state = storage.load();
  if (!state) return false;

  saved = state.saved;
  live = state.live;
  renderChests($("#chest"), saved);
  if (state.ui?.cardId && live[state.ui.cardId]) $("#chest").value = state.ui.cardId;
  if (state.ui?.count) $("#count").value = state.ui.count;
  if (state.ui?.vault) $("#vault").value = state.ui.vault;
  enableControls();
  refresh();
  return true;
}

function runVerification() {
  const out = $("#out-verify");
  try {
    if (!compare.before || !compare.after) throw new Error("load both savegames");
    renderVerification(out, verifyAll(compare.before, compare.after));
  } catch (err) {
    renderError(out, err.message);
  }
}

function initTabs() {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".tab")) {
        other.classList.toggle("is-active", other === tab);
      }
      for (const panel of document.querySelectorAll(".panel")) {
        panel.classList.toggle("is-hidden", panel.id !== `panel-${tab.dataset.tab}`);
      }
    });
  }
}

function init() {
  initTabs();

  $("#save").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      adoptSave(await readSave(file));
    } catch (err) {
      renderError($("#out"), err.message);
    }
  });

  $("#chest").addEventListener("change", refresh);
  $("#count").addEventListener("change", refresh);
  $("#vault").addEventListener("change", refresh);

  // Editing the seed by hand replaces the live seed but keeps the history,
  // so you can jump to an arbitrary seed without reloading a savegame.
  $("#seed").addEventListener("change", () => {
    const value = Number($("#seed").value);
    if (!Number.isInteger(value)) return;
    currentState().seed = value;
    refresh();
  });

  for (const btn of document.querySelectorAll(".open-btn")) {
    btn.addEventListener("click", () => openChest(Number(btn.dataset.open)));
  }

  $("#open-custom-go").addEventListener("click", () => {
    const times = Number($("#open-custom").value);
    if (!Number.isInteger(times) || times < 1) return;
    // Each open is three-plus draws; keep the click from locking up the tab.
    openChest(Math.min(times, 10000));
  });

  $("#reset").addEventListener("click", resetChest);

  for (const which of ["before", "after"]) {
    $(`#save-${which}`).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        compare[which] = await readSave(file);
        $("#run-verify").disabled = !(compare.before && compare.after);
        if (compare.before && compare.after) runVerification();
      } catch (err) {
        renderError($("#out-verify"), err.message);
      }
    });
  }

  $("#run-verify").addEventListener("click", runVerification);

  restore();
}

init();

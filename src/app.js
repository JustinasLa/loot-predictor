import { parseSavegame } from "./save/parse.js";
import { predictChain } from "./loot/simulate.js";
import { verifyAll } from "./verify.js";
import * as storage from "./storage.js";
import { findOptimalXpPath } from "./solver/xp-path.js";
import { DOMINANT_ADVENTURE_LEVELS } from "./loot/tables.js";
import { simulateAdventureChestOpening } from "./loot/simulate.js";
import { getItemXp } from "./loot/xp.js";
import {
  renderChests, renderResults, renderHistory, renderVerification,
  renderXpPath, renderError
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
      predictChain(state.seed, cardId, Number($("#count").value) || 5, chainOpts(state)),
      openChest
    );
    renderHistory($("#history"), cardId, state.history);
    syncSmartXp();
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

// --- Smart XP -------------------------------------------------------------

let stopSearch = false;

// What you'd bank by just replaying the highest level every time. Spends
// openings under the same rules as the search — including key refunds —
// so the comparison is like for like.
function naiveXp(seed, cardId, eventType, level, vaultPercentage, openings, maxOpens) {
  let current = seed;
  let openingsLeft = openings;
  let xp = 0;
  let opens = 0;

  while (openingsLeft > 0 && opens < maxOpens) {
    const result = simulateAdventureChestOpening(
      current, level, eventType, vaultPercentage, cardId
    );
    xp += result.items.reduce((sum, item) => sum + getItemXp(item), 0);
    openingsLeft += result.items.filter((i) => i.baseName.endsWith("KeyIcon")).length - 1;
    current = result.nextSeed;
    opens++;
  }

  return { xp, opens };
}

// The search branches once per candidate level, so cost is levels^openings.
// There is no cap on openings — but show what you're asking for first.
function branchCount(maxLevel) {
  const levels = DOMINANT_ADVENTURE_LEVELS.filter((level) => level <= maxLevel);
  if (!levels.includes(maxLevel)) levels.push(maxLevel);
  return levels.length;
}

function syncXpEstimate() {
  const openings = Number($("#xp-openings").value) || 1;
  const branches = branchCount(Number($("#xp-maxlevel").value) || 1);
  const paths = Math.pow(branches, openings);

  const label = $("#xp-estimate");
  // ~200k paths/second measured in browser; rough, but the order of
  // magnitude is what matters when deciding whether to hit the button.
  const seconds = paths / 200000;
  const cost =
    seconds < 1 ? "instant"
      : seconds < 60 ? `~${Math.round(seconds)}s`
      : seconds < 3600 ? `~${Math.round(seconds / 60)}min`
      : `~${(seconds / 3600).toFixed(1)}h`;

  // Key refunds extend the path, so this is a floor, not a ceiling.
  label.textContent =
    `≥ ${branches}^${openings} = ${paths.toExponential(1)} paths · ${cost}`;
  label.dataset.heavy = seconds > 20 ? "yes" : "no";
}

function syncSmartXp() {
  const cardId = currentId();
  const isAdventure = cardId.startsWith("adventure_");
  $("#smart-xp").classList.toggle("is-hidden", !isAdventure);
  if (!isAdventure) return;

  const state = live[cardId];
  if (state?.level) $("#xp-maxlevel").value = state.level;
  $("#xp-search").disabled = false;
  syncXpEstimate();
}

async function runXpSearch() {
  const cardId = currentId();
  const state = currentState();
  const eventType = cardId.slice("adventure_".length);
  const openings = Math.max(Number($("#xp-openings").value) || 4, 1);
  const maxLevel = Number($("#xp-maxlevel").value) || state.level || 1;
  const vaultPercentage = Number($("#vault").value) || 0;
  // Blank means no limit.
  const maxOpens = Number($("#xp-maxopens").value) || Infinity;

  stopSearch = false;
  $("#xp-search").disabled = true;
  $("#xp-stop").classList.remove("is-hidden");
  $("#xp-status").textContent = "searching…";
  $("#xp-out").textContent = "";

  const started = Date.now();
  try {
    const solution = await findOptimalXpPath({
      startSeed: state.seed,
      eventType,
      cardId,
      maxLevel,
      vaultPercentage,
      openings,
      maxOpens,
      onProgress: (depth) => { $("#xp-status").textContent = `searching… depth ${depth}`; },
      shouldStop: () => stopSearch
    });

    // Bound the baseline by the path the solver actually found, so an
    // uncapped run can't spin here forever on refunded keys.
    const baseline = naiveXp(
      state.seed, cardId, eventType, maxLevel, vaultPercentage, openings,
      Math.max(solution.path.length, openings)
    );
    renderXpPath($("#xp-out"), solution, baseline, openings);
    $("#xp-status").textContent =
      `${solution.nodesVisited.toLocaleString()} paths in ${Date.now() - started}ms` +
      (stopSearch ? " (stopped early)" : "");
  } catch (err) {
    renderError($("#xp-out"), err.message);
    $("#xp-status").textContent = "";
  } finally {
    $("#xp-search").disabled = false;
    $("#xp-stop").classList.add("is-hidden");
  }
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

  $("#xp-openings").addEventListener("input", syncXpEstimate);
  $("#xp-maxlevel").addEventListener("input", syncXpEstimate);
  $("#xp-search").addEventListener("click", runXpSearch);
  $("#xp-stop").addEventListener("click", () => {
    stopSearch = true;
    $("#xp-status").textContent = "stopping…";
  });

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

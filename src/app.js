import { parseSavegame } from "./save/parse.js";
import { predictChain } from "./loot/simulate.js";
import * as storage from "./storage.js";
import { findOptimalXpPath } from "./solver/xp-path.js";
import { DOMINANT_ADVENTURE_LEVELS } from "./loot/tables.js";
import { simulateAdventureChestOpening } from "./loot/simulate.js";
import { getItemXp } from "./loot/xp.js";
import { findAllPaths, findItemLinear } from "./solver/find-items.js";
import { getAvailableItemsForChest } from "./loot/items.js";
import {
  renderChestList, renderResults, renderHistory,
  renderXpPath, renderItemPicker, renderFindResult, renderError
} from "./ui/render.js";

// `saved` is the untouched baseline from the file; `live` tracks the seed as
// you walk it forward. Both survive a refresh, only loading a new savegame
// replaces them.
let saved = {};
let live = {};
// Hunt targets are per chest, so switching chests doesn't carry a selection
// that the new chest can never drop.
const findTargets = new Map();

// The chest picked in each sidebar category. Predict and Find each keep
// their own selection, same as the two separate dropdowns they replaced.
let predictChestId = null;
let findChestIdState = null;
// The uploaded file's name, shown in the sidebar's user panel once loaded.
let savegameFilename = "";
// Which chest the level field was last shown/reset for, so switching chests
// snaps it back to that chest's real level without stomping on an edit
// you're still making on the same chest.
let previewLevelChestId = null;

const $ = (sel) => document.querySelector(sel);

function readSave(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { resolve(parseSavegame(e.target.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("couldnt read file bruh"));
    reader.readAsText(file);
  });
}

function currentId() {
  return predictChestId;
}

// Which panel is on screen. Picking a chest in either sidebar category
// switches to that category's panel, same as clicking a Discord channel
// jumps you to that channel.
function showTab(tab) {
  $("#panel-predict").classList.toggle("is-hidden", tab !== "predict");
  $("#panel-find").classList.toggle("is-hidden", tab !== "find");
}

// Redraws both sidebar categories so the active row matches current state.
function renderSidebars() {
  renderChestList($("#sidebar-predict-list"), saved, predictChestId, selectPredictChest);
  renderChestList($("#sidebar-find-list"), saved, findChestIdState, selectFindChest);
}

function selectPredictChest(id) {
  predictChestId = id;
  showTab("predict");
  renderSidebars();
  refresh();
}

function selectFindChest(id) {
  findChestIdState = id;
  showTab("find");
  renderSidebars();
  syncFindPanel();
}

function currentState() {
  const state = live[currentId()];
  if (!state) throw new Error("load a savegame first bro");
  return state;
}

// For adventure chests, the level field lets you preview (and open) at a
// level other than the chest's current one, e.g. "what's in a level 6 box".
// It stays put across opens on the same chest, only resetting when you
// switch chests, so it can also just drive a run of same-level opens.
function chainOpts(state) {
  const isAdventure = currentId()?.startsWith("adventure_");
  const level = isAdventure ? Number($("#preview-level").value) || state.level : state.level;
  return {
    level,
    vaultPercentage: Number($("#vault").value) || 0
  };
}

function persist() {
  storage.save({
    saved,
    live,
    // Hunt targets survive a refresh too, the whole point is picking the
    // route back up on a later day.
    targets: Object.fromEntries(
      [...findTargets].map(([id, set]) => [id, [...set]]).filter(([, list]) => list.length)
    ),
    ui: {
      cardId: currentId(),
      findCardId: findChestId(),
      count: $("#count").value,
      vault: $("#vault").value,
      filename: savegameFilename
    }
  });
}

// Wipes the persisted state and reloads, which is the simplest way back to
// a clean guest view, everything else already derives from a fresh load.
function unloadSave() {
  storage.clear();
  location.reload();
}

function enableControls() {
  for (const id of ["#seed", "#reset", "#open-custom-go"]) $(id).disabled = false;
  for (const btn of document.querySelectorAll(".open-btn")) btn.disabled = false;
  // Swap the sidebar's user panel from "load a savegame" to a logged-in bar,
  // like signing into Discord.
  $("#user-panel-guest").classList.add("is-hidden");
  $("#user-panel-loggedin").classList.remove("is-hidden");
  const nameEl = $("#user-filename");
  nameEl.textContent = savegameFilename;
  nameEl.title = savegameFilename;
}

// Advance the live seed by `times` opens, recording what each one produced.
// For adventure chests this opens at whatever level the level field shows,
// which may not be the chest's current level, see chainOpts.
function openChest(times) {
  const cardId = currentId();
  const state = currentState();
  const opts = chainOpts(state);

  for (let i = 0; i < times; i++) {
    const [open] = predictChain(state.seed, cardId, 1, opts);
    state.history.unshift({ ...open, open: ++state.opened });
    state.seed = open.nextSeed;
  }

  refresh();
}

// Shows the level field for adventure chests and resets it to the chest's
// real level, but only on an actual chest switch, so a level you typed in
// to preview/open with survives further opens on that same chest.
function syncPreviewLevelField(cardId, state) {
  const isAdventure = cardId.startsWith("adventure_");
  $("#preview-level-field").classList.toggle("is-hidden", !isAdventure);
  if (isAdventure && cardId !== previewLevelChestId) {
    $("#preview-level").value = state.level ?? "";
  }
  previewLevelChestId = cardId;
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
      ? `${state.opened} open(s) ahead of the savegame fr`
      : "at savegame seed lol";

    syncPreviewLevelField(cardId, state);
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

function adoptSave(parsed, filename) {
  saved = parsed;
  savegameFilename = filename;
  previewLevelChestId = null;
  live = Object.fromEntries(
    Object.entries(saved).map(([id, st]) => [
      id, { seed: st.initialSeed, level: st.level, opened: 0, history: [] }
    ])
  );
  const firstId = Object.keys(saved)[0];
  predictChestId = firstId;
  findChestIdState = firstId;
  renderSidebars();
  enableControls();
  refresh();
  syncFindPanel();
}

function restore() {
  const state = storage.load();
  if (!state) return false;

  saved = state.saved;
  live = state.live;
  findTargets.clear();
  for (const [id, list] of Object.entries(state.targets || {})) {
    findTargets.set(id, new Set(list));
  }
  const firstId = Object.keys(saved)[0] ?? null;
  predictChestId = state.ui?.cardId && live[state.ui.cardId] ? state.ui.cardId : firstId;
  findChestIdState = state.ui?.findCardId && live[state.ui.findCardId] ? state.ui.findCardId : firstId;
  savegameFilename = state.ui?.filename || "savegame";
  renderSidebars();
  if (state.ui?.count) $("#count").value = state.ui.count;
  if (state.ui?.vault) $("#vault").value = state.ui.vault;
  enableControls();
  refresh();
  syncFindPanel();
  return true;
}

// --- Smart XP -------------------------------------------------------------

let stopSearch = false;

// The XP path on screen, plus how many of its steps have been opened already.
// Kept so the path survives an "Open" click instead of being thrown away.
let xpView = null;

// What you'd bank by just replaying the highest level every time. Spends
// openings under the same rules as the search, including key refunds,
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
// There is no cap on openings, but show what you're asking for first.
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

  // A path belongs to the chest it was solved for; drop it on a switch.
  if (xpView && xpView.cardId !== cardId) {
    xpView = null;
    $("#xp-out").textContent = "";
    $("#xp-status").textContent = "";
  }

  if (!isAdventure) return;

  const state = live[cardId];
  if (state?.level) $("#xp-maxlevel").value = state.level;
  // One vault rate for the whole app; this field is a second view of #vault.
  $("#xp-vault").value = $("#vault").value;
  $("#xp-search").disabled = false;
  syncXpEstimate();
}

async function runXpSearch() {
  const cardId = currentId();
  const state = currentState();
  const eventType = cardId.slice("adventure_".length);
  const openings = Math.max(Number($("#xp-openings").value) || 4, 1);
  const maxLevel = Number($("#xp-maxlevel").value) || state.level || 1;
  const vaultPercentage = Number($("#xp-vault").value) || 0;
  // Blank means no limit.
  const maxOpens = Number($("#xp-maxopens").value) || Infinity;

  stopSearch = false;
  $("#xp-search").disabled = true;
  $("#xp-stop").classList.remove("is-hidden");
  $("#xp-status").textContent = "searching… lol";
  $("#xp-out").textContent = "";
  xpView = null;

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
    xpView = { cardId, solution, baseline, openings, done: 0 };
    drawXpPath();
    $("#xp-status").textContent =
      `${solution.nodesVisited.toLocaleString()} paths in ${Date.now() - started}ms fr` +
      (stopSearch ? " (stopped early lol)" : "");
  } catch (err) {
    xpView = null;
    renderError($("#xp-out"), err.message);
    $("#xp-status").textContent = "";
  } finally {
    $("#xp-search").disabled = false;
    $("#xp-stop").classList.add("is-hidden");
  }
}

// --- Find items -----------------------------------------------------------

let stopFind = false;

function findChestId() {
  return findChestIdState;
}

function targetsFor(cardId) {
  if (!findTargets.has(cardId)) findTargets.set(cardId, new Set());
  return findTargets.get(cardId);
}

function syncFindPanel() {
  const cardId = findChestId();
  if (!cardId) return;

  const selected = targetsFor(cardId);
  const items = getAvailableItemsForChest(cardId);

  renderItemPicker($("#find-items"), items, selected, (baseName) => {
    if (selected.has(baseName)) selected.delete(baseName);
    else selected.add(baseName);
    syncFindPanel();
  });

  $("#find-selected").textContent = selected.size ? `(${selected.size})` : "";
  $("#find-run").disabled = selected.size === 0;
  persist();

  const isAdventure = cardId.startsWith("adventure_");
  $("#find-maxlevel").closest("label").classList.toggle("is-hidden", !isAdventure);
  $("#find-maxdepth").closest("label").classList.toggle("is-hidden", !isAdventure);
  if (isAdventure && live[cardId]?.level) $("#find-maxlevel").value = live[cardId].level;
}

// Commit route steps to the live seed. Each step replays at the level the
// route chose, not the chest's current level, or the chain would diverge.
function drawXpPath() {
  if (!xpView) return;
  const { cardId, solution, baseline, openings, done } = xpView;
  renderXpPath($("#xp-out"), solution, baseline, openings,
    (steps) => openXpRoute(cardId, steps), done);
}

// Walk the XP path's boxes at the levels it picked, then persist the seed.
// The path stays on screen with the opened steps marked, because every later
// step was solved from the seed those opens produce, it is still valid.
function openXpRoute(cardId, steps) {
  const state = live[cardId];
  if (!state) return;

  const vaultPercentage = Number($("#xp-vault").value) || 0;

  for (const step of steps) {
    const [open] = predictChain(state.seed, cardId, 1, {
      level: step.level ?? state.level,
      vaultPercentage
    });
    state.history.unshift({ ...open, open: ++state.opened });
    state.seed = open.nextSeed;
  }

  if (xpView?.cardId === cardId) xpView.done += steps.length;
  refresh();          // persists the new seed
  drawXpPath();       // refresh() redraws the card, not the path
}

function openRoute(cardId, steps) {
  const state = live[cardId];
  if (!state) return;

  const vaultPercentage = Number($("#vault").value) || 0;
  const selected = targetsFor(cardId);

  for (const step of steps) {
    const [open] = predictChain(state.seed, cardId, 1, {
      level: step.level ?? state.level,
      vaultPercentage
    });
    state.history.unshift({ ...open, open: ++state.opened });
    state.seed = open.nextSeed;

    // Anything the route was hunting and just landed is no longer a target.
    for (const item of open.items) selected.delete(item.baseName);
  }

  refresh();          // persists the new seed
  syncFindPanel();

  if (selected.size > 0) {
    runFind();
  } else {
    $("#find-out").textContent = "";
    $("#find-out").append(
      Object.assign(document.createElement("p"), {
        className: "empty",
        textContent: "got all targets, seed saved, pick new items to hunt lol"
      })
    );
    $("#find-status").textContent = "";
  }
}

async function runFind() {
  const cardId = findChestId();
  const state = live[cardId];
  const targets = [...targetsFor(cardId)];
  const out = $("#find-out");

  if (!state) { renderError(out, "load a savegame first bro"); return; }
  if (targets.length === 0) { renderError(out, "pick at least one item lol"); return; }

  stopFind = false;
  $("#find-run").disabled = true;
  $("#find-stop").classList.remove("is-hidden");
  $("#find-status").textContent = "searching… lol";
  out.textContent = "";

  const started = Date.now();
  // Let the browser paint the searching state before the solver blocks.
  await new Promise((r) => setTimeout(r, 0));

  try {
    const vaultPercentage = Number($("#vault").value) || 0;
    const result = cardId.startsWith("adventure_")
      ? findAllPaths({
          startSeed: state.seed,
          targets,
          cardId,
          maxLevel: Number($("#find-maxlevel").value) || state.level || 1,
          vaultPercentage,
          maxDepth: Number($("#find-maxdepth").value) || 10,
          shouldStop: () => stopFind
        })
      : findItemLinear(state.seed, cardId, targets, {
          level: state.level, vaultPercentage
        });

    renderFindResult(out, result, targets, (steps) => openRoute(cardId, steps));
    $("#find-status").textContent =
      `${(result.nodesVisited ?? result.opens ?? 0).toLocaleString()} ` +
      `${cardId.startsWith("adventure_") ? "nodes" : "opens"} in ${Date.now() - started}ms fr` +
      (stopFind ? " (stopped early lol)" : "");
  } catch (err) {
    renderError(out, err.message);
    $("#find-status").textContent = "";
  } finally {
    $("#find-run").disabled = false;
    $("#find-stop").classList.add("is-hidden");
  }
}

// Category headers collapse their channel list, like a Discord category.
function initSidebarToggles() {
  for (const head of document.querySelectorAll(".channel-category-head")) {
    const list = head.nextElementSibling;
    head.addEventListener("click", () => {
      list.classList.toggle("is-hidden");
      head.firstElementChild.textContent = list.classList.contains("is-hidden") ? "▸" : "▾";
    });
  }
}

// The user bar's account popover: opens on click, closes on an outside
// click or Escape, same as Discord's own account menu.
function initUserMenu() {
  const menu = $("#user-menu");
  const trigger = $("#user-menu-trigger");

  const close = () => menu.classList.add("is-hidden");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("is-hidden");
  });
  menu.addEventListener("click", (e) => {
    // Let the load-savegame label and reset button do their thing, then close.
    if (e.target.closest("label, button")) close();
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== trigger) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function init() {
  initSidebarToggles();
  initUserMenu();

  $("#save").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      adoptSave(await readSave(file), file.name);
    } catch (err) {
      renderError($("#out"), err.message);
    }
  });

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

  // Live-updates the Upcoming preview as you type a level to check.
  $("#preview-level").addEventListener("input", refresh);

  $("#reset").addEventListener("click", resetChest);
  $("#unload").addEventListener("click", unloadSave);

  // Write back to #vault so the Upcoming preview and the search never
  // disagree about the vault rate; refresh() mirrors it back and persists.
  $("#xp-vault").addEventListener("change", () => {
    $("#vault").value = $("#xp-vault").value;
    refresh();
  });

  $("#xp-openings").addEventListener("input", syncXpEstimate);
  $("#xp-maxlevel").addEventListener("input", syncXpEstimate);
  $("#find-run").addEventListener("click", runFind);
  $("#find-stop").addEventListener("click", () => {
    stopFind = true;
    $("#find-status").textContent = "stopping… bruh";
  });

  $("#xp-search").addEventListener("click", runXpSearch);
  $("#xp-stop").addEventListener("click", () => {
    stopSearch = true;
    $("#xp-status").textContent = "stopping… bruh";
  });

  restore();
}

init();

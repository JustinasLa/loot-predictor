import { parseSavegame } from "./save/parse.js";
import { predictChain } from "./loot/simulate.js";
import * as storage from "./storage.js";
import { findOptimalXpPath } from "./solver/xp-path.js";
import { DOMINANT_ADVENTURE_LEVELS } from "./loot/tables.js";
import { simulateAdventureChestOpening } from "./loot/simulate.js";
import { getItemXp } from "./loot/xp.js";
import { findAllPathsAsync, findItemLinearAsync } from "./solver/find-items.js";
import { getAvailableItemsForChest } from "./loot/items.js";
import { validateInteger, validateSeed, validateLevel, validateVaultPercentage } from "./validation.js";
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
let xpLevelChestId = null;
let findLevelChestId = null;
let xpRun = null;
let findRun = null;
let xpView = null;
let findView = null;
let saveLoadToken = 0;

const $ = (sel) => document.querySelector(sel);

function numberField(selector, validate, fallback) {
  const field = $(selector);
  const label = field.labels[0].textContent.trim();
  if (field.validity.badInput) throw new Error("enter a valid number for " + label);
  const value = field.value.trim();
  if (value === "" && fallback !== undefined) return fallback;
  if (value === "") throw new Error("enter a value for " + label);
  return validate(Number(value));
}

const positiveInteger = (value) => validateInteger(value, "openings", 1);
const vaultValue = () => numberField("#vault", validateVaultPercentage, 0);

function syncSearchControls() {
  $("#xp-search").disabled = !!xpRun || !currentId()?.startsWith("adventure_");
  $("#xp-stop").classList.toggle("is-hidden", !xpRun);
  const cardId = findChestId();
  $("#find-run").disabled = !!findRun || !live[cardId] || targetsFor(cardId).size === 0;
  $("#find-stop").classList.toggle("is-hidden", !findRun);
}

function invalidateXp() {
  xpRun = null;
  xpView = null;
  $("#xp-out").textContent = "";
  $("#xp-status").textContent = "";
  syncSearchControls();
}

function invalidateFind() {
  findRun = null;
  findView = null;
  $("#find-out").textContent = "";
  $("#find-status").textContent = "";
  syncSearchControls();
}

function invalidateChest(cardId, keepXp = false) {
  if (!keepXp && (xpRun?.cardId === cardId || xpView?.cardId === cardId)) invalidateXp();
  if (findRun?.cardId === cardId || findView?.cardId === cardId) invalidateFind();
}

function xpOptions() {
  const state = currentState();
  return {
    openings: numberField("#xp-openings", positiveInteger, 4),
    maxLevel: numberField("#xp-maxlevel", validateLevel, state.level ?? 1),
    vaultPercentage: numberField("#xp-vault", validateVaultPercentage, 0),
    maxOpens: numberField("#xp-maxopens", positiveInteger, Infinity)
  };
}

function findOptions(cardId) {
  return {
    vaultPercentage: vaultValue(),
    ...(cardId?.startsWith("adventure_") ? {
      maxLevel: numberField("#find-maxlevel", validateLevel, live[cardId].level ?? 1),
      maxDepth: numberField("#find-maxdepth", positiveInteger, 10)
    } : {})
  };
}

function contextMatches(context, kind) {
  try {
    const options = kind === "xp" ? xpOptions() : findOptions(context.cardId);
    if (JSON.stringify(options) !== context.optionsKey || vaultValue() !== context.vaultPercentage) return false;
    return kind === "xp" || JSON.stringify([...targetsFor(context.cardId)]) === context.targetsKey;
  } catch {
    return false;
  }
}

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
  if (predictChestId !== id) invalidateXp();
  predictChestId = id;
  showTab("predict");
  renderSidebars();
  refresh();
}

function selectFindChest(id) {
  if (findChestIdState !== id) invalidateFind();
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
  const level = isAdventure ? numberField("#preview-level", validateLevel, state.level ?? 1) : state.level;
  return {
    level,
    vaultPercentage: vaultValue()
  };
}

function persist() {
  let count = "5";
  let vault = "0";
  try { count = String(numberField("#count", (value) => validateInteger(value, "preview count", 1, 200), 5)); } catch { /* keep a valid preference while an input is being edited */ }
  try { vault = String(vaultValue()); } catch { /* keep a valid preference while an input is being edited */ }
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
      count,
      vault,
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
  validateInteger(times, "open count", 1, 10000);
  const cardId = currentId();
  const state = currentState();
  const opts = chainOpts(state);
  invalidateChest(cardId);

  for (let i = 0; i < times; i++) {
    const [open] = predictChain(state.seed, cardId, 1, opts);
    state.history.unshift({ ...open, open: ++state.opened });
    state.seed = open.nextSeed;
  }
  state.history.length = Math.min(state.history.length, storage.MAX_HISTORY);

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
  invalidateChest(currentId());
  const state = currentState();
  state.seed = saved[currentId()].initialSeed;
  state.opened = 0;
  state.history = [];
  refresh();
}

// Redraw everything that depends on the live seed, then checkpoint.
function refresh() {
  const out = $("#out");
  let state;
  try {
    const cardId = currentId();
    state = currentState();

    $("#seed").value = state.seed;
    $("#history-count").textContent = state.opened ? `(${state.opened})` : "";
    $("#open-status").textContent = state.opened
      ? `${state.opened} open(s) ahead of the savegame fr`
      : "at savegame seed lol";

    syncPreviewLevelField(cardId, state);
    renderHistory($("#history"), cardId, state.history);
    syncSmartXp();
    const seed = state.seed;
    const options = chainOpts(state);
    renderResults(
      out, cardId,
      predictChain(seed, cardId, numberField("#count", (value) => validateInteger(value, "preview count", 1, 200), 5), options),
      (times) => {
        if (currentId() !== cardId || live[cardId] !== state || state.seed !== seed) return;
        try {
          if (JSON.stringify(chainOpts(state)) !== JSON.stringify(options)) return;
          openChest(times);
        } catch (err) { renderError(out, err.message); }
      }
    );
  } catch (err) {
    renderError(out, err.message);
  } finally {
    if (state) persist();
  }
}

function adoptSave(parsed, filename) {
  invalidateXp();
  invalidateFind();
  saved = parsed;
  savegameFilename = filename;
  previewLevelChestId = null;
  xpLevelChestId = null;
  findLevelChestId = null;
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
  const firstId = Object.keys(saved)[0];
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
  let options;
  try {
    options = xpOptions();
  } catch (err) {
    $("#xp-estimate").textContent = err.message;
    $("#xp-estimate").dataset.heavy = "no";
    return;
  }
  const { openings, maxLevel } = options;
  const branches = branchCount(maxLevel);
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

  syncSearchControls();
  const previousChestId = xpLevelChestId;
  xpLevelChestId = cardId;
  if (!isAdventure) return;

  const state = live[cardId];
  if (previousChestId !== cardId) $("#xp-maxlevel").value = state.level ?? 1;
  // One vault rate for the whole app; this field is a second view of #vault.
  $("#xp-vault").value = $("#vault").value;
  syncXpEstimate();
}

async function runXpSearch() {
  if (xpRun) return;
  let run;
  try {
    const cardId = currentId();
    const state = currentState();
    if (!cardId.startsWith("adventure_")) throw new Error("choose an adventure chest");
    const options = xpOptions();
    const { openings, maxLevel, vaultPercentage, maxOpens } = options;
    if (vaultPercentage !== vaultValue()) throw new Error("vault percentages must match");
    run = { cardId, state, seed: state.seed, vaultPercentage, optionsKey: JSON.stringify(options), stopped: false };
    invalidateXp();
    xpRun = run;
    syncSearchControls();
    $("#xp-status").textContent = "searching… lol";
    const started = Date.now();
    const eventType = cardId.slice("adventure_".length);
    const solution = await findOptimalXpPath({
      startSeed: run.seed,
      eventType,
      cardId,
      maxLevel,
      vaultPercentage,
      openings,
      maxOpens,
      onProgress: (depth) => {
        if (xpRun === run && contextMatches(run, "xp")) $("#xp-status").textContent = `searching… depth ${depth}`;
      },
      shouldStop: () => run.stopped || xpRun !== run || !contextMatches(run, "xp")
    });
    if (xpRun !== run || !contextMatches(run, "xp")) return;

    // Bound the baseline by the path the solver actually found, so an
    // uncapped run can't spin here forever on refunded keys.
    const baseline = naiveXp(
      run.seed, cardId, eventType, maxLevel, vaultPercentage, openings,
      Math.min(maxOpens, solution.path.length)
    );
    xpView = { ...run, solution, baseline, openings, done: 0 };
    drawXpPath();
    $("#xp-status").textContent =
      `${solution.nodesVisited.toLocaleString()} paths in ${Date.now() - started}ms fr` +
      (run.stopped ? " (stopped early lol)" : "");
  } catch (err) {
    if (run && (xpRun !== run || !contextMatches(run, "xp"))) return;
    xpView = null;
    renderError($("#xp-out"), err.message);
    $("#xp-status").textContent = "";
  } finally {
    if (xpRun === run) xpRun = null;
    syncSearchControls();
  }
}

// --- Find items -----------------------------------------------------------

function findChestId() {
  return findChestIdState;
}

function targetsFor(cardId) {
  if (!findTargets.has(cardId)) findTargets.set(cardId, new Set());
  return findTargets.get(cardId);
}

function syncFindPanel() {
  const cardId = findChestId();

  const selected = targetsFor(cardId);
  const items = getAvailableItemsForChest(cardId);

  renderItemPicker($("#find-items"), items, selected, (baseName) => {
    invalidateFind();
    if (selected.has(baseName)) selected.delete(baseName);
    else selected.add(baseName);
    syncFindPanel();
  });

  $("#find-selected").textContent = selected.size ? `(${selected.size})` : "";
  syncSearchControls();
  persist();

  const isAdventure = cardId.startsWith("adventure_");
  $("#find-maxlevel").closest("label").classList.toggle("is-hidden", !isAdventure);
  $("#find-maxdepth").closest("label").classList.toggle("is-hidden", !isAdventure);
  if (isAdventure && findLevelChestId !== cardId) $("#find-maxlevel").value = live[cardId].level ?? 1;
  findLevelChestId = cardId;
}

// Commit route steps to the live seed. Each step replays at the level the
// route chose, not the chest's current level, or the chain would diverge.
function drawXpPath() {
  const view = xpView;
  const { solution, baseline, openings, done } = view;
  renderXpPath($("#xp-out"), solution, baseline, openings,
    (steps) => { if (view.done === done) openXpRoute(view, steps); }, done);
}

// Validate the whole batch before changing any live state. Detached buttons
// and searches solved for an older seed must never consume current chests.
function replayRoute(view, steps) {
  let seed = view.state.seed;
  return steps.map((step) => {
    if ((step.usedSeed ?? step.seed) !== seed) throw new Error("route is out of date; search again");
    const [open] = predictChain(seed, view.cardId, 1, {
      level: step.level ?? view.state.level ?? 1,
      vaultPercentage: view.vaultPercentage
    });
    if (step.nextSeed !== undefined && step.nextSeed !== open.nextSeed) throw new Error("route is out of date; search again");
    seed = open.nextSeed;
    return open;
  });
}

function commitOpenings(state, openings) {
  for (const open of openings) {
    state.history.unshift({ ...open, open: ++state.opened });
    state.seed = open.nextSeed;
  }
  state.history.length = Math.min(state.history.length, storage.MAX_HISTORY);
}

// Walk the XP path's boxes at the levels it picked, then persist the seed.
// The path stays on screen with the opened steps marked, because every later
// step was solved from the seed those opens produce, it is still valid.
function openXpRoute(view, steps) {
  if (xpView !== view || steps.length === 0) return;
  try {
    if (!contextMatches(view, "xp") || steps.some((step, i) => step !== view.solution.path[view.done + i])) {
      throw new Error("route is out of date; search again");
    }
    const openings = replayRoute(view, steps);
    invalidateChest(view.cardId, true);
    commitOpenings(view.state, openings);
    view.done += steps.length;
    view.seed = view.state.seed;
    refresh();
    drawXpPath();
  } catch (err) {
    invalidateXp();
    renderError($("#xp-out"), err.message);
  }
}

function openRoute(view, steps) {
  if (findView !== view || steps.length === 0) return;
  try {
    const result = view.result;
    const paths = result.path ? [result.path] : [result.shortest.path, result.cheapest.path];
    if (!contextMatches(view, "find") || !paths.some((path) => steps.every((step, i) => step === path[i]))) {
      throw new Error("route is out of date; search again");
    }
    const openings = replayRoute(view, steps);
    const selected = targetsFor(view.cardId);
    invalidateChest(view.cardId);
    commitOpenings(view.state, openings);
    for (const open of openings) for (const item of open.items) selected.delete(item.baseName);
    refresh();
    syncFindPanel();
    if (selected.size > 0) {
      runFind();
    } else {
      $("#find-out").append(Object.assign(document.createElement("p"), {
        className: "empty",
        textContent: "got all targets, seed saved, pick new items to hunt lol"
      }));
    }
  } catch (err) {
    invalidateFind();
    renderError($("#find-out"), err.message);
  }
}

async function runFind() {
  if (findRun) return;
  const out = $("#find-out");
  let run;
  try {
    const cardId = findChestId();
    const state = live[cardId];
    const targets = [...targetsFor(cardId)];
    if (!state) throw new Error("load a savegame first bro");
    if (targets.length === 0) throw new Error("pick at least one item lol");
    const options = findOptions(cardId);
    run = { cardId, state, seed: state.seed, vaultPercentage: options.vaultPercentage, optionsKey: JSON.stringify(options), targetsKey: JSON.stringify(targets), stopped: false };
    invalidateFind();
    findRun = run;
    syncSearchControls();
    $("#find-status").textContent = "searching… lol";
    const started = Date.now();
    const controls = {
      shouldStop: () => run.stopped || findRun !== run || !contextMatches(run, "find"),
      onProgress: (nodes) => {
        if (findRun === run && contextMatches(run, "find")) $("#find-status").textContent = `searching… ${nodes.toLocaleString()} nodes`;
      }
    };
    const result = cardId.startsWith("adventure_")
      ? await findAllPathsAsync({
          startSeed: run.seed,
          targets,
          cardId,
          ...options,
          ...controls
        })
      : await findItemLinearAsync(run.seed, cardId, targets, {
          level: state.level, ...options, ...controls
        });
    if (findRun !== run || !contextMatches(run, "find")) return;
    const view = { ...run, result };
    findView = view;
    renderFindResult(out, result, targets, (steps) => openRoute(view, steps));
    $("#find-status").textContent =
      `${(result.nodesVisited ?? result.opens ?? 0).toLocaleString()} ` +
      `${cardId.startsWith("adventure_") ? "nodes" : "opens"} in ${Date.now() - started}ms fr` +
      (run.stopped || result.stopped ? " (stopped early lol)" : "") +
      (result.truncated ? " (search limit reached)" : "");
  } catch (err) {
    if (run && (findRun !== run || !contextMatches(run, "find"))) return;
    renderError(out, err.message);
    $("#find-status").textContent = "";
  } finally {
    if (findRun === run) findRun = null;
    syncSearchControls();
  }
}

// Category headers collapse their channel list, like a Discord category.
function initSidebarToggles() {
  for (const head of document.querySelectorAll(".channel-category-head")) {
    const list = head.nextElementSibling;
    head.addEventListener("click", () => {
      list.classList.toggle("is-hidden");
      head.setAttribute("aria-expanded", String(!list.classList.contains("is-hidden")));
      head.firstElementChild.textContent = list.classList.contains("is-hidden") ? "▸" : "▾";
    });
  }
}

// The user bar's account popover: opens on click, closes on an outside
// click or Escape, same as Discord's own account menu.
function initUserMenu() {
  const menu = $("#user-menu");
  const trigger = $("#user-menu-trigger");

  const close = () => {
    const restoreFocus = menu.contains(document.activeElement);
    menu.classList.add("is-hidden");
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("is-hidden");
    trigger.setAttribute("aria-expanded", String(!menu.classList.contains("is-hidden")));
  });
  menu.addEventListener("click", (e) => {
    // Let the menu action finish, then close.
    if (e.target.closest("button")) close();
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
  for (const id of ["#load-save", "#load-save-menu"]) {
    $(id)?.addEventListener("click", () => $("#save").click());
  }

  const predictAction = (action) => {
    try { action(); }
    catch (err) { renderError($("#out"), err.message); }
  };

  $("#save").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const token = ++saveLoadToken;
    try {
      const parsed = await readSave(file);
      if (token === saveLoadToken) adoptSave(parsed, file.name);
    } catch (err) {
      if (token === saveLoadToken) renderError($("#out"), err.message);
    }
  });

  $("#count").addEventListener("change", refresh);
  $("#vault").addEventListener("change", () => {
    invalidateXp();
    invalidateFind();
    predictAction(() => {
      const value = numberField("#vault", validateVaultPercentage, 0);
      $("#xp-vault").value = String(value);
      refresh();
    });
  });

  // Editing the seed by hand replaces the live seed but keeps the history,
  // so you can jump to an arbitrary seed without reloading a savegame.
  $("#seed").addEventListener("change", () => {
    predictAction(() => {
      const state = currentState();
      let value;
      try { value = numberField("#seed", validateSeed); }
      catch (err) { $("#seed").value = state.seed; throw err; }
      invalidateChest(currentId());
      state.seed = value;
      refresh();
    });
  });

  for (const btn of document.querySelectorAll(".open-btn")) {
    btn.addEventListener("click", () => predictAction(() => openChest(Number(btn.dataset.open))));
  }

  $("#open-custom-go").addEventListener("click", () => {
    predictAction(() => {
      const times = numberField("#open-custom", positiveInteger);
      // Each open is three-plus draws; keep the click from locking up the tab.
      openChest(Math.min(times, 10000));
    });
  });

  // Live-updates the Upcoming preview as you type a level to check.
  $("#preview-level").addEventListener("input", refresh);

  $("#reset").addEventListener("click", () => predictAction(resetChest));
  $("#unload").addEventListener("click", unloadSave);

  // Write back to #vault so the Upcoming preview and the search never
  // disagree about the vault rate; refresh() mirrors it back and persists.
  $("#xp-vault").addEventListener("change", () => {
    invalidateXp();
    invalidateFind();
    predictAction(() => {
      const value = numberField("#xp-vault", validateVaultPercentage, 0);
      $("#vault").value = String(value);
      refresh();
    });
  });

  for (const id of ["#xp-openings", "#xp-maxlevel", "#xp-maxopens"]) {
    const change = () => { invalidateXp(); syncXpEstimate(); };
    $(id).addEventListener("input", change);
    $(id).addEventListener("change", change);
  }
  for (const id of ["#find-maxlevel", "#find-maxdepth"]) {
    $(id).addEventListener("input", invalidateFind);
    $(id).addEventListener("change", invalidateFind);
  }
  $("#find-run").addEventListener("click", runFind);
  $("#find-stop").addEventListener("click", () => {
    if (!findRun) return;
    findRun.stopped = true;
    $("#find-status").textContent = "stopping… bruh";
  });

  $("#xp-search").addEventListener("click", runXpSearch);
  $("#xp-stop").addEventListener("click", () => {
    if (!xpRun) return;
    xpRun.stopped = true;
    $("#xp-status").textContent = "stopping… bruh";
  });

  restore();
}

init();

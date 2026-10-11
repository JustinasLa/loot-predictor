// Find tab: pick items, search a route, open along it.
import { findAllPathsAsync, findItemLinearAsync } from "../solver/find-items.js";
import { getAvailableItemsForChest } from "../loot/items.js";
import { validateLevel } from "../validation.js";
import { renderItemPicker, renderFindResult, renderError } from "../ui/render.js";
import { bindChipsToSelect } from "../ui/components/chips.js";
import { state, currentId, isAdventure, targetsFor } from "./state.js";
import { $, numberField, positiveInteger, vaultValue } from "./dom.js";
import { contextMatches, invalidateChest, replayRoute, commitOpenings, syncSearchControls, SETTINGS_CHANGED } from "./routes.js";
import { refresh } from "./predict.js";
import { persist } from "./session.js";

// Set by initFind, which always runs before any filter reset.
let syncChips;

export function findOptions(cardId) {
  return {
    vaultPercentage: vaultValue(),
    ...(isAdventure(cardId) ? {
      maxLevel: numberField("#find-maxlevel", validateLevel, state.live[cardId].level ?? 1),
      maxDepth: numberField("#find-maxdepth", positiveInteger, 10)
    } : {})
  };
}

export function syncFindControls() {
  const cardId = currentId();
  $("#find-run").disabled = !!state.findRun || !state.live[cardId] || targetsFor(cardId).size === 0;
  $("#find-stop").classList.toggle("is-hidden", !state.findRun);
}

function showFindGuidance() {
  const selected = targetsFor(currentId());
  const note = document.createElement("p");
  note.className = "empty find-guidance";
  note.textContent = selected.size ? "Tap Find it!" : "Tap the items you want.";
  $("#find-out").replaceChildren(note);
}

export function invalidateFind() {
  state.findRun = null;
  state.findView = null;
  showFindGuidance();
  $("#find-status").textContent = "";
  syncSearchControls();
}

export function resetItemFilters() {
  $("#item-search").value = "";
  $("#rarity-filter").value = "all";
  syncChips();
}

export function syncFindPanel() {
  const cardId = currentId();
  if (!state.live[cardId]) return;

  const selected = targetsFor(cardId);
  const items = getAvailableItemsForChest(cardId);

  renderItemPicker($("#find-items"), items, selected, (baseName) => {
    invalidateFind();
    if (selected.has(baseName)) selected.delete(baseName);
    else selected.add(baseName);
    syncFindPanel();
  }, { query: $("#item-search").value, rarity: $("#rarity-filter").value });

  $("#find-selected").textContent = selected.size ? `${selected.size} picked` : "";
  if (!state.findRun && !state.findView) showFindGuidance();
  syncSearchControls();
  persist();

  const adventure = isAdventure(cardId);
  $("#find-maxlevel").closest(".find-search-options").classList.toggle("is-hidden", !adventure);
  $("#find-maxlevel").closest("label").classList.toggle("is-hidden", !adventure);
  $("#find-maxdepth").closest("label").classList.toggle("is-hidden", !adventure);
  if (adventure && state.findLevelChestId !== cardId) $("#find-maxlevel").value = state.live[cardId].level ?? 1;
  state.findLevelChestId = cardId;
}

function openRoute(view, steps) {
  if (state.findView !== view || steps.length === 0) return;
  try {
    const result = view.result;
    const paths = result.path ? [result.path] : [result.shortest.path, result.cheapest.path];
    if (!contextMatches(view, "find") || !paths.some((path) => steps.every((step, i) => step === path[i]))) {
      throw new Error(SETTINGS_CHANGED);
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
      $("#find-out").replaceChildren(Object.assign(document.createElement("p"), {
        className: "banner banner--go find-done",
        textContent: "All found!"
      }));
    }
  } catch (err) {
    invalidateFind();
    renderError($("#find-out"), err.message);
  }
}

export async function runFind() {
  if (state.findRun) return;
  const out = $("#find-out");
  let run;
  try {
    const cardId = currentId();
    const boxState = state.live[cardId];
    const targets = [...targetsFor(cardId)];
    if (!boxState) throw new Error("Load a save file or try the demo first.");
    if (targets.length === 0) throw new Error("Choose at least one item to find.");
    const options = findOptions(cardId);
    run = { cardId, state: boxState, seed: boxState.seed, vaultPercentage: options.vaultPercentage, optionsKey: JSON.stringify(options), targetsKey: JSON.stringify(targets), stopped: false };
    invalidateFind();
    state.findRun = run;
    syncSearchControls();
    out.textContent = "";
    $("#find-status").textContent = "Looking…";
    const started = Date.now();
    const controls = {
      shouldStop: () => run.stopped || state.findRun !== run || !contextMatches(run, "find"),
      onProgress: (nodes) => {
        if (state.findRun === run && contextMatches(run, "find")) $("#find-status").textContent = `Looking… · ${nodes.toLocaleString()} checked.`;
      }
    };
    const result = isAdventure(cardId)
      ? await findAllPathsAsync({ startSeed: run.seed, targets, cardId, ...options, ...controls })
      : await findItemLinearAsync(run.seed, cardId, targets, { level: boxState.level, ...options, ...controls });
    if (state.findRun !== run || !contextMatches(run, "find")) return;
    const view = { ...run, result };
    state.findView = view;
    renderFindResult(out, result, targets, (steps) => openRoute(view, steps), cardId);
    $("#find-status").textContent =
      `${(result.nodesVisited ?? result.opens ?? 0).toLocaleString()} ` +
      `possibilities checked in ${((Date.now() - started) / 1000).toFixed(1)} seconds.` +
      (run.stopped || result.stopped ? " Search stopped early." : "") +
      (result.truncated ? " Search limit reached." : "");
  } catch (err) {
    if (run && (state.findRun !== run || !contextMatches(run, "find"))) return;
    renderError(out, err.message);
    $("#find-status").textContent = "";
  } finally {
    if (state.findRun === run) state.findRun = null;
    syncSearchControls();
  }
}

export function initFind() {
  syncChips = bindChipsToSelect($("#rarity-chips"), $("#rarity-filter"));
  $("#item-search").addEventListener("input", syncFindPanel);
  $("#rarity-filter").addEventListener("change", syncFindPanel);
  for (const id of ["#find-maxlevel", "#find-maxdepth"]) {
    $(id).addEventListener("input", invalidateFind);
    $(id).addEventListener("change", invalidateFind);
  }
  $("#find-run").addEventListener("click", runFind);
  $("#find-stop").addEventListener("click", () => {
    if (!state.findRun) return;
    state.findRun.stopped = true;
    $("#find-status").textContent = "Stopping…";
  });
}

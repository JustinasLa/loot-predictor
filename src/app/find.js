// Find tab: pick item pictures, search a route, open along it.
import { findAllPathsAsync, findItemLinearAsync } from "../solver/find-items.js";
import { getAvailableItemsForChest } from "../loot/items.js";
import { validateLevel } from "../validation.js";
import { renderItemPicker, renderFindResult, renderError } from "../ui/render.js";
import { itemSprites } from "../ui/render/item-picker.js";
import { getItemPresentation } from "../ui/presentation.js";
import { bindChipsToSelect } from "../ui/components/chips.js";
import { state, currentId, isAdventure, targetsFor } from "./state.js";
import { $, $$, numberField, positiveInteger, vaultValue, reveal } from "./dom.js";
import { contextMatches, invalidateChest, replayRoute, commitOpenings, syncSearchControls, SETTINGS_CHANGED } from "./routes.js";
import { refresh } from "./predict.js";
import { persist } from "./session.js";

// Set by initFind, which always runs before any filter reset.
let syncChips;
// "Change items" reopens the picker while a search or result is showing.
let pickerOpen = false;
const MAX_STACK = 4;

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
  const running = !!state.findRun;
  const picked = state.live[cardId] ? targetsFor(cardId).size : 0;
  const run = $("#find-run");
  run.disabled = running || picked === 0;
  run.textContent = picked === 0 ? "Pick an item" : "Find it!";
  run.classList.toggle("is-hidden", running);
  $("#find-stop").classList.toggle("is-hidden", !running);
  $("#find-status").classList.toggle("is-busy", running);
  const busy = running || !!state.findView;
  const panel = $("#panel-find");
  panel.classList.toggle("is-collapsed", busy && !pickerOpen);
  panel.classList.toggle("has-result", !running && !!state.findView && !pickerOpen);
}

function openPicker() {
  pickerOpen = true;
  syncFindControls();
  $("#find-heading").focus();
}

function action(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn ${className}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

/** Follow-up buttons live outside #find-out, which holds one button per step. */
function showActions(kind, depth) {
  const field = $("#find-maxdepth");
  const max = Number(field.max);
  const buttons = [];
  if (kind === "missing" && depth < max) {
    buttons.push(action("Look further", "btn--primary", () => {
      field.value = String(Math.min(max, depth * 2));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      runFind();
    }));
  }
  if (kind === "stopped") buttons.push(action("Try again", "btn--primary", runFind));
  if (kind === "missing" || kind === "limit") buttons.push(action("Pick fewer items", "btn--ghost", openPicker));
  if (kind === "done") buttons.push(action("Pick more", "btn--primary", openPicker));
  $("#find-actions").replaceChildren(...buttons);
}

export function invalidateFind() {
  state.findRun = null;
  state.findView = null;
  $("#find-out").replaceChildren();
  $("#find-status").textContent = "";
  $("#find-actions").replaceChildren();
  syncSearchControls();
}

export function resetItemFilters() {
  $("#item-search").value = "";
  $("#rarity-filter").value = "all";
  syncChips();
}

/** One item per picked base name, with its rarity for the colour. */
function pickedItems(items, selected) {
  const byName = new Map();
  for (const item of items) if (selected.has(item.baseName) && !byName.has(item.baseName)) byName.set(item.baseName, item);
  return [...selected].map((name) => byName.get(name) ?? name);
}

/**
 * Only offers rarity chips that this box can drop. A box with a single
 * rarity (every egg) has nothing to filter, so the row goes away.
 */
function syncRarityChips(items) {
  const present = new Set(items.flatMap((item) => item.rarities).map((rarity) => rarity.toLowerCase()));
  let shown = 0;
  for (const chip of $$("#rarity-chips .chip[data-rarity]")) {
    const has = present.has(chip.dataset.value);
    chip.classList.toggle("is-hidden", !has);
    if (has) shown++;
  }
  $("#rarity-chips").classList.toggle("is-hidden", shown < 2);
}

export function syncFindPanel() {
  const cardId = currentId();
  if (!state.live[cardId]) return;

  const selected = targetsFor(cardId);
  const items = getAvailableItemsForChest(cardId);
  syncRarityChips(items);

  const visible = renderItemPicker($("#find-items"), items, selected, (baseName) => {
    invalidateFind();
    if (selected.has(baseName)) selected.delete(baseName);
    else selected.add(baseName);
    syncFindPanel();
    persist();
  }, { query: $("#item-search").value, rarity: $("#rarity-filter").value });
  $("#find-no-match").classList.toggle("is-hidden", items.length === 0 || visible > 0);

  const picked = pickedItems(items, selected);
  $("#find-selected").textContent = selected.size ? `${selected.size} picked` : "";
  $("#find-stack").replaceChildren(itemSprites(picked.slice(0, MAX_STACK)));
  $("#find-picked-art").replaceChildren(itemSprites(picked));
  // The sprites are silent; say what was picked in words.
  $("#find-picked-names").textContent = picked.length
    ? `Picked: ${picked.map((item) => getItemPresentation(item).name).join(", ")}`
    : "";
  syncSearchControls();

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
      const done = document.createElement("div");
      done.className = "banner banner--go find-done";
      done.append(Object.assign(document.createElement("p"), { className: "find-banner-text display-text", textContent: "All found!" }));
      $("#find-out").replaceChildren(done);
      showActions("done");
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
    pickerOpen = false;
    state.findRun = run;
    syncSearchControls();
    out.textContent = "";
    $("#find-status").textContent = "Looking…";
    const controls = {
      shouldStop: () => run.stopped || state.findRun !== run || !contextMatches(run, "find"),
      onProgress: (nodes) => {
        if (state.findRun === run && contextMatches(run, "find")) $("#find-status").textContent = `Looking… · ${nodes.toLocaleString()} checked`;
      }
    };
    const solved = isAdventure(cardId)
      ? await findAllPathsAsync({ startSeed: run.seed, targets, cardId, ...options, ...controls })
      : await findItemLinearAsync(run.seed, cardId, targets, { level: boxState.level, ...options, ...controls });
    if (state.findRun !== run || !contextMatches(run, "find")) return;
    // A Stop that lands after the last node still counts as stopped early.
    const result = run.stopped && !solved.stopped ? { ...solved, stopped: true } : solved;
    const view = { ...run, result };
    state.findView = view;
    const kind = renderFindResult(out, result, pickedItems(getAvailableItemsForChest(cardId), new Set(targets)),
      (steps) => openRoute(view, steps), cardId);
    showActions(kind, options.maxDepth);
    // The banner says what happened (found, stopped, limit); the count goes.
    $("#find-status").textContent = "";
    reveal(out);
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
  $("#find-show-all").addEventListener("click", () => {
    resetItemFilters();
    syncFindPanel();
  });
  $("#find-change").addEventListener("click", openPicker);
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

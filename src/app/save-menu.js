// Save menu sheet: load another save, reset this box, remove the save.
// Reset and Remove each ask first: the menu buttons swap for a one-line
// confirm row whose confirm button carries the real #reset / #unload id.
import * as storage from "../storage.js";
import { toggleSheet } from "../ui/components/sheet.js";
import { showToast } from "../ui/components/toast.js";
import { state, currentId } from "./state.js";
import { $ } from "./dom.js";
import { invalidateChest } from "./routes.js";
import { predictAction, refresh } from "./predict.js";
import { syncFindPanel } from "./find.js";

export function resetChest() {
  const cardId = currentId();
  const boxState = state.live[cardId];
  if (!boxState) throw new Error("Load a save file or try the demo first.");
  invalidateChest(cardId);
  boxState.seed = state.saved[cardId].initialSeed;
  boxState.opened = 0;
  boxState.history = [];
  refresh();
  syncFindPanel();
  showToast("Box reset.");
}

// Wipes the persisted state and reloads: the simplest way back to a clean
// Start screen, since everything else derives from a fresh load.
function unloadSave() {
  storage.clear();
  location.reload();
}

const CONFIRMS = { reset: "#reset-confirm", unload: "#unload-confirm" };

/** Shows the menu buttons, or the confirm row for `step` ("reset" | "unload"). */
export function showSaveStep(step = null) {
  $("#save-menu-actions").classList.toggle("is-hidden", step !== null);
  for (const [name, selector] of Object.entries(CONFIRMS)) {
    $(selector).classList.toggle("is-hidden", name !== step);
    $(`#${name}-ask`).setAttribute("aria-expanded", String(name === step));
  }
  if (step) $(`#${step}-cancel`).focus();
}

function cancel(step) {
  showSaveStep();
  $(`#${step}-ask`).focus();
}

export function initSaveMenu() {
  const trigger = $("#user-menu-trigger");
  trigger.addEventListener("click", () => {
    showSaveStep();
    toggleSheet("user-menu", trigger);
  });
  for (const step of Object.keys(CONFIRMS)) {
    $(`#${step}-ask`).addEventListener("click", () => showSaveStep(step));
    $(`#${step}-cancel`).addEventListener("click", () => cancel(step));
  }
  $("#reset").addEventListener("click", () => predictAction(resetChest));
  $("#unload").addEventListener("click", unloadSave);
}

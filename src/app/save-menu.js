// Save menu sheet: load another save, reset this box, remove the save.
import * as storage from "../storage.js";
import { toggleSheet } from "../ui/components/sheet.js";
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
}

// Wipes the persisted state and reloads: the simplest way back to a clean
// Start screen, since everything else derives from a fresh load.
function unloadSave() {
  storage.clear();
  location.reload();
}

export function initSaveMenu() {
  const trigger = $("#user-menu-trigger");
  trigger.addEventListener("click", () => toggleSheet("user-menu", trigger));
  $("#reset").addEventListener("click", () => predictAction(resetChest));
  $("#unload").addEventListener("click", unloadSave);
}

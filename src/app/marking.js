// "I opened it!" marking, the Opened history and the mark-many settings.
import { predictChain } from "../loot/simulate.js";
import { validateInteger } from "../validation.js";
import * as storage from "../storage.js";
import { renderHistory } from "../ui/render.js";
import { showToast } from "../ui/components/toast.js";
import { closeSheet } from "../ui/components/sheet.js";
import { getChestPresentation } from "../ui/presentation.js";
import { state, currentId, currentState } from "./state.js";
import { $, $$, numberField, positiveInteger } from "./dom.js";
import { invalidateChest } from "./routes.js";
import { chainOpts, predictAction, refresh } from "./predict.js";

// Advance the live seed by `times` opens, recording what each one produced.
// Adventure boxes open at whatever level the level field shows.
export function openChest(times) {
  validateInteger(times, "open count", 1, 10000);
  const cardId = currentId();
  const boxState = currentState();
  const opts = chainOpts(boxState);
  const before = { seed: boxState.seed, opened: boxState.opened, history: boxState.history.slice() };
  invalidateChest(cardId);

  for (let i = 0; i < times; i++) {
    const [open] = predictChain(boxState.seed, cardId, 1, opts);
    boxState.history.unshift({ ...open, open: ++boxState.opened });
    boxState.seed = open.nextSeed;
  }
  boxState.history.length = Math.min(boxState.history.length, storage.MAX_HISTORY);

  refresh();
  const after = boxState.seed;
  showToast(`Marked ${times} opened`, document, {
    art: getChestPresentation(cardId).image,
    action: { label: "Undo", onClick: () => undoOpen(cardId, boxState, before, after) },
  });
}

/**
 * Puts a box back to how it was before the last mark, unless something else
 * (another mark, a seed edit, a reset) has moved it on since.
 */
export function undoOpen(cardId, boxState, before, after) {
  if (state.live[cardId] !== boxState || boxState.seed !== after) return false;
  invalidateChest(cardId);
  Object.assign(boxState, before);
  refresh();
  showToast("Undone.");
  return true;
}

/** Redraws the opened count, the live status line and the history list. */
export function syncMarking(cardId, boxState) {
  $("#history-count").textContent = boxState.opened ? `(${boxState.opened})` : "";
  $("#open-status").textContent = boxState.opened ? `${boxState.opened} opened so far.` : "Nothing opened yet.";
  renderHistory($("#history"), cardId, boxState.history);
}

// Marks from the Settings sheet, then closes it so the cards, the toast or
// any error in #out are in view.
function markFromSettings(action) {
  predictAction(action);
  closeSheet("settings-sheet");
}

export function initMarking() {
  for (const button of $$(".open-btn")) {
    button.addEventListener("click", () => markFromSettings(() => openChest(Number(button.dataset.open))));
  }
  $("#open-custom-go").addEventListener("click", () => {
    markFromSettings(() => {
      const times = numberField("#open-custom", positiveInteger);
      // Each open is three-plus draws; keep the click from locking up the tab.
      openChest(Math.min(times, 10000));
    });
  });
}

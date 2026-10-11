// Route safety shared by Find and XP. Frozen after the foundation: the
// "settings changed" guard must never be weakened.
import { predictChain } from "../loot/simulate.js";
import * as storage from "../storage.js";
import { state, targetsFor } from "./state.js";
import { vaultValue } from "./dom.js";
import { xpOptions, invalidateXp, syncXpControls } from "./xp-planner.js";
import { findOptions, invalidateFind, syncFindControls } from "./find.js";

export const SETTINGS_CHANGED = "Your chest settings changed. Search again to update the steps.";

export function syncSearchControls() {
  syncXpControls();
  syncFindControls();
}

export function invalidateChest(cardId, keepXp = false) {
  if (!keepXp && (state.xpRun?.cardId === cardId || state.xpView?.cardId === cardId)) invalidateXp();
  if (state.findRun?.cardId === cardId || state.findView?.cardId === cardId) invalidateFind();
}

export function contextMatches(context, kind) {
  try {
    const options = kind === "xp" ? xpOptions() : findOptions(context.cardId);
    if (JSON.stringify(options) !== context.optionsKey || vaultValue() !== context.vaultPercentage) return false;
    return kind === "xp" || JSON.stringify([...targetsFor(context.cardId)]) === context.targetsKey;
  } catch {
    return false;
  }
}

// Validate the whole batch before changing any live state. Detached buttons
// and searches solved for an older seed must never consume current boxes.
export function replayRoute(view, steps) {
  let seed = view.state.seed;
  return steps.map((step) => {
    if ((step.usedSeed ?? step.seed) !== seed) throw new Error(SETTINGS_CHANGED);
    const [open] = predictChain(seed, view.cardId, 1, {
      level: step.level ?? view.state.level ?? 1,
      vaultPercentage: view.vaultPercentage
    });
    if (step.nextSeed !== undefined && step.nextSeed !== open.nextSeed) throw new Error(SETTINGS_CHANGED);
    seed = open.nextSeed;
    return open;
  });
}

export function commitOpenings(boxState, openings) {
  for (const open of openings) {
    boxState.history.unshift({ ...open, open: ++boxState.opened });
    boxState.seed = open.nextSeed;
  }
  boxState.history.length = Math.min(boxState.history.length, storage.MAX_HISTORY);
}

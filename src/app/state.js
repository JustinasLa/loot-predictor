// Shared app state. Frozen after the foundation (additive fields allowed).
export const state = {
  // `saved` is the untouched baseline from the file; `live` tracks the seed
  // as you walk it forward. Both survive a refresh; only loading a new save
  // replaces them.
  saved: {},
  live: {},
  // Find targets are per box, so switching boxes doesn't carry a selection
  // that the new box can never drop.
  targets: new Map(),
  // The one box selected app-wide.
  cardId: null,
  // The loaded file's name, shown in the Save menu.
  filename: "",
  activeTab: "predict",
  // Which box each level field was last reset for, so switching boxes snaps
  // it back to that box's real level without stomping on an edit in progress.
  previewLevelChestId: null,
  xpLevelChestId: null,
  findLevelChestId: null,
  xpRun: null,
  findRun: null,
  xpView: null,
  findView: null,
  saveLoadToken: 0,
};

export function currentId() {
  return state.cardId;
}

export function isAdventure(cardId) {
  return typeof cardId === "string" && cardId.startsWith("adventure_");
}

export function currentState() {
  const current = state.live[currentId()];
  if (!current) throw new Error("Load a save file or try the demo first.");
  return current;
}

export function targetsFor(cardId) {
  if (!state.targets.has(cardId)) state.targets.set(cardId, new Set());
  return state.targets.get(cardId);
}

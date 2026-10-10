// Session persistence. The live seed is the thing worth keeping: a refresh
// should never silently rewind you to the savegame's seed. Only loading a
// new savegame resets it.

import { CHEST_ID_MAP, EGG_RARITY_MAP } from "./loot/tables.js";
import { getAvailableItemsForChest } from "./loot/items.js";

const KEY = "loot-predictor:v1";

// History is only for display, so cap it rather than risk the quota.
const MAX_HISTORY = 100;
const CARD_IDS = new Set([...Object.values(CHEST_ID_MAP), ...Object.values(EGG_RARITY_MAP)]);
const RARITIES = new Set(["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic", "common"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSeed(value) {
  return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
}

function isLevel(value) {
  return Number.isInteger(value) && value >= 1 && value <= 100;
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validHistoryEntry(entry, names, opened) {
  return isRecord(entry) && isSeed(entry.seed) && isSeed(entry.nextSeed)
    && isCount(entry.open) && entry.open > 0 && entry.open <= opened
    && Array.isArray(entry.items) && entry.items.length > 0 && entry.items.length <= 6
    && entry.items.every((item) => isRecord(item)
      && names.has(item.baseName) && typeof item.name === "string"
      && RARITIES.has(item.rarity)
      && (!Object.hasOwn(item, "level") || isLevel(item.level)));
}

function sanitizeUi(ui, live) {
  if (!isRecord(ui)) return {};
  const safe = { ...ui };
  for (const key of ["cardId", "findCardId"]) {
    if (typeof safe[key] !== "string" || !Object.hasOwn(live, safe[key])) delete safe[key];
  }
  for (const [key, min, max] of [["count", 1, 200], ["vault", 0, 100]]) {
    const value = safe[key];
    const numeric = typeof value === "number" || (typeof value === "string" && value.trim() !== "");
    if (!numeric || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max
      || (key === "count" && !Number.isInteger(Number(value)))) delete safe[key];
  }
  if (typeof safe.filename !== "string") delete safe.filename;
  return safe;
}

function sanitizeState(state) {
  if (!isRecord(state) || !isRecord(state.saved) || !isRecord(state.live)) return null;
  const ids = Object.keys(state.saved);
  if (ids.length === 0 || Object.keys(state.live).length !== ids.length) return null;
  const live = {};
  const targets = {};
  for (const id of ids) {
    if (!CARD_IDS.has(id) || !Object.hasOwn(state.live, id)) return null;
    const baseline = state.saved[id];
    const current = state.live[id];
    if (!isRecord(baseline) || !isRecord(current)
      || !isSeed(baseline.initialSeed) || !isSeed(current.seed) || !isCount(current.opened)
      || (Object.hasOwn(baseline, "openedCount") && !isCount(baseline.openedCount))
      || (Object.hasOwn(baseline, "level") && !isLevel(baseline.level))
      || (Object.hasOwn(current, "level") && !isLevel(current.level))) return null;

    const available = new Set(getAvailableItemsForChest(id).map((item) => item.baseName));
    const historyNames = new Set(available);
    if (id === "small" || id === "pet") historyNames.add("PetFood");
    if (id === "adventure_Zeus") historyNames.add("ZeusKeyIcon");
    if (id === "adventure_Pirate") historyNames.add("PirateKeyIcon");
    // Display-only corruption must not throw away a valid advanced seed.
    live[id] = { ...current, history: Array.isArray(current.history)
      ? current.history.slice(0, MAX_HISTORY).filter((entry) => validHistoryEntry(entry, historyNames, current.opened))
      : [] };
    if (isRecord(state.targets) && Object.hasOwn(state.targets, id) && Array.isArray(state.targets[id])) {
      targets[id] = [...new Set(state.targets[id].filter((name) => typeof name === "string" && available.has(name)))];
    }
  }
  return {
    ...state,
    live,
    ...(Object.hasOwn(state, "targets") ? { targets } : {}),
    ...(Object.hasOwn(state, "ui") ? { ui: sanitizeUi(state.ui, live) } : {})
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return sanitizeState(JSON.parse(raw));
  } catch {
    // Corrupt or unreadable (private mode, cleared storage) — start fresh.
    return null;
  }
}

export function save(state) {
  try {
    const live = Object.fromEntries(
      Object.entries(state.live).map(([id, st]) => [
        id, { ...st, history: st.history.slice(0, MAX_HISTORY) }
      ])
    );
    localStorage.setItem(KEY, JSON.stringify({ ...state, live }));
  } catch {
    // Out of quota or storage disabled — predictions still work in memory.
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}

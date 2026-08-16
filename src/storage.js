// Session persistence. The live seed is the thing worth keeping: a refresh
// should never silently rewind you to the savegame's seed. Only loading a
// new savegame resets it.

const KEY = "loot-predictor:v1";

// History is only for display, so cap it rather than risk the quota.
const MAX_HISTORY = 100;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state.saved || !state.live) return null;
    return state;
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

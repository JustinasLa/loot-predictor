// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import html from "../index.html?raw";
import { clear, load, save } from "../src/storage.js";
import { predictChain } from "../src/loot/simulate.js";
import { CHEST_ID_MAP, EGG_RARITY_MAP } from "../src/loot/tables.js";
import { renderHistory } from "../src/ui/render.js";

const KEY = "loot-predictor:v1";
function session(cardId = "big", seed = 1, opened = 2) {
  const level = cardId.startsWith("adventure_") ? 100 : undefined;
  const history = predictChain(seed, cardId, opened, { level, vaultPercentage: 100 });
  return {
    saved: { [cardId]: { initialSeed: seed, ...(level ? { level } : {}) } },
    live: { [cardId]: {
      seed: history.at(-1)?.nextSeed ?? seed, ...(level ? { level } : {}), opened,
      history: history.reverse()
    } }
  };
}
function cache(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  return load();
}
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe("session persistence", () => {
  it("round-trips advanced seeds, history, targets and extensible UI and clears only its own key", () => {
    const state = {
      ...session(), targets: { big: ["Hat_Cashier"] },
      ui: { cardId: "big", findCardId: "big", count: "5", vault: "0", filename: "save.json", futurePreference: { enabled: true } }
    };
    expect(load()).toBeNull();
    save(state);
    expect(load()).toEqual(state);
    expect(load().live.big.seed).not.toBe(state.saved.big.initialSeed);
    localStorage.setItem("unrelated", "keep");
    clear();
    expect(load()).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it.each([...Object.values(CHEST_ID_MAP), ...Object.values(EGG_RARITY_MAP)])("preserves real history for %s", (cardId) => {
    const state = session(cardId);
    save(state);
    expect(load()).toEqual(state);
    expect(() => renderHistory(document.createElement("div"), cardId, load().live[cardId].history)).not.toThrow();
  });

  it.each([-2147483648, 0, 2147483647])("preserves signed int32 boundary seed %s", (seed) => {
    const state = session("big", seed, 0);
    expect(cache(state)).toEqual(state);
  });

  it("caps history at 100 on write and read without modifying the current seed or in-memory history", () => {
    const state = session("big", 1, 150);
    save(state);
    expect(load().live.big).toEqual({ ...state.live.big, history: state.live.big.history.slice(0, 100) });
    expect(state.live.big.history).toHaveLength(150);
    expect(cache(state).live.big.history).toHaveLength(100);
  });

  it.each(["{invalid", "null", "[]", "{}", '{"saved":{}}', '{"live":{}}', '{"saved":{},"live":{}}'])
    ("ignores corrupt or incomplete state: %s", (value) => {
      localStorage.setItem(KEY, value);
      expect(load()).toBeNull();
    });

  it.each([null, 7, "bad", [], true])("rejects malformed core records: %j", (value) => {
    for (const key of ["saved", "live"]) {
      const state = session();
      state[key] = value;
      expect(cache(state)).toBeNull();
      const malformedEntry = session();
      malformedEntry[key].big = value;
      expect(cache(malformedEntry)).toBeNull();
    }
  });

  it.each(["constructor", "toString", "__proto__", "unknown", "event_unknown", "egg_Common"])
    ("rejects unsupported and inherited card identifiers: %s", (id) => {
      const state = session();
      expect(cache({ saved: { [id]: state.saved.big }, live: { [id]: state.live.big } })).toBeNull();
    });

  it("rejects mismatched saved and live chest collections", () => {
    const state = session();
    expect(cache({ ...state, live: {} })).toBeNull();
    expect(cache({ ...state, live: { small: state.live.big } })).toBeNull();
    expect(cache({ ...state, live: { ...state.live, small: state.live.big } })).toBeNull();
  });

  it.each([undefined, null, "1", 0.5, -2147483649, 2147483648])("rejects invalid baseline and live seeds: %j", (seed) => {
    const baseline = session();
    baseline.saved.big.initialSeed = seed;
    expect(cache(baseline)).toBeNull();
    const advanced = session();
    advanced.live.big.seed = seed;
    expect(cache(advanced)).toBeNull();
  });

  it.each([undefined, null, "2", -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid opened counters: %j", (opened) => {
    const state = session();
    state.live.big.opened = opened;
    expect(cache(state)).toBeNull();
    state.live.big.opened = 2;
    state.saved.big.openedCount = opened;
    // The baseline's counter is optional, unlike the live counter.
    expect(cache(state) === null).toBe(opened !== undefined);
  });

  it.each([null, "5", 0, 101, 1.5])("rejects unsupported saved and live levels: %j", (level) => {
    for (const key of ["saved", "live"]) {
      const state = session("adventure_Zeus");
      state[key].adventure_Zeus.level = level;
      expect(cache(state)).toBeNull();
    }
  });

  it("retains valid advanced seeds when display history is missing or malformed", () => {
    for (const history of [undefined, null, {}, "bad", [null, {}, { seed: 1, nextSeed: 2, open: 1, items: [null] }]]) {
      const state = session();
      state.live.big.history = history;
      const restored = cache(state);
      expect(restored.live.big).toEqual({ ...state.live.big, history: [] });
      expect(() => renderHistory(document.createElement("div"), "big", restored.live.big.history)).not.toThrow();
    }
  });

  it.each([
    (entry) => { entry.seed = "bad"; },
    (entry) => { entry.nextSeed = 2147483648; },
    (entry) => { entry.open = 0; },
    (entry) => { entry.open = 3; },
    (entry) => { entry.items = null; },
    (entry) => { entry.items = []; },
    (entry) => { entry.items.push(entry.items[0]); },
    (entry) => { entry.items[0].baseName = "unknown"; },
    (entry) => { entry.items[0].name = {}; },
    (entry) => { entry.items[0].rarity = "invalid"; },
    (entry) => { entry.items[0].level = 101; }
  ])("discards malformed history entries without losing valid entries or seed: %s", (corrupt) => {
    const state = session();
    corrupt(state.live.big.history[0]);
    const restored = cache(state);
    expect(restored.live.big.history).toEqual([state.live.big.history[1]]);
    expect(restored.live.big.seed).toBe(state.live.big.seed);
    expect(() => renderHistory(document.createElement("div"), "big", restored.live.big.history)).not.toThrow();
  });

  it.each([null, 7, "bad", []])("ignores malformed optional preferences and targets: %j", (value) => {
    const state = session();
    expect(cache({ ...state, ui: value, targets: value })).toEqual({ ...state, ui: {}, targets: {} });
  });

  it("retains only iterable targets reachable from their saved chest", () => {
    const state = session();
    const targets = { big: ["Hat_Cashier", "Hat_Cashier", null, "Pet_HouseCat", "unknown"], small: ["Hat_Beanie"], constructor: ["Hat_Cashier"] };
    expect(cache({ ...state, targets }).targets).toEqual({ big: ["Hat_Cashier"] });
    for (const list of [7, {}, null, "Hat_Cashier"]) {
      expect(cache({ ...state, targets: { big: list } }).targets).toEqual({});
    }
  });

  it.each([
    { cardId: "constructor", findCardId: "small", count: "Infinity", vault: "NaN", filename: {} },
    { cardId: null, findCardId: 7, count: "1.5", vault: "101", filename: 7 },
    { count: "201", vault: "-1" },
    { count: null, vault: [] },
    { count: "", vault: " " },
    { count: "0" }
  ])("sanitizes preferences that could cause invalid or unbounded predictions: %j", (ui) => {
    expect(cache({ ...session(), ui }).ui).toEqual({});
  });

  it("accepts numeric preferences at their supported bounds", () => {
    const ui = { count: 200, vault: 100, filename: "" };
    expect(cache({ ...session(), ui }).ui).toEqual(ui);
    expect(cache({ ...session(), ui: { count: "1", vault: "0.5" } }).ui).toEqual({ count: "1", vault: "0.5" });
  });

  it("starts the real app with sanitized formerly crashing target and history records", async () => {
    const state = session();
    state.live.big.history = [null];
    state.targets = { big: 7 };
    cache(state);
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, "");
    await expect(import("../src/app.js")).resolves.toBeDefined();
    expect(document.querySelector("#seed").value).toBe(String(state.live.big.seed));
    expect(document.querySelector("#find-selected").textContent).toBe("");
    expect(document.querySelector("#history").textContent).toContain("No openings recorded yet");
  });

  it("leaves the real app in the guest view when the cached core is invalid", async () => {
    cache({ saved: { big: null }, live: { big: {} } });
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, "");
    await expect(import("../src/app.js")).resolves.toBeDefined();
    expect(document.querySelector("#seed").disabled).toBe(true);
    expect(document.querySelector("#user-panel-guest").classList.contains("is-hidden")).toBe(false);
  });

  it("tolerates disabled storage on read, write and clear", () => {
    for (const method of ["getItem", "setItem", "removeItem"]) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error("disabled"); });
    }
    expect(load()).toBeNull();
    expect(() => save(session())).not.toThrow();
    expect(() => clear()).not.toThrow();
  });

  it("tolerates a quota error and malformed in-memory state", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    expect(() => save(session())).not.toThrow();
    expect(() => save({ live: {} })).not.toThrow();
    expect(() => save({ live: null })).not.toThrow();
  });
});

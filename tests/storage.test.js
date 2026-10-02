// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clear, load, save } from "../src/storage.js";

const KEY = "loot-predictor:v1";
beforeEach(() => localStorage.clear());

describe("session persistence", () => {
  it("round-trips live seeds, targets and UI and clears only its own key", () => {
    const state = { saved: { big: { initialSeed: 1 } }, live: { big: { seed: 42, history: [] } }, targets: { big: ["Hat_Cashier"] }, ui: { count: "5" } };
    expect(load()).toBeNull();
    save(state);
    expect(load()).toEqual(state);
    localStorage.setItem("unrelated", "keep");
    clear();
    expect(load()).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it("caps history at 100 without modifying in-memory history or the current seed", () => {
    const history = Array.from({ length: 150 }, (_, seed) => ({ seed }));
    const state = { saved: {}, live: { big: { seed: 999, history }, small: { seed: 1, history: [] } } };
    save(state);
    expect(load().live.big).toEqual({ seed: 999, history: history.slice(0, 100) });
    expect(state.live.big.history).toHaveLength(150);
  });

  it.each(["{invalid", "null", "{}", '{"saved":{}}', '{"live":{}}'])("ignores corrupt or incomplete state: %s", (value) => {
    localStorage.setItem(KEY, value);
    expect(load()).toBeNull();
  });

  it("tolerates disabled storage on read, write and clear", () => {
    for (const method of ["getItem", "setItem", "removeItem"]) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error("disabled"); });
    }
    expect(load()).toBeNull();
    expect(() => save({ saved: {}, live: {} })).not.toThrow();
    expect(() => clear()).not.toThrow();
  });

  it("tolerates a quota error and malformed in-memory state", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    expect(() => save({ saved: {}, live: { big: { seed: 1, history: [] } } })).not.toThrow();
    expect(() => save({ live: {} })).not.toThrow();
    expect(() => save({ live: null })).not.toThrow();
  });
});

// Shared helpers for tests/app/*.test.js. Each test file declares its own
// vi.mock blocks for the solver modules before importing this harness:
//
//   vi.mock("../../src/solver/xp-path.js", async (importOriginal) => {
//     const actual = await importOriginal();
//     return { ...actual, findOptimalXpPath: vi.fn(actual.findOptimalXpPath) };
//   });
//   vi.mock("../../src/solver/find-items.js", async (importOriginal) => {
//     const actual = await importOriginal();
//     return { ...actual, findAllPathsAsync: vi.fn(actual.findAllPathsAsync), findItemLinearAsync: vi.fn(actual.findItemLinearAsync) };
//   });
import { beforeEach, expect, vi } from "vitest";
import { parseSavegame } from "../../src/save/parse.js";
import * as xpModule from "../../src/solver/xp-path.js";
import * as findModule from "../../src/solver/find-items.js";
import { mountDocument } from "./html.js";
import { savegame } from "../fixtures.js";

export { xpModule, findModule };
export const realXp = (await vi.importActual("../../src/solver/xp-path.js")).findOptimalXpPath;
export const realFind = await vi.importActual("../../src/solver/find-items.js");

export const KEY = "loot-predictor:v1";
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];
export const stored = () => JSON.parse(localStorage.getItem(KEY));
export const dispatch = (selector, type = "click") => $(selector).dispatchEvent(new Event(type, { bubbles: true }));

export function input(selector, value, type = "change") {
  $(selector).value = String(value);
  dispatch(selector, type);
}

/** Picks a box in the rail. With `tab`, switches to that tab first. */
export function chest(id, tab) {
  if (tab) dispatch(`#nav-${tab}`);
  $(`#box-rail-list [data-card-id="${id}"]`).click();
}

export function target(baseName) {
  $(`#find-items [data-base-name="${baseName}"]`).click();
}

/** Clicks the mark button on upcoming card `n` (1 = "I opened it!"). */
export function markOpened(n = 1) {
  $$("#out .open-card-btn")[n - 1].click();
}

export async function init(state) {
  if (state !== undefined) localStorage.setItem(KEY, JSON.stringify(state));
  await import("../../src/app.js");
}

export async function upload(text = JSON.stringify(savegame()), name = "synthetic.json") {
  Object.defineProperty($("#save"), "files", { configurable: true, value: [new File([text], name, { type: "application/json" })] });
  dispatch("#save", "change");
  await vi.waitFor(() => expect($("#user-filename").title === name || $("#import-status .error-box")).toBeTruthy());
}

export function restored(overrides = {}) {
  const saved = parseSavegame(JSON.stringify(savegame()));
  return { saved, live: Object.fromEntries(Object.entries(saved).map(([id, st]) => [id, { seed: st.initialSeed, level: st.level, opened: 0, history: [] }])), ...overrides };
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export async function xpRoute(openings = 2) {
  input("#xp-openings", openings, "input");
  input("#xp-maxlevel", 4, "input");
  dispatch("#xp-search");
  await vi.waitFor(() => expect($("#xp-out button")).not.toBeNull());
}

export async function eggRoute() {
  target("Pet_GoldenRetriever");
  dispatch("#find-run");
  await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
}

/** Registers the per-test reset: fresh modules, document, storage and mocks. */
export function setupApp() {
  beforeEach(() => {
    vi.resetModules();
    mountDocument();
    localStorage.clear();
    xpModule.findOptimalXpPath.mockReset().mockImplementation(realXp);
    findModule.findAllPathsAsync.mockReset().mockImplementation(realFind.findAllPathsAsync);
    findModule.findItemLinearAsync.mockReset().mockImplementation(realFind.findItemLinearAsync);
  });
}

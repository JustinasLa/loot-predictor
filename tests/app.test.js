// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import html from "../index.html?raw";
import { parseSavegame } from "../src/save/parse.js";
import { predictChain } from "../src/loot/simulate.js";
import { CHEST_ID_MAP, EGG_RARITY_MAP } from "../src/loot/tables.js";
import { createDemoSave, DEMO_FILENAME } from "../src/ui/demo.js";
import { savegame, item, step } from "./fixtures.js";

vi.mock("../src/solver/xp-path.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findOptimalXpPath: vi.fn(actual.findOptimalXpPath) };
});
vi.mock("../src/solver/find-items.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findAllPathsAsync: vi.fn(actual.findAllPathsAsync), findItemLinearAsync: vi.fn(actual.findItemLinearAsync) };
});
const xpModule = await import("../src/solver/xp-path.js");
const findModule = await import("../src/solver/find-items.js");
const realXp = (await vi.importActual("../src/solver/xp-path.js")).findOptimalXpPath;
const realFind = await vi.importActual("../src/solver/find-items.js");
const KEY = "loot-predictor:v1";
const $ = (selector) => document.querySelector(selector);
const stored = () => JSON.parse(localStorage.getItem(KEY));
const dispatch = (selector, type = "click") => $(selector).dispatchEvent(new Event(type, { bubbles: true }));
function input(selector, value, type = "change") { $(selector).value = String(value); dispatch(selector, type); }
function chest(id, tab = "predict") {
  $(`#sidebar-${tab}-list [data-card-id="${id}"]`).click();
}
function target(baseName) {
  $(`#find-items [data-base-name="${baseName}"]`).click();
}
async function init(state) {
  if (state !== undefined) localStorage.setItem(KEY, JSON.stringify(state));
  await import("../src/app.js");
}
async function upload(text = JSON.stringify(savegame()), name = "synthetic.json") {
  Object.defineProperty($("#save"), "files", { configurable: true, value: [new File([text], name, { type: "application/json" })] });
  dispatch("#save", "change");
  await vi.waitFor(() => expect($("#user-filename").textContent === name || $("#import-status .error-box")).toBeTruthy());
}
function restored(overrides = {}) {
  const saved = parseSavegame(JSON.stringify(savegame()));
  return { saved, live: Object.fromEntries(Object.entries(saved).map(([id, st]) => [id, { seed: st.initialSeed, level: st.level, opened: 0, history: [] }])), ...overrides };
}
beforeEach(() => {
  vi.resetModules();
  document.documentElement.innerHTML = html.replace(/<!doctype html>/i, "");
  localStorage.clear();
  xpModule.findOptimalXpPath.mockReset().mockImplementation(realXp);
  findModule.findAllPathsAsync.mockReset().mockImplementation(realFind.findAllPathsAsync);
  findModule.findItemLinearAsync.mockReset().mockImplementation(realFind.findItemLinearAsync);
});

describe("savegame and prediction UI", () => {
  it("initializes guest controls, collapses categories and ignores an empty file selection", async () => {
    await init();
    expect($("#seed").disabled).toBe(true);
    const head = $(".channel-category-head");
    head.click();
    expect(head.firstElementChild.textContent).toBe("▸");
    head.click();
    expect(head.firstElementChild.textContent).toBe("▾");
    dispatch("#save", "change");
    expect(stored()).toBeNull();
    dispatch("#count", "change");
    expect($("#out").textContent).toContain("Load a save file");
  });

  it("loads a save, advances the live seed, resets it and persists the baseline", async () => {
    await init();
    await upload();
    expect($("#user-panel-guest").classList.contains("is-hidden")).toBe(true);
    expect($("#user-filename").title).toBe("synthetic.json");
    expect($("#current-chest-name").textContent).toBe("Big Box");
    const expected = predictChain(42, "big", 2);
    dispatch('.open-btn[data-open="2"]');
    expect(stored().live.big.seed).toBe(expected[1].nextSeed);
    expect(stored().saved.big.initialSeed).toBe(42);
    expect(stored().live.big.history.map((open) => open.open)).toEqual([2, 1]);
    expect($("#history-count").textContent).toBe("(2)");
    dispatch("#reset");
    expect(stored().live.big).toMatchObject({ seed: 42, opened: 0, history: [] });
    expect($("#history-count").textContent).toBe("");
  });

  it("opens through an upcoming card, accepts integer seeds and validates custom counts", async () => {
    await init(restored());
    $("#out").querySelectorAll("button")[1].click();
    expect(stored().live.big.opened).toBe(2);
    input("#seed", 123);
    expect(stored().live.big.seed).toBe(123);
    expect(stored().live.big.history).toHaveLength(2);
    input("#seed", 1.5);
    expect(stored().live.big.seed).toBe(123);
    for (const value of [0, -1, 1.5]) { input("#open-custom", value); dispatch("#open-custom-go"); }
    expect(stored().live.big.opened).toBe(2);
    input("#open-custom", 3);
    dispatch("#open-custom-go");
    expect(stored().live.big.opened).toBe(5);
    input("#count", 0);
    expect($("#out").textContent).toContain("preview count must be an integer");
  });

  it("caps a custom opening batch at 10000", async () => {
    await init(restored({ ui: { cardId: "egg_Rare", count: "1" } }));
    input("#open-custom", 10001);
    dispatch("#open-custom-go");
    expect(stored().live.egg_Rare.opened).toBe(10000);
    expect(stored().live.egg_Rare.history).toHaveLength(100);
    expect($("#history").querySelectorAll(".open-box")).toHaveLength(100);
    expect($("#history .open-title").textContent).toContain("Opened 10000");
    expect(stored().live.egg_Rare.seed).toBe(predictChain(42, "egg_Rare", 10000).at(-1).nextSeed);
  });

  it("reports parsing and file-reader errors", async () => {
    await init();
    await upload("{}");
    expect($("#import-status").textContent).toContain("Choose a valid save file");
    class UnreadableFile { readAsText() { this.onerror(); } }
    vi.stubGlobal("FileReader", UnreadableFile);
    await upload("{}", "unreadable.json");
    expect($("#import-status").textContent).toContain("Could not read this file");
  });

  it("rejects a save with no mapped chests", async () => {
    await init();
    await upload('{"GameSavegame":{}}');
    expect($("#import-status").textContent).toContain("no supported boxes, chests, or eggs");
    expect($("#sidebar-predict-list").querySelectorAll("[data-card-id]")).toHaveLength(0);
  });

  it("restores selected chests, seeds, targets and UI values", async () => {
    const state = restored({ targets: { egg_Rare: ["Pet_HouseCat"] }, ui: { cardId: "adventure_Pirate", findCardId: "egg_Rare", count: "2", vault: "10", filename: "old.json" } });
    state.live.adventure_Pirate.seed = 321;
    await init(state);
    expect($("#seed").value).toBe("321");
    expect($("#out").children).toHaveLength(2);
    expect($("#vault").value).toBe("10");
    expect($("#user-filename").textContent).toBe("old.json");
    expect($("#find-selected").textContent).toBe("(1)");
    expect(stored().targets.egg_Rare).toEqual(["Pet_HouseCat"]);
  });

  it.each([undefined, { cardId: "gone", findCardId: "gone" }, { cardId: "", findCardId: "", count: "", vault: "", filename: "" }])("falls back from incomplete UI preferences: %j", async (ui) => {
    await init(restored({ ui }));
    expect($("#current-chest-name").textContent).toBe("Big Box");
    expect($("#user-filename").textContent).toBe("savegame");
  });

  it("rejects an empty cached session and can unload storage", async () => {
    await init({ saved: {}, live: {}, ui: {} });
    expect($("#seed").disabled).toBe(true);
    expect($("#sidebar-predict-list").querySelectorAll("[data-card-id]")).toHaveLength(0);
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    dispatch("#unload");
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("toggles the user menu and closes it on actions, outside clicks and Escape", async () => {
    await init(restored());
    const menu = $("#user-menu");
    dispatch("#user-menu-trigger");
    expect(menu.classList.contains("is-hidden")).toBe(false);
    dispatch("#user-menu-trigger");
    expect(menu.classList.contains("is-hidden")).toBe(true);
    dispatch("#user-menu-trigger");
    menu.dispatchEvent(new Event("click", { bubbles: true }));
    expect(menu.classList.contains("is-hidden")).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    expect(menu.classList.contains("is-hidden")).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu.classList.contains("is-hidden")).toBe(true);
    dispatch("#user-menu-trigger");
    dispatch("#reset");
    expect(menu.classList.contains("is-hidden")).toBe(true);
    dispatch("#user-menu-trigger");
    document.body.click();
    expect(menu.classList.contains("is-hidden")).toBe(true);
  });
});

describe("adventure preview and XP UI", () => {
  it("previews the selected chest's level immediately and preserves edits while opening", async () => {
    await init(restored());
    chest("adventure_Zeus");
    expect($("#preview-level").value).toBe("5");
    input("#preview-level", 1, "input");
    dispatch('.open-btn[data-open="1"]');
    expect($("#preview-level").value).toBe("1");
    expect(stored().live.adventure_Zeus.history[0].items[0].level).toBe(1);
    chest("adventure_Pirate");
    expect($("#preview-level").value).toBe("24");
    expect($("#out").querySelectorAll(".open-box")[0].querySelectorAll("li")).toHaveLength(2);
    input("#preview-level", "", "input");
    expect($("#out").querySelectorAll(".open-box")[0].querySelectorAll("li")).toHaveLength(2);
    input("#xp-vault", 100);
    expect($("#vault").value).toBe("100");
    input("#vault", 12);
    expect($("#xp-vault").value).toBe("12");
    chest("big");
    expect($("#preview-level-field").classList.contains("is-hidden")).toBe(true);
  });

  it.each([[1, 1, "instant"], [10, 100, "s"], [12, 100, "min"], [14, 100, "h"]])("estimates search cost for %i openings at max level %i", async (opens, level, unit) => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input("#xp-maxlevel", level, "input");
    input("#xp-openings", opens, "input");
    expect($("#xp-estimate").textContent).toContain(unit);
    if (opens >= 12) expect($("#xp-estimate").dataset.heavy).toBe("yes");
  });

  it("resets the preview level when another save replaces the same adventure chest", async () => {
    const save = savegame();
    save.Data.GameSavegame.CharacterSavegame.EquipmentChestSavegames = [{ ChestId: 9, Seed: 42, OpenedCount: 0 }];
    await init();
    await upload(JSON.stringify(save));
    input("#preview-level", 1, "input");
    save.Data.GameSavegame.AdventuresSavegame.AdventureInfos.Greek.UnlockedLevel = 60;
    await upload(JSON.stringify(save), "next.json");
    expect($("#preview-level").value).toBe("60");
    expect($("#out .open-box").querySelectorAll("li")).toHaveLength(5);
  });

  it("searches a real XP route, opens its steps and clears it on a chest switch", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input("#xp-openings", 2, "input");
    input("#xp-maxlevel", 4, "input");
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-out button")).not.toBeNull());
    expect($("#xp-search").disabled).toBe(false);
    expect($("#xp-status").textContent).toContain("routes checked in");
    $("#xp-out button").click();
    expect(stored().live.adventure_Zeus.opened).toBe(1);
    expect($("#xp-out").textContent).toContain("1 of 2 openings recorded");
    $("#xp-out button").click();
    expect($("#xp-out").textContent).toContain("Plan complete");
    chest("big");
    expect($("#xp-out").textContent).toBe("");
    expect($("#xp-status").textContent).toBe("");
  });

  it("stops a running XP search and restores controls after a search error", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    xpModule.findOptimalXpPath.mockImplementationOnce(async (opts) => {
      opts.onProgress(2);
      expect($("#xp-status").textContent).toContain("through 2 openings");
      dispatch("#xp-stop");
      expect(opts.shouldStop()).toBe(true);
      return { path: [], xp: 0, nodesVisited: 2 };
    });
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-status").textContent).toContain("Stopped early"));
    xpModule.findOptimalXpPath.mockRejectedValueOnce(new Error("search failed"));
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-out").textContent).toContain("search failed"));
    expect($("#xp-search").disabled).toBe(false);
    expect($("#xp-stop").classList.contains("is-hidden")).toBe(true);
  });

  it.each([5, undefined])("falls back to saved XP settings when fields are blank and level is %s", async (level) => {
    const state = restored({ ui: { cardId: "adventure_Zeus" } });
    state.live.adventure_Zeus.level = level;
    await init(state);
    input("#xp-openings", "", "input");
    input("#xp-maxlevel", "", "input");
    const path = [{ ...step(), level: undefined }];
    xpModule.findOptimalXpPath.mockResolvedValueOnce({ path, xp: 4, nodesVisited: 1 });
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-out button")).not.toBeNull());
    expect(xpModule.findOptimalXpPath).toHaveBeenCalledWith(expect.objectContaining({ openings: 4, maxLevel: level || 1 }));
    $("#xp-out button").click();
    expect(stored().live.adventure_Zeus.history[0].items[0].level).toBe(level || 1);
  });

  it("bounds a refunded XP search by max opens", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus", vault: "100" } }));
    input("#xp-openings", 1, "input");
    input("#xp-maxlevel", 4, "input");
    input("#xp-maxopens", 2);
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-out button")).not.toBeNull());
    expect($("#xp-out").textContent).toContain("2-opening limit");
    expect($("#xp-out").textContent).toContain("bonus openings from key drops");
  });

  it("handles stale XP actions after switching chests and replacing the save", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input("#xp-openings", 1, "input");
    input("#xp-maxlevel", 4, "input");
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-out button")).not.toBeNull());
    const pendingAction = $("#xp-out button");
    chest("big");
    pendingAction.click();
    expect($("#xp-out").textContent).toBe("");
    const replacement = { GameSavegame: { CharacterSavegame: { EquipmentChestSavegames: [{ ChestId: 1, Seed: 99, OpenedCount: 0 }] } } };
    await upload(JSON.stringify(replacement), "replacement.json");
    pendingAction.click();
    expect(stored().live.big.seed).toBe(99);
    expect(stored().live.adventure_Zeus).toBeUndefined();
  });
});

describe("item hunt UI", () => {
  it("keeps selections per chest and commits a real linear hunt", async () => {
    await init(restored());
    chest("egg_Rare", "find");
    expect($("#panel-predict").classList.contains("is-hidden")).toBe(true);
    target("Pet_GoldenRetriever");
    target("Pet_GoldenRetriever");
    expect($("#find-run").disabled).toBe(true);
    target("Pet_GoldenRetriever");
    chest("big", "find");
    expect($("#find-selected").textContent).toBe("");
    chest("egg_Rare", "find");
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    expect($("#find-status").textContent).toContain("possibilities checked in");
    $("#find-out button").click();
    expect(stored().live.egg_Rare.seed).toBe(302596119);
    expect($("#find-out").textContent).toContain("All selected items are marked as collected");
    expect($("#find-selected").textContent).toBe("");
  });

  it("reruns a hunt after committing only part of the target route", async () => {
    await init(restored({ ui: { findCardId: "egg_Rare" } }));
    target("Pet_GoldenRetriever");
    target("Pet_HouseCat");
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    $("#find-out button").click();
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    expect(stored().targets.egg_Rare).toEqual(["Pet_HouseCat"]);
    $("#find-out button").click();
    expect($("#find-out").textContent).toContain("All selected items are marked as collected");
  });

  it("searches an adventure route and forwards stopping and fallback options", async () => {
    await init(restored({ ui: { findCardId: "adventure_Zeus" } }));
    target("Ring_Bronze");
    input("#find-maxlevel", "");
    input("#find-maxdepth", "");
    findModule.findAllPathsAsync.mockImplementationOnce((opts) => {
      expect(opts.maxLevel).toBe(5);
      expect(opts.maxDepth).toBe(10);
      dispatch("#find-stop");
      expect(opts.shouldStop()).toBe(true);
      return { found: false, nodesVisited: 1, maxDepth: 10 };
    });
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-status").textContent).toContain("stopped early"));
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    $("#find-out button").click();
    expect(stored().live.adventure_Zeus.opened).toBeGreaterThan(0);
  });

  it("reports missing state, missing targets and solver errors", async () => {
    await init();
    dispatch("#find-run");
    expect($("#find-out").textContent).toContain("Load a save file");
    await upload();
    dispatch("#find-run");
    expect($("#find-out").textContent).toContain("Choose at least one item");
    target("Hat_Cashier");
    findModule.findItemLinearAsync.mockImplementationOnce(() => { throw new Error("hunt failed"); });
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-out").textContent).toContain("hunt failed"));
    expect($("#find-run").disabled).toBe(false);
    expect($("#find-stop").classList.contains("is-hidden")).toBe(true);
  });

  it("uses level one and zero visited nodes for incomplete restored hunt state", async () => {
    const state = restored({ ui: { findCardId: "adventure_Zeus" } });
    delete state.live.adventure_Zeus.level;
    await init(state);
    target("Ring_Bronze");
    input("#find-maxlevel", "");
    findModule.findAllPathsAsync.mockReturnValueOnce({ found: false, maxDepth: 10 });
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-status").textContent).toContain("0 possibilities checked"));
    expect(findModule.findAllPathsAsync).toHaveBeenCalledWith(expect.objectContaining({ maxLevel: 1 }));
  });

  it("ignores stale hunt actions after a save replaces their chest", async () => {
    await init(restored({ ui: { findCardId: "egg_Rare" } }));
    target("Pet_GoldenRetriever");
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    const pendingAction = $("#find-out button");
    await upload('{"GameSavegame":{"CharacterSavegame":{"EquipmentChestSavegames":[{"ChestId":1,"Seed":99}]}}}', "replacement.json");
    pendingAction.click();
    expect(stored().live.big.seed).toBe(99);
    expect(stored().live.egg_Rare).toBeUndefined();
  });
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function xpRoute(openings = 2) {
  input("#xp-openings", openings, "input");
  input("#xp-maxlevel", 4, "input");
  dispatch("#xp-search");
  await vi.waitFor(() => expect($("#xp-out button")).not.toBeNull());
}

async function eggRoute() {
  target("Pet_GoldenRetriever");
  dispatch("#find-run");
  await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
}

describe("search lifecycle and route safety", () => {
  it.each(["open", "reset", "seed", "vault", "xp-vault", "openings", "level", "cap", "switch", "import"])("invalidates XP routes after %s and ignores their detached buttons", async (action) => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    await xpRoute();
    const obsolete = $("#xp-out button");
    if (action === "open") dispatch('.open-btn[data-open="1"]');
    if (action === "reset") dispatch("#reset");
    if (action === "seed") input("#seed", 123);
    if (action === "vault") input("#vault", 25);
    if (action === "xp-vault") input("#xp-vault", 25);
    if (action === "openings") input("#xp-openings", 3, "input");
    if (action === "level") input("#xp-maxlevel", 1, "input");
    if (action === "cap") input("#xp-maxopens", 1);
    if (action === "switch") chest("adventure_Pirate");
    if (action === "import") await upload();
    const before = stored().live;
    expect($("#xp-out").textContent).toBe("");
    obsolete.click();
    expect(stored().live).toEqual(before);
  });

  it.each(["open", "reset", "seed", "vault", "targets", "switch", "import"])("invalidates Find routes after %s and ignores their detached buttons", async (action) => {
    await init(restored({ ui: { cardId: "egg_Rare", findCardId: "egg_Rare" } }));
    await eggRoute();
    const obsolete = $("#find-out button");
    if (action === "open") dispatch('.open-btn[data-open="1"]');
    if (action === "reset") dispatch("#reset");
    if (action === "seed") input("#seed", 123);
    if (action === "vault") input("#vault", 25);
    if (action === "targets") target("Pet_HouseCat");
    if (action === "switch") chest("big", "find");
    if (action === "import") await upload();
    const before = stored().live;
    expect($("#find-out .find-guidance")).not.toBeNull();
    obsolete.click();
    expect(stored().live).toEqual(before);
  });

  it("keeps a valid XP continuation and ignores a repeated detached step", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    await xpRoute();
    chest("adventure_Zeus");
    const first = $("#xp-out button");
    first.click();
    first.click();
    expect(stored().live.adventure_Zeus.opened).toBe(1);
    expect($("#xp-out").textContent).toContain("1 of 2 openings recorded");
    $("#xp-out button").click();
    expect(stored().live.adventure_Zeus.opened).toBe(2);
  });

  it("bounds route history while preserving every committed step and the final seed", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    const chain = predictChain(42, "adventure_Zeus", 101, { level: 4 });
    xpModule.findOptimalXpPath.mockResolvedValueOnce({ path: chain.map((open) => ({ ...open, usedSeed: open.seed, level: 4, xp: 4 })), xp: 404, nodesVisited: 101 });
    await xpRoute(101);
    $("#xp-out").querySelectorAll("button")[100].click();
    expect(stored().live.adventure_Zeus.opened).toBe(101);
    expect(stored().live.adventure_Zeus.seed).toBe(chain.at(-1).nextSeed);
    expect(stored().live.adventure_Zeus.history).toHaveLength(100);
    expect($("#history").querySelectorAll(".open-box")).toHaveLength(100);
    expect($("#history .open-title").textContent).toContain("Opened 101");
    expect($("#xp-out").textContent).toContain("Plan complete");
  });

  it("rejects an XP batch atomically when a later step has the wrong seed", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    xpModule.findOptimalXpPath.mockResolvedValueOnce({ path: [step(4, 42), step(4, 99)], xp: 8, nodesVisited: 2 });
    await xpRoute();
    $("#xp-out").querySelectorAll("button")[1].click();
    expect(stored().live.adventure_Zeus).toMatchObject({ seed: 42, opened: 0, history: [] });
    expect($("#xp-out").textContent).toContain("settings changed");
  });

  it("checks the current vault even when a route's change event has not fired", async () => {
    await init(restored({ ui: { cardId: "egg_Rare", findCardId: "egg_Rare" } }));
    await eggRoute();
    $("#vault").value = "100";
    $("#find-out button").click();
    expect(stored().live.egg_Rare.opened).toBe(0);
    expect($("#find-out").textContent).toContain("settings changed");
  });

  it("ignores detached Upcoming actions after switching the selected chest", async () => {
    await init(restored());
    const obsolete = $("#out button");
    chest("small");
    obsolete.click();
    expect(stored().live.small.opened).toBe(0);
    expect(stored().live.big.opened).toBe(0);
  });

  it("ignores an Upcoming action with changed options and reports invalid pending input", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    const action = $("#out button");
    $("#preview-level").value = "1";
    action.click();
    expect(stored().live.adventure_Zeus.opened).toBe(0);
    $("#preview-level").value = "101";
    action.click();
    expect(stored().live.adventure_Zeus.opened).toBe(0);
    expect($("#out").textContent).toContain("level must be an integer");
  });

  it.each([1, 0])("guards a pending XP route when a max-level edit has not emitted an event (%s)", async (level) => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    await xpRoute();
    $("#xp-maxlevel").value = String(level);
    $("#xp-out button").click();
    expect(stored().live.adventure_Zeus.opened).toBe(0);
    expect($("#xp-out").textContent).toContain("settings changed");
  });

  it("rejects a route whose recorded next seed differs from replay before advancing history", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    xpModule.findOptimalXpPath.mockResolvedValueOnce({ path: [{ ...step(4, 42), nextSeed: 99 }], xp: 4, nodesVisited: 1 });
    await xpRoute();
    $("#xp-out button").click();
    expect(stored().live.adventure_Zeus.opened).toBe(0);
    expect($("#xp-out").textContent).toContain("settings changed");
  });

  it("ignores obsolete XP errors after switching chests", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    const pending = deferred();
    xpModule.findOptimalXpPath.mockReturnValueOnce(pending.promise);
    dispatch("#xp-search");
    chest("big");
    pending.reject(new Error("obsolete error"));
    await Promise.resolve();
    expect($("#xp-out").textContent).toBe("");
    expect($("#xp-search").disabled).toBe(true);
  });

  it("ignores obsolete Find results after switching chests", async () => {
    await init(restored({ ui: { findCardId: "egg_Rare" } }));
    target("Pet_GoldenRetriever");
    const pending = deferred();
    findModule.findItemLinearAsync.mockReturnValueOnce(pending.promise);
    dispatch("#find-run");
    chest("big", "find");
    pending.resolve({ found: false, opens: 0, missing: ["Pet_GoldenRetriever"] });
    await Promise.resolve();
    expect($("#find-out .find-guidance")).not.toBeNull();
  });

  it("reports a bounded Find search as incomplete and forwards current progress", async () => {
    await init(restored({ ui: { findCardId: "adventure_Zeus" } }));
    target("Ring_Bronze");
    findModule.findAllPathsAsync.mockImplementationOnce(async (options) => {
      options.onProgress(12);
      expect($("#find-status").textContent).toContain("12 checked");
      return { found: false, maxDepth: 10, nodesVisited: 12, truncated: true };
    });
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-status").textContent).toContain("Search limit reached"));
  });

  it("ignores late Stop actions when no run is active", async () => {
    await init();
    dispatch("#xp-stop");
    dispatch("#find-stop");
    expect($("#xp-status").textContent).toBe("");
    expect($("#find-status").textContent).toBe("");
  });

  it("rejects an XP action on a non-adventure chest and mismatched vault views", async () => {
    await init(restored());
    dispatch("#xp-search");
    expect($("#xp-out").textContent).toContain("Choose an adventure chest");
    chest("adventure_Zeus");
    $("#xp-vault").value = "10";
    dispatch("#xp-search");
    expect($("#xp-out").textContent).toContain("Key drop chance must match");
    expect(xpModule.findOptimalXpPath).not.toHaveBeenCalled();
  });

  it("does not let old XP progress, completion or cleanup overwrite a newer run", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    const first = deferred();
    const second = deferred();
    xpModule.findOptimalXpPath.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    dispatch("#xp-search");
    const oldOptions = xpModule.findOptimalXpPath.mock.calls[0][0];
    input("#count", 2);
    expect($("#xp-search").disabled).toBe(true);
    dispatch("#xp-search");
    expect(xpModule.findOptimalXpPath).toHaveBeenCalledTimes(1);
    input("#xp-maxlevel", 4, "input");
    expect(oldOptions.shouldStop()).toBe(true);
    dispatch("#xp-search");
    const status = $("#xp-status").textContent;
    oldOptions.onProgress(999);
    expect($("#xp-status").textContent).toBe(status);
    first.resolve({ path: [], xp: 0, nodesVisited: 1 });
    await Promise.resolve();
    expect($("#xp-search").disabled).toBe(true);
    expect($("#xp-stop").classList.contains("is-hidden")).toBe(false);
    second.resolve({ path: [], xp: 0, nodesVisited: 99 });
    await vi.waitFor(() => expect($("#xp-status").textContent).toContain("99 routes checked"));
    expect($("#xp-search").disabled).toBe(false);
  });

  it("cancels old Find runs without releasing a newer run's controls", async () => {
    await init(restored({ ui: { findCardId: "egg_Rare" } }));
    target("Pet_GoldenRetriever");
    const first = deferred();
    const second = deferred();
    findModule.findItemLinearAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    dispatch("#find-run");
    const oldOptions = findModule.findItemLinearAsync.mock.calls[0][3];
    chest("egg_Rare", "find");
    expect($("#find-run").disabled).toBe(true);
    dispatch("#find-run");
    expect(findModule.findItemLinearAsync).toHaveBeenCalledTimes(1);
    target("Pet_HouseCat");
    expect(oldOptions.shouldStop()).toBe(true);
    dispatch("#find-run");
    const newOptions = findModule.findItemLinearAsync.mock.calls[1][3];
    expect(newOptions.shouldStop()).toBe(false);
    const status = $("#find-status").textContent;
    oldOptions.onProgress(999);
    expect($("#find-status").textContent).toBe(status);
    first.reject(new Error("obsolete failure"));
    await Promise.resolve();
    expect($("#find-run").disabled).toBe(true);
    expect($("#find-out").textContent).toBe("");
    dispatch("#find-stop");
    expect(newOptions.shouldStop()).toBe(true);
    second.resolve({ found: false, opens: 0, missing: ["Pet_HouseCat"], nodesVisited: 0, stopped: true });
    await vi.waitFor(() => expect($("#find-status").textContent).toContain("stopped early"));
    expect($("#find-run").disabled).toBe(false);
  });

  it("preserves edited search levels during refresh and item toggles, and resets them on chest switches", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus", findCardId: "adventure_Zeus" } }));
    input("#xp-maxlevel", 4, "input");
    input("#find-maxlevel", 4);
    input("#vault", 12.5);
    target("Ring_Bronze");
    target("Ring_Bronze");
    dispatch('.open-btn[data-open="1"]');
    expect($("#xp-maxlevel").value).toBe("4");
    expect($("#find-maxlevel").value).toBe("4");
    expect($("#xp-vault").value).toBe("12.5");
    chest("big");
    chest("adventure_Zeus");
    expect($("#xp-maxlevel").value).toBe("5");
    chest("big", "find");
    chest("adventure_Zeus", "find");
    expect($("#find-maxlevel").value).toBe("5");
  });

  it("applies an explicit XP cap to the baseline even when free openings exceed it", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input("#xp-openings", 4, "input");
    input("#xp-maxlevel", 4, "input");
    input("#xp-maxopens", 1);
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-out button")).not.toBeNull());
    expect($("#xp-out").textContent).toContain("in 1 opening");
  });

  it("bounds a stopped search's baseline by its partial path instead of the requested budget", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input("#xp-openings", 1000000000000, "input");
    input("#xp-maxlevel", 4, "input");
    const simulation = await import("../src/loot/simulate.js");
    const actual = simulation.simulateAdventureChestOpening;
    const baselineCalls = vi.spyOn(simulation, "simulateAdventureChestOpening").mockImplementation((...args) => {
      if (baselineCalls.mock.calls.length > 1) throw new Error("baseline exceeded partial route");
      return actual(...args);
    });
    xpModule.findOptimalXpPath.mockImplementationOnce(async () => {
      dispatch("#xp-stop");
      return { path: [step(4, 42)], xp: 4, nodesVisited: 1 };
    });
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-out button")).not.toBeNull());
    expect(baselineCalls).toHaveBeenCalledTimes(1);
    expect($("#xp-out").textContent).toContain("in 1 opening");
    expect($("#xp-status").textContent).toContain("Stopped early");
  });
});

describe("numeric controls", () => {
  it("validates the source vault before mirroring a browser's malformed number", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus", vault: "25" } }));
    $("#xp-vault").value = "";
    Object.defineProperty($("#xp-vault"), "validity", { configurable: true, value: { badInput: true } });
    dispatch("#xp-vault", "change");
    expect($("#vault").value).toBe("25");
    expect($("#out").textContent).toContain("Enter a valid number");
    expect(stored().ui.vault).toBe("25");
  });

  it("persists valid seed advances and history when the preview count is invalid", async () => {
    await init(restored());
    input("#count", 201);
    dispatch('.open-btn[data-open="1"]');
    expect(stored().live.big.opened).toBe(1);
    expect(stored().live.big.seed).toBe(predictChain(42, "big", 1)[0].nextSeed);
    expect($("#history .open-box")).not.toBeNull();
    expect(stored().ui.count).toBe("5");
    input("#seed", 456);
    expect(stored().live.big.seed).toBe(456);
    expect($("#out").textContent).toContain("preview count must be an integer");
  });

  it("rejects a browser's malformed number instead of treating it as an unlimited cap", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    // Chromium reports overflow/incomplete exponents as an empty value with
    // badInput=true. jsdom does not implement that native editing behavior.
    Object.defineProperty($("#xp-maxopens"), "validity", { configurable: true, value: { badInput: true } });
    dispatch("#xp-search");
    expect(xpModule.findOptimalXpPath).not.toHaveBeenCalled();
    expect($("#xp-out").textContent).toContain("Enter a valid number");
  });

  it.each(["", 1.5, -2147483649, 2147483648, 9007199254740992])("rejects seed %s without changing the live seed", async (value) => {
    await init(restored());
    input("#seed", value);
    expect(stored().live.big.seed).toBe(42);
    expect($("#seed").value).toBe("42");
    expect($("#out .error-box")).not.toBeNull();
  });

  it("accepts both signed int32 seed boundaries", async () => {
    await init(restored());
    input("#seed", -2147483648);
    expect(stored().live.big.seed).toBe(-2147483648);
    input("#seed", 2147483647);
    expect(stored().live.big.seed).toBe(2147483647);
  });

  it.each([0, -1, 1.5, 101])("rejects preview level %s before recording an opening", async (value) => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input("#preview-level", value, "input");
    dispatch('.open-btn[data-open="1"]');
    expect(stored().live.adventure_Zeus).toMatchObject({ seed: 42, opened: 0, history: [] });
    expect($("#out").textContent).toContain("level must be an integer");
  });

  it.each([0, -1, 1.5, 201])("rejects preview count %s", async (value) => {
    await init(restored());
    input("#count", value);
    expect($("#out").textContent).toContain("preview count must be an integer");
    expect(stored().live.big.seed).toBe(42);
  });

  it.each([["#xp-openings", 0], ["#xp-openings", 1.5], ["#xp-maxlevel", 101], ["#xp-maxlevel", 0], ["#xp-maxopens", 0], ["#xp-maxopens", 1.5], ["#xp-vault", -1], ["#xp-vault", 101]])("rejects invalid XP input %s=%s before invoking the solver", async (selector, value) => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input(selector, value);
    dispatch("#xp-search");
    expect(xpModule.findOptimalXpPath).not.toHaveBeenCalled();
    expect($("#xp-out .error-box")).not.toBeNull();
    expect($("#xp-search").disabled).toBe(false);
  });

  it.each([["#find-maxlevel", 0], ["#find-maxlevel", 101], ["#find-maxlevel", 1.5], ["#find-maxdepth", 0], ["#find-maxdepth", -1], ["#find-maxdepth", 1.5]])("rejects invalid Find input %s=%s before invoking the solver", async (selector, value) => {
    await init(restored({ ui: { findCardId: "adventure_Zeus" } }));
    target("Ring_Bronze");
    input(selector, value);
    dispatch("#find-run");
    expect(findModule.findAllPathsAsync).not.toHaveBeenCalled();
    expect($("#find-out .error-box")).not.toBeNull();
    expect($("#find-run").disabled).toBe(false);
  });
});

describe("demo data", () => {
  it("creates a fresh, deterministic example covering every supported chest and egg", () => {
    const demo = createDemoSave();
    expect(Object.keys(demo)[0]).toBe("big");
    expect(Object.keys(demo).sort()).toEqual([...Object.values(CHEST_ID_MAP), ...Object.values(EGG_RARITY_MAP)].sort());
    expect(createDemoSave()).toEqual(demo);
    for (const [cardId, state] of Object.entries(demo)) {
      expect(Number.isInteger(state.initialSeed)).toBe(true);
      expect(predictChain(state.initialSeed, cardId, 1, { level: state.level })[0].items.length).toBeGreaterThan(0);
      if (cardId.startsWith("adventure_")) expect(state.level).toBe(25);
    }
    demo.big.initialSeed = 0;
    expect(createDemoSave().big.initialSeed).not.toBe(0);
  });
});

describe("guided onboarding and item discovery", () => {
  it("starts with a private demo and keeps tracked openings separate from its baseline", async () => {
    await init();
    expect($("#welcome-screen").classList.contains("is-hidden")).toBe(false);
    expect($("#workspace").classList.contains("is-hidden")).toBe(true);
    dispatch("#load-demo");
    expect($("#welcome-screen").classList.contains("is-hidden")).toBe(true);
    expect($("#workspace").classList.contains("is-hidden")).toBe(false);
    expect($("#session-label").dataset.demo).toBe("true");
    expect($("#session-label").textContent).toContain("example data");
    expect($("#user-filename").textContent).toBe(DEMO_FILENAME);
    expect($("#current-chest-name").textContent).toBe("Big Box");
    expect(document.activeElement).toBe($("#current-chest-name"));
    expect(stored().saved).toEqual(createDemoSave());
    expect($("#out .open-box").querySelectorAll(".item-row")).toHaveLength(6);
    const seed = stored().saved.big.initialSeed;
    dispatch('.open-btn[data-open="1"]');
    expect(stored().saved.big.initialSeed).toBe(seed);
    expect(stored().live.big.seed).toBe(predictChain(seed, "big", 1)[0].nextSeed);
    expect($("#open-status").textContent).toContain("1 opening tracked");
    dispatch('.open-btn[data-open="1"]');
    expect($("#open-status").textContent).toContain("2 openings tracked");
  });

  it("restores the demo label and active tool, preserving each tool's chosen chest", async () => {
    await init(restored({ ui: { filename: DEMO_FILENAME, tab: "find", cardId: "big", findCardId: "egg_Rare" } }));
    expect($("#session-label").dataset.demo).toBe("true");
    expect($("#panel-find").classList.contains("is-hidden")).toBe(false);
    expect($("#current-chest-name").textContent).toBe("Rare Egg");
    const tabKey = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    $("#nav-find").dispatchEvent(tabKey);
    expect(tabKey.defaultPrevented).toBe(false);
    expect(stored().ui.tab).toBe("find");
    const description = $("#current-chest-description").textContent;
    dispatch("#nav-predict");
    expect(stored().ui.tab).toBe("predict");
    expect($("#current-chest-name").textContent).toBe("Big Box");
    expect($("#sidebar-find-list").parentElement.classList.contains("is-hidden")).toBe(true);
    dispatch("#nav-find");
    expect(stored().ui.tab).toBe("find");
    expect($("#current-chest-name").textContent).toBe("Rare Egg");
    expect($("#current-chest-description").textContent).toBe(description);
    expect(stored().ui).toMatchObject({ cardId: "big", findCardId: "egg_Rare" });
  });

  it.each(["success", "error"])("keeps a newly selected demo when an older file read ends with %s", async (result) => {
    const readers = [];
    vi.stubGlobal("FileReader", class {
      constructor() { readers.push(this); }
      readAsText() {}
    });
    await init();
    Object.defineProperty($("#save"), "files", { configurable: true, value: [new File([""], "pending.json")] });
    dispatch("#save", "change");
    expect($("#import-status").textContent).toContain("Reading pending.json");
    dispatch("#load-demo");
    if (result === "success") readers[0].onload({ target: { result: JSON.stringify(savegame()) } });
    else readers[0].onerror();
    await Promise.resolve();
    await Promise.resolve();
    expect(stored().saved).toEqual(createDemoSave());
    expect($("#user-filename").textContent).toBe(DEMO_FILENAME);
    expect($("#session-label").dataset.demo).toBe("true");
    expect($("#import-status").textContent).toBe("");
    expect($("#workspace-status").textContent).toBe("");
  });

  it("keeps an existing preview and tracked progress when a replacement file is invalid", async () => {
    await init(restored());
    dispatch('.open-btn[data-open="1"]');
    const session = stored();
    const preview = $("#out").innerHTML;
    await upload("{}", "invalid.json");
    expect($("#workspace-status .error-box").textContent).toContain("Choose a valid save file");
    expect($("#out").innerHTML).toBe(preview);
    expect(stored()).toEqual(session);
    expect($("#save").value).toBe("");
    await upload(JSON.stringify(savegame()), "fixed.json");
    expect($("#workspace-status").textContent).toBe("");
    expect($("#session-label").dataset.demo).toBe("false");
    expect(stored().live.big.opened).toBe(0);
  });

  it("filters by friendly item name and rarity without losing selected targets", async () => {
    await init(restored());
    chest("egg_Rare", "find");
    target("Pet_GoldenRetriever");
    input("#item-search", "cat", "input");
    expect($("#find-items").querySelectorAll(".item-chip")).toHaveLength(1);
    expect($("#find-items .item-chip").dataset.baseName).toBe("Pet_HouseCat");
    expect(stored().targets.egg_Rare).toEqual(["Pet_GoldenRetriever"]);
    expect($("#find-run").disabled).toBe(false);
    input("#item-search", "", "input");
    expect($('#find-items [data-base-name="Pet_GoldenRetriever"]').getAttribute("aria-pressed")).toBe("true");
    chest("big", "find");
    input("#rarity-filter", "common");
    expect($("#find-items").querySelectorAll(".item-chip").length).toBeGreaterThan(0);
    expect([...$("#find-items").querySelectorAll(".item-chip")].every((chip) => chip.dataset.rarity === "Common")).toBe(true);
    input("#item-search", "no such item", "input");
    expect($("#find-items").querySelectorAll(".item-chip")).toHaveLength(0);
    chest("egg_Rare", "find");
    expect($("#item-search").value).toBe("");
    expect($("#rarity-filter").value).toBe("all");
    expect($('#find-items [data-base-name="Pet_GoldenRetriever"]').getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps an in-progress search and its completed route when only display filters change", async () => {
    await init(restored({ ui: { findCardId: "egg_Rare" } }));
    target("Pet_GoldenRetriever");
    const pending = deferred();
    findModule.findItemLinearAsync.mockReturnValueOnce(pending.promise);
    dispatch("#find-run");
    const options = findModule.findItemLinearAsync.mock.calls[0][3];
    input("#item-search", "cat", "input");
    expect(options.shouldStop()).toBe(false);
    expect($("#find-run").disabled).toBe(true);
    pending.resolve(await realFind.findItemLinearAsync(42, "egg_Rare", ["Pet_GoldenRetriever"], { vaultPercentage: 0 }));
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    const action = $("#find-out button");
    input("#item-search", "retriever", "input");
    expect($("#find-out button")).toBe(action);
    expect(stored().targets.egg_Rare).toEqual(["Pet_GoldenRetriever"]);
    action.click();
    expect(stored().live.egg_Rare.opened).toBeGreaterThan(0);
  });

  it("clears prior selections and filters when replacing a demo with a real save", async () => {
    await init();
    dispatch("#load-demo");
    chest("egg_Rare", "find");
    target("Pet_GoldenRetriever");
    input("#item-search", "retriever", "input");
    input("#rarity-filter", "epic");
    await upload();
    expect(stored().targets).toEqual({});
    expect($("#item-search").value).toBe("");
    expect($("#rarity-filter").value).toBe("all");
    expect($("#session-label").dataset.demo).toBe("false");
    expect(stored().ui.tab).toBe("predict");
    expect($("#current-chest-name").textContent).toBe("Big Box");
  });

  it("resets the visible Find chest while preserving the other tool's progress", async () => {
    const state = restored({ ui: { tab: "find", cardId: "big", findCardId: "egg_Rare" } });
    state.live.big = { seed: 123, opened: 1, history: [] };
    state.live.egg_Rare = { seed: 456, opened: 2, history: [] };
    await init(state);
    dispatch("#reset");
    expect(stored().live.egg_Rare).toMatchObject({ seed: 42, opened: 0, history: [] });
    expect(stored().live.big).toMatchObject({ seed: 123, opened: 1 });
    expect($("#current-chest-name").textContent).toBe("Rare Egg");
    expect($("#find-out .find-guidance")).not.toBeNull();
  });

  it("leaves guest state intact when navigation or filters are used before loading", async () => {
    await init();
    dispatch("#nav-find");
    input("#item-search", "cat", "input");
    input("#rarity-filter", "rare");
    dispatch("#reset");
    expect($("#find-out").textContent).toContain("Load a save file");
    expect(stored()).toBeNull();
    expect($("#workspace").classList.contains("is-hidden")).toBe(true);
  });
});

describe("account and import controls", () => {
  it.each(["success", "error"])("uses only the latest selected file when an older read finishes with %s", async (result) => {
    const readers = [];
    vi.stubGlobal("FileReader", class {
      constructor() { readers.push(this); }
      readAsText() {}
    });
    await init();
    const selectFile = (name) => {
      Object.defineProperty($("#save"), "files", { configurable: true, value: [new File([""], name)] });
      dispatch("#save", "change");
    };
    selectFile("first.json");
    selectFile("second.json");
    const newer = savegame();
    newer.Data.GameSavegame.CharacterSavegame.EquipmentChestSavegames[0].Seed = 99;
    readers[1].onload({ target: { result: JSON.stringify(newer) } });
    await vi.waitFor(() => expect($("#user-filename").textContent).toBe("second.json"));
    if (result === "success") readers[0].onload({ target: { result: JSON.stringify(savegame()) } });
    else readers[0].onerror();
    await Promise.resolve();
    expect(stored().saved.big.initialSeed).toBe(99);
    expect($("#user-filename").textContent).toBe("second.json");
  });

  it("wires native load buttons and synchronizes expanded state and menu focus", async () => {
    await init(restored());
    const fileClick = vi.spyOn($("#save"), "click").mockImplementation(() => {});
    $("#welcome-load-save").click();
    expect(fileClick).toHaveBeenCalledTimes(1);
    $("#load-save").click();
    expect(fileClick).toHaveBeenCalledTimes(2);
    $("#user-menu-trigger").click();
    expect($("#user-menu-trigger").getAttribute("aria-expanded")).toBe("true");
    $("#load-save-menu").focus();
    $("#load-save-menu").click();
    expect(fileClick).toHaveBeenCalledTimes(3);
    expect($("#user-menu-trigger").getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe($("#user-menu-trigger"));
    $("#user-menu-trigger").click();
    $("#load-save-menu").focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement).toBe($("#user-menu-trigger"));
    const head = $(".channel-category-head");
    head.click();
    expect(head.getAttribute("aria-expanded")).toBe("false");
    head.click();
    expect(head.getAttribute("aria-expanded")).toBe("true");
  });
});

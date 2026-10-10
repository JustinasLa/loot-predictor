// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import html from "../index.html?raw";
import { parseSavegame } from "../src/save/parse.js";
import { predictChain } from "../src/loot/simulate.js";
import { savegame, item, step } from "./fixtures.js";

vi.mock("../src/solver/xp-path.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findOptimalXpPath: vi.fn(actual.findOptimalXpPath) };
});
vi.mock("../src/solver/find-items.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findAllPaths: vi.fn(actual.findAllPaths), findItemLinear: vi.fn(actual.findItemLinear) };
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
  const button = [...$(`#sidebar-${tab}-list`).children].find((button) => button.querySelectorAll("span")[1].textContent === id);
  button.click();
}
function target(baseName) {
  [...$("#find-items").children].find((chip) => chip.firstElementChild.textContent === baseName).click();
}
async function init(state) {
  if (state !== undefined) localStorage.setItem(KEY, JSON.stringify(state));
  await import("../src/app.js");
}
async function upload(text = JSON.stringify(savegame()), name = "synthetic.json") {
  Object.defineProperty($("#save"), "files", { configurable: true, value: [new File([text], name, { type: "application/json" })] });
  dispatch("#save", "change");
  await vi.waitFor(() => expect($("#user-filename").textContent === name || $("#out .error-box")).toBeTruthy());
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
  findModule.findAllPaths.mockReset().mockImplementation(realFind.findAllPaths);
  findModule.findItemLinear.mockReset().mockImplementation(realFind.findItemLinear);
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
    expect($("#out").textContent).toContain("load a savegame first");
  });

  it("loads a save, advances the live seed, resets it and persists the baseline", async () => {
    await init();
    await upload();
    expect($("#user-panel-guest").classList.contains("is-hidden")).toBe(true);
    expect($("#user-filename").title).toBe("synthetic.json");
    expect($("#out .open-title").textContent).toContain("big");
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
    expect($("#out").children).toHaveLength(5);
  });

  it("caps a custom opening batch at 10000", async () => {
    vi.spyOn(await import("../src/ui/render.js"), "renderHistory").mockImplementation(() => {});
    await init(restored({ ui: { cardId: "egg_Rare", count: "1" } }));
    input("#open-custom", 10001);
    dispatch("#open-custom-go");
    expect(stored().live.egg_Rare.opened).toBe(10000);
    expect(stored().live.egg_Rare.history).toHaveLength(100);
  });

  it("reports parsing and file-reader errors", async () => {
    await init();
    await upload("{}");
    expect($("#out").textContent).toContain("not a valid savegame");
    class UnreadableFile { readAsText() { this.onerror(); } }
    vi.stubGlobal("FileReader", UnreadableFile);
    await upload("{}", "unreadable.json");
    expect($("#out").textContent).toContain("couldnt read file");
  });

  it("rejects a save with no mapped chests", async () => {
    await init();
    await upload('{"GameSavegame":{}}');
    expect($("#out").textContent).toContain("no supported chests or eggs");
    expect($("#sidebar-predict-list").children).toHaveLength(0);
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
    expect($("#out .open-title").textContent).toContain("big");
    expect($("#user-filename").textContent).toBe("savegame");
  });

  it("handles a restored empty session and unloads storage", async () => {
    await init({ saved: {}, live: {}, ui: {} });
    expect($("#out").textContent).toContain("load a savegame first");
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

  it.each([[0, 0, "instant"], [10, 100, "s"], [12, 100, "min"], [14, 100, "h"]])("estimates search cost for %i openings at max level %i", async (opens, level, unit) => {
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
    expect($("#xp-status").textContent).toContain("paths in");
    $("#xp-out button").click();
    expect(stored().live.adventure_Zeus.opened).toBe(1);
    expect($("#xp-out").textContent).toContain("1 of 2 opened");
    $("#xp-out button").click();
    expect($("#xp-out").textContent).toContain("path done");
    chest("big");
    expect($("#xp-out").textContent).toBe("");
    expect($("#xp-status").textContent).toBe("");
  });

  it("stops a running XP search and restores controls after a search error", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    xpModule.findOptimalXpPath.mockImplementationOnce(async (opts) => {
      opts.onProgress(2);
      expect($("#xp-status").textContent).toContain("depth 2");
      dispatch("#xp-stop");
      expect(opts.shouldStop()).toBe(true);
      return { path: [], xp: 0, nodesVisited: 2 };
    });
    dispatch("#xp-search");
    await vi.waitFor(() => expect($("#xp-status").textContent).toContain("stopped early"));
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
    expect($("#xp-out").textContent).toContain("2-open limit");
    expect($("#xp-out").textContent).toContain("key(s) refunded");
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
    expect($("#find-status").textContent).toContain("opens in");
    $("#find-out button").click();
    expect(stored().live.egg_Rare.seed).toBe(302596119);
    expect($("#find-out").textContent).toContain("got all targets");
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
    expect($("#find-out").textContent).toContain("got all targets");
  });

  it("searches an adventure route and forwards stopping and fallback options", async () => {
    await init(restored({ ui: { findCardId: "adventure_Zeus" } }));
    target("Ring_Bronze");
    input("#find-maxlevel", 0);
    input("#find-maxdepth", 0);
    findModule.findAllPaths.mockImplementationOnce((opts) => {
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
    expect($("#find-out").textContent).toContain("load a savegame first");
    await upload();
    dispatch("#find-run");
    expect($("#find-out").textContent).toContain("pick at least one item");
    target("Hat_Cashier");
    findModule.findItemLinear.mockImplementationOnce(() => { throw new Error("hunt failed"); });
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
    findModule.findAllPaths.mockReturnValueOnce({ found: false, maxDepth: 10 });
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-status").textContent).toContain("0 opens in"));
    expect(findModule.findAllPaths).toHaveBeenCalledWith(expect.objectContaining({ maxLevel: 1 }));
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

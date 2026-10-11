// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/solver/xp-path.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findOptimalXpPath: vi.fn(actual.findOptimalXpPath) };
});
vi.mock("../../src/solver/find-items.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findAllPathsAsync: vi.fn(actual.findAllPathsAsync), findItemLinearAsync: vi.fn(actual.findItemLinearAsync) };
});

import {
  $, $$, KEY, stored, dispatch, input, chest, target, markOpened, init, upload, restored,
  deferred, xpRoute, eggRoute, setupApp, xpModule, findModule, realFind,
} from "../helpers/app-harness.js";

setupApp();

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
    expect($("#find-out").textContent).toContain("All found!");
    expect($("#find-selected").textContent).toBe("");
  });

  it("reruns a hunt after committing only part of the target route", async () => {
    await init(restored({ ui: { cardId: "egg_Rare" } }));
    target("Pet_GoldenRetriever");
    target("Pet_HouseCat");
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    $("#find-out button").click();
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    expect(stored().targets.egg_Rare).toEqual(["Pet_HouseCat"]);
    $("#find-out button").click();
    expect($("#find-out").textContent).toContain("All found!");
  });

  it("searches an adventure route and forwards stopping and fallback options", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
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
    const state = restored({ ui: { cardId: "adventure_Zeus" } });
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
    await init(restored({ ui: { cardId: "egg_Rare" } }));
    target("Pet_GoldenRetriever");
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-out button")).not.toBeNull());
    const pendingAction = $("#find-out button");
    await upload('{"GameSavegame":{"CharacterSavegame":{"EquipmentChestSavegames":[{"ChestId":1,"Seed":99}]}}}', "replacement.json");
    pendingAction.click();
    expect(stored().live.big.seed).toBe(99);
    expect(stored().live.egg_Rare).toBeUndefined();
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
    await init(restored({ ui: { cardId: "egg_Rare" } }));
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

});

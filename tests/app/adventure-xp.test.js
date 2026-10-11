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

import { step } from "../fixtures.js";

setupApp();

describe("adventure preview and XP UI", () => {
  it.each([[1, 1, "Instant"], [10, 100, "seconds"], [12, 100, "minutes"], [14, 100, "hours"]])("estimates search cost for %i openings at max level %i", async (opens, level, unit) => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input("#xp-maxlevel", level, "input");
    input("#xp-openings", opens, "input");
    expect($("#xp-estimate").textContent).toContain(unit);
    if (opens >= 12) expect($("#xp-estimate").textContent).toContain("· may be slow");
    if (opens === 1) expect($("#xp-estimate").dataset.heavy).toBe("no");
    if (opens >= 12) expect($("#xp-estimate").dataset.heavy).toBe("yes");
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
      expect($("#xp-status").textContent).toBe("Planning… · 2 opens deep");
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

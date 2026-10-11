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

import { predictChain } from "../../src/loot/simulate.js";
import { step } from "../fixtures.js";

setupApp();

describe("search lifecycle and route safety", () => {
  it.each(["open", "reset", "seed", "vault", "xp-vault", "openings", "level", "cap", "switch", "import"])("invalidates XP routes after %s and ignores their detached buttons", async (action) => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    await xpRoute();
    const obsolete = $("#xp-out button");
    if (action === "open") markOpened(1);
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
    await init(restored({ ui: { cardId: "egg_Rare", cardId: "egg_Rare" } }));
    await eggRoute();
    const obsolete = $("#find-out button");
    if (action === "open") markOpened(1);
    if (action === "reset") dispatch("#reset");
    if (action === "seed") input("#seed", 123);
    if (action === "vault") input("#vault", 25);
    if (action === "targets") target("Pet_HouseCat");
    if (action === "switch") chest("big", "find");
    if (action === "import") await upload();
    const before = stored().live;
    expect($("#find-out .find-found")).toBeNull();
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
    expect($("#history .open-title").textContent).toContain("Opened #101");
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
    await init(restored({ ui: { cardId: "egg_Rare", cardId: "egg_Rare" } }));
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
    await init(restored({ ui: { cardId: "egg_Rare" } }));
    target("Pet_GoldenRetriever");
    const pending = deferred();
    findModule.findItemLinearAsync.mockReturnValueOnce(pending.promise);
    dispatch("#find-run");
    chest("big", "find");
    pending.resolve({ found: false, opens: 0, missing: ["Pet_GoldenRetriever"] });
    await Promise.resolve();
    expect($("#find-out").textContent).toBe("");
  });

  it("reports a bounded Find search as incomplete and forwards current progress", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    target("Ring_Bronze");
    findModule.findAllPathsAsync.mockImplementationOnce(async (options) => {
      options.onProgress(12);
      expect($("#find-status").textContent).toContain("12 checked");
      return { found: false, maxDepth: 10, nodesVisited: 12, truncated: true };
    });
    dispatch("#find-run");
    await vi.waitFor(() => expect($("#find-out").textContent).toBe("Hit the search limit."));
    expect($("#find-status").textContent).toBe("");
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
    await vi.waitFor(() => expect($("#xp-out").textContent).toBe("No plan found. Try more keys or a higher level."));
    expect($("#xp-status").textContent).toBe("");
    expect($("#xp-search").disabled).toBe(false);
  });

  it("cancels old Find runs without releasing a newer run's controls", async () => {
    await init(restored({ ui: { cardId: "egg_Rare" } }));
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
    await vi.waitFor(() => expect($("#find-out").textContent).toBe("Stopped."));
    expect($("#find-run").disabled).toBe(false);
  });

  it("preserves edited search levels during refresh and item toggles, and resets them on chest switches", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus", cardId: "adventure_Zeus" } }));
    input("#xp-maxlevel", 4, "input");
    input("#find-maxlevel", 4);
    input("#vault", 12.5);
    target("Ring_Bronze");
    target("Ring_Bronze");
    markOpened(1);
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
    expect($("#xp-out .xp-versus").title).toContain("in 1 opening");
  });

  it("bounds a stopped search's baseline by its partial path instead of the requested budget", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    input("#xp-openings", 1000000000000, "input");
    input("#xp-maxlevel", 4, "input");
    const simulation = await import("../../src/loot/simulate.js");
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
    expect($("#xp-out .xp-versus").title).toContain("in 1 opening");
    expect($("#xp-out .xp-warn").textContent).toBe("Stopped early");
    expect($("#xp-retry")).not.toBeNull();
  });
});

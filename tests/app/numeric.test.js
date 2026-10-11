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

setupApp();

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
    dispatch('.open-btn[data-open="5"]');
    expect(stored().live.big.opened).toBe(5);
    expect(stored().live.big.seed).toBe(predictChain(42, "big", 5)[4].nextSeed);
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
    dispatch('.open-btn[data-open="5"]');
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
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    target("Ring_Bronze");
    input(selector, value);
    dispatch("#find-run");
    expect(findModule.findAllPathsAsync).not.toHaveBeenCalled();
    expect($("#find-out .error-box")).not.toBeNull();
    expect($("#find-run").disabled).toBe(false);
  });
});

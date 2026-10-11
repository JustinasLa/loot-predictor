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

import { $, KEY, stored, dispatch, markOpened, init, restored, setupApp } from "../helpers/app-harness.js";

setupApp();

const escape = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

describe("save menu", () => {
  it("opens as a sheet and closes on actions, the backdrop, the X and Escape", async () => {
    await init(restored());
    const menu = $("#user-menu");
    const trigger = $("#user-menu-trigger");
    dispatch("#user-menu-trigger");
    expect(menu.classList.contains("is-hidden")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    dispatch("#user-menu-trigger");
    expect(menu.classList.contains("is-hidden")).toBe(true);
    dispatch("#user-menu-trigger");
    $("#user-menu .sheet").click();
    expect(menu.classList.contains("is-hidden")).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    expect(menu.classList.contains("is-hidden")).toBe(false);
    escape();
    expect(menu.classList.contains("is-hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
    dispatch("#user-menu-trigger");
    dispatch("#reset");
    expect(menu.classList.contains("is-hidden")).toBe(true);
    dispatch("#user-menu-trigger");
    $("#user-menu .sheet-backdrop").click();
    expect(menu.classList.contains("is-hidden")).toBe(true);
    dispatch("#user-menu-trigger");
    $("#user-menu .sheet-close").click();
    expect(menu.classList.contains("is-hidden")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("returns focus to the trigger after loading another save", async () => {
    await init(restored());
    vi.spyOn($("#save"), "click").mockImplementation(() => {});
    $("#user-menu-trigger").click();
    expect(document.activeElement).toBe($("#user-menu .sheet-close"));
    $("#load-save-menu").click();
    expect($("#user-menu-trigger").getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe($("#user-menu-trigger"));
  });

  it("resets only the selected box", async () => {
    const state = restored({ ui: { tab: "find", cardId: "egg_Rare" } });
    state.live.big = { seed: 123, opened: 1, history: [] };
    state.live.egg_Rare = { seed: 456, opened: 2, history: [] };
    await init(state);
    dispatch("#reset");
    expect(stored().live.egg_Rare).toMatchObject({ seed: 42, opened: 0, history: [] });
    expect(stored().live.big).toMatchObject({ seed: 123, opened: 1 });
    expect($("#current-chest-name").textContent).toBe("Rare Egg");
    expect($("#find-out .find-guidance")).not.toBeNull();
  });

  it("removes the save from this device", async () => {
    await init(restored());
    markOpened(1);
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    dispatch("#unload");
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });
});

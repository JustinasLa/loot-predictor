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
    dispatch("#reset-ask");
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

  it("asks before resetting, and Cancel keeps everything", async () => {
    await init(restored());
    markOpened(1);
    const trigger = $("#user-menu-trigger");
    trigger.click();
    const ask = $("#reset-ask");
    expect(ask.textContent).toBe("Reset this box");
    ask.click();
    expect($("#save-menu-actions").classList.contains("is-hidden")).toBe(true);
    expect($("#reset-confirm").classList.contains("is-hidden")).toBe(false);
    expect($("#unload-confirm").classList.contains("is-hidden")).toBe(true);
    expect(ask.getAttribute("aria-expanded")).toBe("true");
    expect($("#reset-confirm").textContent.replace(/\s+/g, " ").trim()).toBe("Back to your save? Opened list clears. Reset Cancel");
    expect(document.activeElement).toBe($("#reset-cancel"));
    $("#reset-cancel").click();
    expect($("#save-menu-actions").classList.contains("is-hidden")).toBe(false);
    expect($("#reset-confirm").classList.contains("is-hidden")).toBe(true);
    expect(ask.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(ask);
    expect(stored().live.big.opened).toBe(1);

    ask.click();
    $("#reset").click();
    expect($("#user-menu").classList.contains("is-hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(stored().live.big).toMatchObject({ opened: 0, history: [] });
    expect($("#toast-region").textContent).toBe("Box reset.");
  });

  it("shows the menu buttons again when it reopens after Escape mid-confirm", async () => {
    await init(restored());
    dispatch("#user-menu-trigger");
    dispatch("#unload-ask");
    expect($("#unload-confirm").classList.contains("is-hidden")).toBe(false);
    escape();
    dispatch("#user-menu-trigger");
    expect($("#unload-confirm").classList.contains("is-hidden")).toBe(true);
    expect($("#save-menu-actions").classList.contains("is-hidden")).toBe(false);
    expect($("#unload-ask").getAttribute("aria-expanded")).toBe("false");
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
    expect($("#find-out").textContent).toBe("");
  });

  it("asks before resetting, can cancel and confirms with a toast", async () => {
    vi.useFakeTimers();
    try {
      await init(restored());
      markOpened(2);
      const shown = (selector) => !$(selector).classList.contains("is-hidden");
      dispatch("#user-menu-trigger");
      expect(shown("#save-menu-actions")).toBe(true);
      expect(shown("#reset-confirm")).toBe(false);
      expect($("#reset-ask").textContent).toBe("Reset this box");
      expect($("#reset-ask").classList.contains("btn--ghost")).toBe(true);
      expect($("#load-save-menu").classList.contains("btn--primary")).toBe(true);
      expect($("#unload-ask").classList.contains("btn--danger")).toBe(true);

      $("#reset-ask").click();
      expect(shown("#user-menu")).toBe(true);
      expect(shown("#save-menu-actions")).toBe(false);
      expect(shown("#reset-confirm")).toBe(true);
      expect($("#reset-confirm").textContent).toContain("Back to your save? Opened list clears.");
      expect($("#reset").textContent).toBe("Reset");
      expect($("#reset").classList.contains("btn--go")).toBe(true);
      expect($("#reset-ask").getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe($("#reset-cancel"));

      $("#reset-cancel").click();
      expect(shown("#save-menu-actions")).toBe(true);
      expect(shown("#reset-confirm")).toBe(false);
      expect($("#reset-ask").getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe($("#reset-ask"));
      expect(stored().live.big.opened).toBe(2);

      $("#reset-ask").click();
      $("#reset").click();
      expect(shown("#user-menu")).toBe(false);
      expect(document.activeElement).toBe($("#user-menu-trigger"));
      expect(stored().live.big).toMatchObject({ seed: 42, opened: 0, history: [] });
      expect($("#toast-region").textContent).toBe("Box reset.");

      // A confirm left open is gone the next time the menu opens.
      dispatch("#user-menu-trigger");
      $("#reset-ask").click();
      escape();
      dispatch("#user-menu-trigger");
      expect(shown("#save-menu-actions")).toBe(true);
      expect(shown("#reset-confirm")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks before removing the save and can cancel", async () => {
    await init(restored());
    markOpened(1);
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    dispatch("#user-menu-trigger");
    $("#unload-ask").click();
    expect($("#unload-confirm").classList.contains("is-hidden")).toBe(false);
    expect($("#reset-confirm").classList.contains("is-hidden")).toBe(true);
    expect($("#unload-confirm").textContent).toContain("Remove your save from this device?");
    expect($("#unload").textContent).toBe("Remove");
    expect($("#unload").classList.contains("btn--danger")).toBe(true);
    expect(document.activeElement).toBe($("#unload-cancel"));
    $("#unload-cancel").click();
    expect($("#unload-confirm").classList.contains("is-hidden")).toBe(true);
    expect(document.activeElement).toBe($("#unload-ask"));
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(reload).not.toHaveBeenCalled();
    $("#unload-ask").click();
    $("#unload").click();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("removes the save from this device", async () => {
    await init(restored());
    markOpened(1);
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    dispatch("#user-menu-trigger");
    dispatch("#unload-ask");
    expect($("#unload-confirm").textContent.replace(/\s+/g, " ").trim()).toBe("Remove your save from this device? Remove Cancel");
    expect(document.activeElement).toBe($("#unload-cancel"));
    dispatch("#unload-cancel");
    expect(document.activeElement).toBe($("#unload-ask"));
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(reload).not.toHaveBeenCalled();
    dispatch("#unload-ask");
    dispatch("#unload");
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });
});

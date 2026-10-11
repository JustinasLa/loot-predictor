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

import { $, stored, dispatch, init, restored, setupApp } from "../helpers/app-harness.js";
import { DEMO_FILENAME } from "../../src/ui/demo.js";

setupApp();

describe("session restore", () => {
  it("restores the selected box, seeds, targets and UI values", async () => {
    const state = restored({ targets: { egg_Rare: ["Pet_HouseCat"] }, ui: { cardId: "adventure_Pirate", count: "2", vault: "10", filename: "old.json" } });
    state.live.adventure_Pirate.seed = 321;
    await init(state);
    expect($("#seed").value).toBe("321");
    expect($("#out").children).toHaveLength(2);
    expect($("#vault").value).toBe("10");
    expect($("#user-filename").textContent).toBe("old.json");
    expect($("#session-label").textContent).toBe("My save");
    expect($("#demo-banner").classList.contains("is-hidden")).toBe(true);
    expect(stored().targets.egg_Rare).toEqual(["Pet_HouseCat"]);
    expect(stored().ui).toMatchObject({ cardId: "adventure_Pirate", count: "2", vault: "10", filename: "old.json", tab: "predict" });
  });

  it.each([undefined, { cardId: "gone" }, { cardId: "", count: "", vault: "", filename: "" }])("falls back from incomplete UI preferences: %j", async (ui) => {
    await init(restored({ ui }));
    expect($("#current-chest-name").textContent).toBe("Big Box");
    expect($("#user-filename").textContent).toBe("savegame");
  });

  it("restores the demo label, the active tool and the box screen", async () => {
    await init(restored({ ui: { filename: DEMO_FILENAME, tab: "find", cardId: "egg_Rare" } }));
    expect($("#session-label").dataset.demo).toBe("true");
    expect($("#session-label").textContent).toBe("Demo");
    expect($("#user-filename").textContent).toBe("Demo save");
    expect($("#demo-banner").classList.contains("is-hidden")).toBe(false);
    expect($("#panel-find").classList.contains("is-hidden")).toBe(false);
    expect($("#current-chest-name").textContent).toBe("Rare Egg");
    expect($("#workspace").dataset.screen).toBe("box");
    expect(location.hash).toBe("#box");
    expect(document.body.dataset.loaded).toBe("yes");
  });

  it("rejects an empty cached session and stays on the Start screen", async () => {
    await init({ saved: {}, live: {}, ui: {} });
    expect($("#seed").disabled).toBe(true);
    expect($("#box-rail-list").querySelectorAll("[data-card-id]")).toHaveLength(0);
    expect($("#welcome-screen").classList.contains("is-hidden")).toBe(false);
    expect($("#user-panel-loggedin").classList.contains("is-hidden")).toBe(true);
    expect($("#session-label").classList.contains("is-hidden")).toBe(true);
  });

  it("initializes guest controls and ignores an empty file selection", async () => {
    await init();
    expect($("#seed").disabled).toBe(true);
    dispatch("#save", "change");
    expect(stored()).toBeNull();
    dispatch("#count", "change");
    expect($("#out").textContent).toContain("Load a save file");
  });
});

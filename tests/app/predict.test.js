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

import { $, stored, dispatch, input, chest, markOpened, init, upload, restored, setupApp } from "../helpers/app-harness.js";
import { savegame } from "../fixtures.js";

setupApp();

describe("Next tab", () => {
  it("shows one card per preview count with I opened it! first", async () => {
    await init(restored());
    expect($("#out").children).toHaveLength(5);
    expect($("#out .open-box").classList.contains("is-next")).toBe(true);
    expect($("#out .open-title").textContent).toBe("Next box");
    expect($("#out .open-card-btn").textContent).toBe("I opened it!");
    expect($("#out").querySelectorAll(".open-card-btn")[1].textContent).toBe("Opened up to here");
  });

  it("shows 5 more boxes up to the cap", async () => {
    await init(restored());
    dispatch("#show-more");
    expect($("#out").children).toHaveLength(10);
    expect($("#count").value).toBe("10");
    input("#count", 197);
    dispatch("#show-more");
    expect($("#count").value).toBe("200");
    expect($("#out").children).toHaveLength(200);
    expect($("#show-more").disabled).toBe(true);
    expect($("#show-more").textContent).toBe("That's all");
    $("#count").value = "";
    dispatch("#show-more");
    expect($("#count").value).toBe("5");
    expect($("#show-more").textContent).toBe("Show 5 more");
  });

  it("previews the selected box's level immediately and preserves edits while opening", async () => {
    await init(restored());
    chest("adventure_Zeus");
    expect($("#preview-level").value).toBe("5");
    input("#preview-level", 1, "input");
    markOpened(1);
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

  it("steps the level with the stepper buttons", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    $('[data-step-for="preview-level"][data-step="1"]').click();
    expect($("#preview-level").value).toBe("6");
    expect($("#out .open-subtitle").textContent).toBe("Zeus' Feast · Level 6");
  });

  it("resets the preview level when another save replaces the same adventure box", async () => {
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
});

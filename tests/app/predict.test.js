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
    // The ribbon says NEXT; the title is for screen readers only.
    expect($("#out .open-title").textContent).toBe("Next box");
    expect($("#out .open-title").classList.contains("sr-only")).toBe(true);
    expect($("#out .open-card-btn").textContent).toBe("I opened it!");
    expect($("#out").querySelectorAll(".open-card-btn")[1].textContent).toBe("I opened up to #2");
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
  }, 30000);

  it("keeps Show 5 more below the cards, outside #out, as a full-width button", async () => {
    await init(restored());
    const more = $("#show-more");
    expect($("#out").contains(more)).toBe(false);
    expect(more.classList.contains("btn--primary")).toBe(true);
    expect(more.classList.contains("btn--block")).toBe(true);
    expect($("#out").compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect($("#open-status").getAttribute("role")).toBe("status");
    expect($("#open-status").classList.contains("sr-only")).toBe(true);
  });

  it("sets how many boxes to show with the Boxes to show stepper", async () => {
    await init(restored());
    expect($("#count").labels[0].textContent).toBe("Boxes to show");
    expect($("#count").closest(".stepper")).not.toBeNull();
    expect($("#count").min).toBe("1");
    expect($("#count").max).toBe("200");
    const more = $('[data-step-for="count"][data-step="1"]');
    const less = $('[data-step-for="count"][data-step="-1"]');
    expect(more.getAttribute("aria-label")).toBe("Increase Boxes to show");
    expect(less.getAttribute("aria-label")).toBe("Decrease Boxes to show");
    more.click();
    expect($("#out").children).toHaveLength(6);
    less.click();
    less.click();
    expect($("#out").children).toHaveLength(4);
    expect($("#out").querySelectorAll(".open-card-btn")).toHaveLength(4);
  });

  it("hides seed details until Show seed details is switched on", async () => {
    await init(restored());
    const toggle = $("#show-details");
    expect(toggle.type).toBe("checkbox");
    expect(toggle.classList.contains("toggle")).toBe(true);
    expect(toggle.labels[0].textContent.trim()).toBe("Show seed details");
    expect(document.body.dataset.details).toBe("off");
    expect($("#out .prediction-details")).not.toBeNull();
    toggle.click();
    expect(document.body.dataset.details).toBe("on");
    toggle.click();
    expect(document.body.dataset.details).toBe("off");
  });

  it("folds the opened cards away and drops the ribbon on the new next box", async () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn(() => ({ matches: false }));
    try {
      await init(restored());
      const leaving = $(".out-leaving");
      expect(leaving.getAttribute("aria-hidden")).toBe("true");
      expect(leaving.hasAttribute("inert")).toBe(true);
      markOpened(3);
      expect($("#out").children).toHaveLength(5);
      expect($("#out .open-box").classList.contains("is-arriving")).toBe(true);
      expect(leaving.querySelectorAll(".open-box.is-collapsing")).toHaveLength(3);
      expect(leaving.querySelector("button")).toBeNull();
      vi.advanceTimersByTime(250);
      expect(leaving.children).toHaveLength(0);
    } finally {
      delete window.matchMedia;
      vi.useRealTimers();
    }
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
    expect($("#out .open-level").textContent).toBe("Lv 6");
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

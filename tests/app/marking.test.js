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

import { $, $$, stored, dispatch, input, markOpened, init, upload, restored, setupApp } from "../helpers/app-harness.js";
import { predictChain } from "../../src/loot/simulate.js";

setupApp();

describe("marking openings", () => {
  it("loads a save, advances the live seed, resets it and persists the baseline", async () => {
    await init();
    await upload();
    expect($("#user-filename").title).toBe("synthetic.json");
    expect($("#current-chest-name").textContent).toBe("Big Box");
    expect($("#open-status").textContent).toBe("Nothing opened yet.");
    const expected = predictChain(42, "big", 2);
    markOpened(2);
    expect(stored().live.big.seed).toBe(expected[1].nextSeed);
    expect(stored().saved.big.initialSeed).toBe(42);
    expect(stored().live.big.history.map((open) => open.open)).toEqual([2, 1]);
    expect($("#history-count").textContent).toBe("(2)");
    expect($("#history .open-title").textContent).toBe("Opened #2");
    dispatch("#user-menu-trigger");
    dispatch("#reset-ask");
    expect($("#reset-confirm").textContent).toContain("Back to your save? Opened list clears.");
    dispatch("#reset");
    expect(stored().live.big).toMatchObject({ seed: 42, opened: 0, history: [] });
    expect($("#toast-region").textContent).toBe("Box reset.");
    expect($("#history-count").textContent).toBe("");
    expect($("#history").textContent).toBe("Nothing opened yet.");
    expect($("#history .empty img").getAttribute("src")).toContain("SmallChestIcon");
  });

  it("marks many from Settings, then closes the sheet to show the cards and the toast", async () => {
    await init(restored());
    const trigger = $("#settings-trigger");
    const sheet = $("#settings-sheet");
    expect($("#mark-many-title").textContent).toBe("Mark many opened");
    expect($("#open-custom").labels[0].textContent).toBe("How many?");
    for (const button of document.querySelectorAll(".open-btn")) {
      expect(button.textContent).toMatch(/mark/i);
      expect(button.textContent).toContain(button.dataset.open);
    }
    trigger.click();
    expect(sheet.classList.contains("is-hidden")).toBe(false);
    dispatch('.open-btn[data-open="5"]');
    expect(sheet.classList.contains("is-hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect($("#toast-region").textContent).toBe("Got it! 5 opened.");
    expect($("#history-count").textContent).toBe("(5)");
    expect($("#open-status").textContent).toBe("5 opened so far.");

    trigger.click();
    dispatch('[data-step-for="open-custom"][data-step="1"]');
    expect($("#open-custom").value).toBe("26");
    dispatch("#open-custom-go");
    expect(sheet.classList.contains("is-hidden")).toBe(true);
    expect($("#toast-region").textContent).toBe("Got it! 26 opened.");
    expect(stored().live.big.opened).toBe(31);
    expect($$("#history .open-box.is-past")).toHaveLength(31);
    expect($("#history .open-title").textContent).toBe("Opened #31");
  });

  it("confirms each mark with a toast that hides itself", async () => {
    vi.useFakeTimers();
    try {
      await init(restored());
      markOpened(1);
      expect($("#toast-region").textContent).toBe("Got it! 1 opened.");
      dispatch('.open-btn[data-open="5"]');
      expect($("#toast-region").textContent).toBe("Got it! 5 opened.");
      expect($("#toast-region").children).toHaveLength(1);
      vi.advanceTimersByTime(2500);
      expect($("#toast-region").textContent).toBe("");
    } finally {
      vi.useRealTimers();
    }
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
    dispatch('.open-btn[data-open="10"]');
    expect(stored().live.big.opened).toBe(15);
    input("#count", 0);
    expect($("#out").textContent).toContain("preview count must be an integer");
  });

  it("caps a custom opening batch at 10000", async () => {
    await init(restored({ ui: { cardId: "egg_Rare", count: "1" } }));
    input("#open-custom", 10001);
    dispatch("#open-custom-go");
    expect(stored().live.egg_Rare.opened).toBe(10000);
    expect(stored().live.egg_Rare.history).toHaveLength(100);
    expect($("#history").querySelectorAll(".open-box")).toHaveLength(100);
    expect($("#history .open-title").textContent).toBe("Opened #10000");
    expect(stored().live.egg_Rare.seed).toBe(predictChain(42, "egg_Rare", 10000).at(-1).nextSeed);
  });
});

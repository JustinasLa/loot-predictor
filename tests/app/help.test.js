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

import { $, $$, init, setupApp } from "../helpers/app-harness.js";

setupApp();

describe("help sheet", () => {
  it("is available before a save loads and explains the flow in picture rows", async () => {
    await init();
    const trigger = $("#help-trigger");
    trigger.click();
    expect($("#help-sheet").classList.contains("is-hidden")).toBe(false);
    expect($("#help-title").textContent).toBe("How it works");
    expect($$(".help-row").map((row) => row.textContent.trim().replace(/\s+/g, " "))).toEqual([
      "Pick a box.",
      "See what comes out, in order.",
      "I opened it! Opened it in the game? Tap I opened it!",
      "Your save stays on this device.",
    ]);
    expect($("#help-sheet button:not(.sheet-close)")).toBeNull();
    trigger.click();
    expect($("#help-sheet").classList.contains("is-hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("uses real sprites with no step numbers and closes on Escape", async () => {
    await init();
    const trigger = $("#help-trigger");
    trigger.focus();
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect($("#help-sheet").contains(document.activeElement)).toBe(true);
    const sprites = $$("#help-sheet img").map((img) => img.getAttribute("src").split("/").pop());
    expect(sprites).toEqual(["BigChestIcon.webp", "Ring_Silver.webp", "Ring_Snake.webp"]);
    expect($$("#help-sheet .item-tile").map((tile) => tile.dataset.rarity)).toEqual(["Rare", "Legendary"]);
    expect($("#help-sheet ol")).toBeNull();
    expect($("#help-sheet .help-rows").textContent).not.toMatch(/\d/);
    expect($("#help-sheet .btn--mini").getAttribute("aria-hidden")).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect($("#help-sheet").classList.contains("is-hidden")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});


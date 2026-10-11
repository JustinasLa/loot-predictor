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

import { $, stored, dispatch, input, chest, target, markOpened, init, upload, setupApp } from "../helpers/app-harness.js";
import { predictChain } from "../../src/loot/simulate.js";
import { CHEST_ID_MAP, EGG_RARITY_MAP } from "../../src/loot/tables.js";
import { createDemoSave } from "../../src/ui/demo.js";

setupApp();

describe("Start screen", () => {
  it("shows one headline, two buttons and the privacy line before a save loads", async () => {
    await init();
    expect($("#welcome-screen").classList.contains("is-hidden")).toBe(false);
    expect($("#workspace").classList.contains("is-hidden")).toBe(true);
    expect($("#welcome-title").textContent).toBe("See what's in your next box.");
    expect($("#welcome-load-save").textContent.trim()).toBe("Load my save");
    expect($("#load-demo").textContent.trim()).toBe("Try demo");
    expect($(".welcome-lock").textContent.trim()).toBe("Your save stays on this device.");
    expect($("#help-trigger").closest(".is-hidden")).toBeNull();
    expect($("#user-panel-loggedin").classList.contains("is-hidden")).toBe(true);
  });

  it("uses the real chest art, short help copy and no decorations", async () => {
    await init();
    const welcome = $("#welcome-screen");
    expect(welcome.querySelector(".welcome-hero img").getAttribute("src")).toMatch(/assets\/items\/BigChestIcon\.webp$/);
    expect($("#welcome-load-save").className).toContain("btn--go");
    expect($("#load-demo").className).toContain("btn--primary");
    expect(welcome.querySelectorAll("#welcome-load-save, #load-demo")).toHaveLength(2);
    expect(welcome.querySelector(".welcome-help summary").textContent).toBe("What's a save file?");
    expect([...welcome.querySelectorAll(".welcome-help p")].map((p) => p.textContent)).toEqual([
      "It's your Eatventure save (.json). It's read here, never uploaded.",
      "No file? Tap Try demo.",
    ]);
    expect($(".app-footer").textContent).toBe("Fan-made. Not affiliated with Eatventure or Lessmore.");
    // Only the listed parts: no decorative extras.
    expect([...welcome.children].map((node) => node.className)).toEqual(["welcome-card panel", "app-footer"]);
    expect([...welcome.querySelector(".welcome-card").children].map((node) => node.className)).toEqual([
      "welcome-hero", "welcome-title", "welcome-actions action-bar", "import-status",
      "btn btn--primary btn--sm try-another is-hidden", "welcome-lock", "welcome-help",
    ]);
  });
});

describe("demo flow", () => {
  it("starts with a private demo and keeps tracked openings separate from its baseline", async () => {
    await init();
    dispatch("#load-demo");
    expect($("#welcome-screen").classList.contains("is-hidden")).toBe(true);
    expect($("#workspace").classList.contains("is-hidden")).toBe(false);
    expect($("#user-panel-loggedin").classList.contains("is-hidden")).toBe(false);
    expect($("#session-label").dataset.demo).toBe("true");
    expect($("#session-label").textContent).toBe("Demo");
    expect($("#demo-banner").classList.contains("is-hidden")).toBe(false);
    expect($("#user-filename").textContent).toBe("Demo save");
    expect($("#current-chest-name").textContent).toBe("Big Box");
    expect($("#workspace").dataset.screen).toBe("box");
    expect(document.activeElement).toBe($("#current-chest-name"));
    expect(stored().saved).toEqual(createDemoSave());
    expect($("#out .open-box").querySelectorAll(".item-row")).toHaveLength(6);
    const seed = stored().saved.big.initialSeed;
    markOpened(1);
    expect(stored().saved.big.initialSeed).toBe(seed);
    expect(stored().live.big.seed).toBe(predictChain(seed, "big", 1)[0].nextSeed);
    expect($("#open-status").textContent).toBe("1 opened so far.");
    markOpened(1);
    expect($("#open-status").textContent).toBe("2 opened so far.");
  });

  it("creates a fresh, deterministic example covering every supported box and egg", () => {
    const demo = createDemoSave();
    expect(Object.keys(demo)[0]).toBe("big");
    expect(Object.keys(demo).sort()).toEqual([...Object.values(CHEST_ID_MAP), ...Object.values(EGG_RARITY_MAP)].sort());
    expect(createDemoSave()).toEqual(demo);
    for (const [cardId, state] of Object.entries(demo)) {
      expect(Number.isInteger(state.initialSeed)).toBe(true);
      expect(predictChain(state.initialSeed, cardId, 1, { level: state.level })[0].items.length).toBeGreaterThan(0);
      if (cardId.startsWith("adventure_")) expect(state.level).toBe(25);
    }
    demo.big.initialSeed = 0;
    expect(createDemoSave().big.initialSeed).not.toBe(0);
  });

  it("clears prior selections and filters when replacing a demo with a real save", async () => {
    await init();
    dispatch("#load-demo");
    chest("egg_Rare", "find");
    target("Pet_GoldenRetriever");
    input("#item-search", "retriever", "input");
    input("#rarity-filter", "epic");
    await upload();
    expect(stored().targets).toEqual({});
    expect($("#item-search").value).toBe("");
    expect($("#rarity-filter").value).toBe("all");
    expect($('#rarity-chips [data-value="all"]').getAttribute("aria-pressed")).toBe("true");
    expect($("#session-label").dataset.demo).toBe("false");
    expect($("#demo-banner").classList.contains("is-hidden")).toBe(true);
    expect(stored().ui.tab).toBe("predict");
    expect($("#current-chest-name").textContent).toBe("Big Box");
  });

  it("leaves guest state intact when navigation or filters are used before loading", async () => {
    await init();
    dispatch("#nav-find");
    input("#item-search", "cat", "input");
    input("#rarity-filter", "rare");
    dispatch("#reset");
    expect($("#find-out").textContent).toContain("Load a save file");
    expect(stored()).toBeNull();
    expect($("#workspace").classList.contains("is-hidden")).toBe(true);
  });
});

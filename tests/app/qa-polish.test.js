// @vitest-environment jsdom
// Behaviour added in the QA polish pass: results scroll into view, the slim
// header on Find / XP, rarity chips per box, errors on the visible tab,
// browser history on reload and Undo.
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
  $, $$, stored, dispatch, input, chest, target, markOpened, init, upload, restored, setupApp, xpRoute, eggRoute,
} from "../helpers/app-harness.js";
import { reveal } from "../../src/app/dom.js";

setupApp();

describe("reveal", () => {
  it("does nothing where scrollIntoView is missing", () => {
    const node = document.createElement("div");
    node.scrollIntoView = undefined;
    expect(() => reveal(node)).not.toThrow();
  });

  it.each([
    [undefined, "smooth"],
    [false, "smooth"],
    [true, "auto"],
  ])("scrolls to the start, honouring reduced motion %s", (reduced, behavior) => {
    const node = document.createElement("div");
    node.scrollIntoView = vi.fn();
    const original = window.matchMedia;
    window.matchMedia = reduced === undefined ? undefined : vi.fn(() => ({ matches: reduced }));
    try {
      reveal(node);
    } finally {
      window.matchMedia = original;
    }
    expect(node.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior });
  });
});

describe("QA polish", () => {
  it("scrolls Find and XP results into view once they render", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    try {
      await init(restored({ ui: { cardId: "egg_Rare", tab: "find" } }));
      await eggRoute();
      expect(scroll.mock.contexts.at(-1)).toBe($("#find-out"));
      chest("adventure_Zeus", "xp");
      await xpRoute();
      expect(scroll.mock.contexts.at(-1)).toBe($("#xp-out"));
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });

  it("slims the box header and hides its level field on Find and XP", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    expect($("#box-header").classList.contains("is-compact")).toBe(false);
    dispatch("#nav-find");
    expect($("#box-header").classList.contains("is-compact")).toBe(true);
    dispatch("#nav-xp");
    expect($("#box-header").classList.contains("is-compact")).toBe(true);
    dispatch("#nav-predict");
    expect($("#box-header").classList.contains("is-compact")).toBe(false);
  });

  it("offers only the rarity chips a box can drop, and none for a one-rarity egg", async () => {
    await init(restored());
    dispatch("#nav-find");
    const shown = () => $$("#rarity-chips .chip:not(.is-hidden)").map((chip) => chip.dataset.value);
    expect(shown()).toEqual(["all", "common", "rare", "epic", "legendary"]);
    expect($("#rarity-chips").classList.contains("is-hidden")).toBe(false);
    chest("egg_Rare", "find");
    expect($("#rarity-chips").classList.contains("is-hidden")).toBe(true);
  });

  it("hides the duplicate rarity select from assistive tech", async () => {
    await init();
    expect($('label[for="rarity-filter"]').getAttribute("aria-hidden")).toBe("true");
  });

  it("says in words which items were picked", async () => {
    await init(restored({ ui: { cardId: "egg_Rare", tab: "find" } }));
    expect($("#find-picked-names").textContent).toBe("");
    target("Pet_GoldenRetriever");
    target("Pet_HouseCat");
    expect($("#find-picked-names").textContent).toBe("Picked: Dog, Cat");
  });

  it("saves picked items but not every search keystroke", async () => {
    await init(restored({ ui: { cardId: "egg_Rare", tab: "find" } }));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    input("#item-search", "do", "input");
    expect(setItem).not.toHaveBeenCalled();
    target("Pet_GoldenRetriever");
    expect(stored().targets.egg_Rare).toEqual(["Pet_GoldenRetriever"]);
    setItem.mockRestore();
  });

  it("shows a marking error on the XP tab, where it can be seen", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus", tab: "xp" } }));
    input("#open-custom", 0);
    dispatch("#open-custom-go");
    expect($("#xp-out .error-box")).not.toBeNull();
    expect($("#out .error-box")).toBeNull();
  });

  it("does not grow browser history when a saved session reloads", async () => {
    await init(restored());
    expect(location.hash).toBe("#box");
    const length = history.length;
    const { enterBoxScreen } = await import("../../src/app/navigation.js");
    enterBoxScreen();
    enterBoxScreen();
    expect(history.length).toBe(length);
    expect($("#workspace").dataset.screen).toBe("box");
  });

  it("goes back to the box list from the header's Change box button", async () => {
    await init(restored());
    const button = $("#switch-box");
    expect(button.getAttribute("aria-label")).toBe("Change box");
    button.click();
    expect($("#workspace").dataset.screen).toBe("boxes");
    // On the Boxes screen "Pick a box" is the page heading.
    expect($(".rail-title").getAttribute("aria-level")).toBe("1");
    chest("big");
    expect($(".rail-title").getAttribute("aria-level")).toBe("2");
  });

  it("ignores Undo after another save replaced the box", async () => {
    await init(restored());
    markOpened(1);
    const undo = $("#toast-region .toast-undo");
    await upload();
    undo.click();
    expect(stored().live.big.opened).toBe(0);
  });

  it("gives the Next tab, and Find results, a heading under the box name", async () => {
    await init(restored());
    expect($("#panel-predict > h2").textContent).toBe("Next boxes");
    expect($("#panel-find > h2.sr-only").textContent).toBe("Results");
  });
});

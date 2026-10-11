// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderChestList, renderResults, renderHistory, renderXpPath,
  renderItemPicker, renderFindResult, renderError,
} from "../../src/ui/render.js";
import { item, step } from "../fixtures.js";

let container;
beforeEach(() => {
  document.body.textContent = "";
  container = document.createElement("div");
});
const opening = (open = 1, extra = {}) => ({ open, seed: 42, nextSeed: 1, items: [item()], ...extra });

describe("chest-list renderer", () => {
  it("preserves the active chest and never takes focus from another control", () => {
    const outside = document.createElement("button");
    document.body.append(outside, container);
    const states = { small: {}, big: {} };
    renderChestList(container, states, "small", vi.fn());
    container.children[1].focus();
    renderChestList(container, states, "big", vi.fn());
    expect(document.activeElement).toBe(container.children[1]);
    expect(document.activeElement.dataset.cardId).toBe("big");
    expect(document.activeElement.getAttribute("aria-current")).toBe("true");
    expect(container.children[0].hasAttribute("aria-current")).toBe(false);
    outside.focus();
    renderChestList(container, states, "small", vi.fn());
    expect(document.activeElement).toBe(outside);
  });

  it("shows active chest rows and adventure badges and selects by id", () => {
    const select = vi.fn();
    container.textContent = "stale";
    renderChestList(container, { big: {}, adventure_Zeus: { level: 5 } }, "big", select);
    expect(container.children).toHaveLength(2);
    expect(container.children[0].classList.contains("is-active")).toBe(true);
    expect(container.children[1].dataset.on).toBe("no");
    expect(container.children[1].textContent).toContain("Lv 5");
    expect(container.children[0].querySelector(".chest-name").textContent).toBe("Big Box");
    container.children[1].click();
    expect(select).toHaveBeenCalledWith("adventure_Zeus");
  });

  it("badges opened counts, marks the active tile and tints the backing per box", async () => {
    const { boxTone, boxGroup } = await import("../../src/ui/render.js");
    renderChestList(container, { big: { opened: 3 }, egg_Rare: {}, event_SeaPort: {}, mystery: {} }, "big", vi.fn());
    const [big, egg, seaport, mystery] = container.children;
    expect(big.querySelector(".badge--opened").textContent).toBe("3 opened");
    expect(big.querySelector(".box-check")).not.toBeNull();
    expect(egg.querySelector(".box-check")).toBeNull();
    expect(egg.querySelector(".box-badges")).toBeNull();
    expect([big, egg, seaport, mystery].map((tile) => tile.querySelector(".box-art").dataset.box))
      .toEqual(["big", "egg", "seaport", "unknown"]);
    expect(["big", "adventure_Zeus", "event_Mine", "egg_Epic"].map(boxGroup))
      .toEqual(["boxes", "adventures", "events", "eggs"]);
    expect(boxTone("adventure_Pirate")).toBe("pirate");
    expect(mystery.querySelector(".chest-fallback").textContent).toBe("M");
    expect(big.querySelector(".chest-name").textContent).toBe("Big Box");
    expect(big.textContent).toBe("3 openedBig Box");
  });
});

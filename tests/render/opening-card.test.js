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

describe("opening-card renderer", () => {
  it("keeps seeds in closed details and preserves zero-valued prediction data", () => {
    renderResults(container, "big", [opening(1, { seed: 0, nextSeed: 0, keyRoll: 0 })]);
    const details = container.querySelector("details");
    expect(details.open).toBe(false);
    expect(details.querySelector("summary").textContent).toBe("Prediction details");
    expect(details.textContent).toContain("Seed 0 · Next seed 0 · Key roll 0");
    expect(container.querySelector(".open-head .seed-text")).toBeNull();
  });

  it("keeps each adventure opening's level visible in predictions and restored history", () => {
    const chain = [
      opening(1, { level: 24 }),
      opening(2, { items: [{ ...item(), level: 4 }] }),
    ];
    renderResults(container, "adventure_Zeus", chain);
    expect([...container.querySelectorAll(".open-title")].map((node) => node.textContent))
      .toEqual(["Next box", "#2"]);
    expect([...container.querySelectorAll(".open-subtitle")].map((node) => node.textContent))
      .toEqual(["Zeus' Feast · Level 24", "Zeus' Feast · Level 4"]);
    renderHistory(container, "adventure_Zeus", [...chain].reverse());
    expect([...container.querySelectorAll(".open-title")].map((node) => node.textContent))
      .toEqual(["Opened #2", "Opened #1"]);
    expect([...container.querySelectorAll(".open-subtitle")].map((node) => node.textContent))
      .toEqual(["Zeus' Feast · Level 4", "Zeus' Feast · Level 24"]);
    renderHistory(container, "big", [opening()]);
    expect(container.querySelector(".open-subtitle").textContent).toBe("Big Box");
  });

  it("ribbons the next box and names later cards by number", () => {
    renderResults(container, "big", [opening(13), opening(14)], vi.fn());
    const [next, later] = container.querySelectorAll(".open-box");
    expect(next.classList.contains("is-next")).toBe(true);
    expect(next.querySelector(".open-ribbon").textContent).toBe("NEXT");
    expect(later.querySelector(".open-ribbon")).toBeNull();
    expect(later.querySelector(".open-title").textContent).toBe("#14");
    expect(later.querySelector(".open-title").getAttribute("aria-label")).toBe("Opening 14");
    expect(next.lastElementChild.classList.contains("btn--go")).toBe(true);
    expect(later.lastElementChild.classList.contains("btn--ghost")).toBe(true);
  });
});

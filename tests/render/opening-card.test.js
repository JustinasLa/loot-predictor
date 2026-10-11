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
  it("numbers the mark button by the card count when no number is given", async () => {
    const { markButton } = await import("../../src/ui/render.js");
    expect(markButton(3, vi.fn(), container).textContent).toBe("I opened up to #3");
    expect(markButton(1, vi.fn(), container).textContent).toBe("I opened it!");
  });

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
    expect([...container.querySelectorAll(".open-level")].map((node) => node.textContent))
      .toEqual(["Lv 24", "Lv 4"]);
    // The box header names the box: cards never repeat it.
    expect(container.textContent).not.toContain("Zeus' Feast");
    expect(container.querySelector(".open-head").classList.contains("is-bare")).toBe(false);
    renderHistory(container, "adventure_Zeus", [...chain].reverse());
    expect([...container.querySelectorAll(".open-title")].map((node) => node.textContent))
      .toEqual(["Opened #2", "Opened #1"]);
    expect([...container.querySelectorAll(".open-level")].map((node) => node.textContent))
      .toEqual(["Lv 4", "Lv 24"]);
    renderHistory(container, "big", [opening()]);
    expect(container.querySelector(".open-level")).toBeNull();
    expect(container.textContent).not.toContain("Big Box");
  });

  it("ribbons the next box and names later cards by number", () => {
    renderResults(container, "big", [opening(13), opening(14)], vi.fn());
    const [next, later] = container.querySelectorAll(".open-box");
    expect(next.classList.contains("is-next")).toBe(true);
    expect(next.querySelector(".open-ribbon").textContent).toBe("NEXT");
    // Only the ribbon shows on a plain box's next card: the header takes no room.
    expect(next.querySelector(".open-head").classList.contains("is-bare")).toBe(true);
    expect(later.querySelector(".open-ribbon")).toBeNull();
    expect(later.querySelector(".open-title").textContent).toBe("#14");
    expect(later.querySelector(".open-title").getAttribute("aria-label")).toBe("Opening 14");
    expect(next.lastElementChild.classList.contains("btn--go")).toBe(true);
    expect(later.lastElementChild.classList.contains("btn--ghost")).toBe(true);
  });

  it("marks history cards as past, without a button or ribbon", () => {
    renderHistory(container, "big", [opening(12)]);
    const card = container.querySelector(".open-box");
    expect(card.classList.contains("is-past")).toBe(true);
    expect(card.classList.contains("is-next")).toBe(false);
    expect(card.querySelector(".open-title").textContent).toBe("Opened #12");
    expect(card.querySelector("button")).toBeNull();
    expect(card.querySelector(".open-ribbon")).toBeNull();
  });

  it("keeps exactly one open button per upcoming card and the number in an aria-label", () => {
    renderResults(container, "big", [opening(1), opening(2), opening(3)], vi.fn());
    for (const card of container.children) expect(card.querySelectorAll("button")).toHaveLength(1);
    const [first, second] = container.querySelectorAll(".open-card-btn");
    expect(first.className).toContain("btn--go btn--lg btn--block");
    expect(first.textContent).toBe("I opened it!");
    expect(second.className).toContain("btn--ghost btn--sm");
    expect(second.textContent).toBe("I opened up to #2");
    // Every card title is an h3, routes included.
    expect([...container.querySelectorAll(".open-title")].every((title) => title.tagName === "H3")).toBe(true);
    expect(container.children[2].querySelector(".open-title").getAttribute("aria-label")).toBe("Opening 3");
  });
});

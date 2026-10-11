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

describe("items renderer", () => {
  it("renders local item art alongside its friendly name, with a readable broken-image fallback", () => {
    renderResults(container, "big", [opening()]);
    const image = container.querySelector(".item-image");
    expect(image.getAttribute("src")).toBe("/assets/items/Ring_Bronze.webp");
    expect(image.alt).toBe("");
    expect(image.loading).toBe("lazy");
    expect(image.width).toBe(64);
    expect(image.height).toBe(64);
    expect(image.parentElement.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".item-name").textContent).toBe("Bronze Ring");
    image.dispatchEvent(new Event("error"));
    expect(container.querySelector(".item-image")).toBeNull();
    expect(container.querySelector(".item-fallback").textContent).toBe("BR");
    expect(container.querySelector(".item-name").textContent).toBe("Bronze Ring");
  });

  it("keeps unknown rewards and boxes readable without fabricating asset URLs", () => {
    renderResults(container, "big", [opening(1, { items: [{ baseName: "futureItem" }] })]);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".item-name").textContent).toBe("Future Item");
    expect(container.querySelector(".item-fallback").textContent).toBe("FI");
    expect(container.querySelector(".item-rarity")).toBeNull();
    renderChestList(container, { futureBox: {} }, "futureBox", vi.fn());
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".chest-name").textContent).toBe("Future Box");
    expect(container.querySelector(".chest-fallback").textContent).toBe("F");
  });

  it.each([
    [{ itemRoll: 7 }, "x7"],
    [{ itemRoll: "150" }, "x150"],
    [{ name: "25 Pet Food" }, "x25"],
    [{ itemRoll: 0 }, null],
    [{ itemRoll: -1 }, null],
    [{ itemRoll: Infinity }, null],
    [{ itemRoll: "unknown" }, null],
    [{ name: "Pet Food" }, null],
    [{}, null],
  ])("only shows a real food quantity from %j", (details, expected) => {
    renderResults(container, "pet", [opening(1, { items: [{ baseName: "PetFood", rarity: "None", ...details }] })]);
    expect(container.querySelector(".item-name").textContent).toBe("Pet Food");
    expect(container.querySelector(".item-rarity").textContent).toBe("Resource");
    const quantity = container.querySelector(".item-quantity");
    expect(quantity?.textContent ?? null).toBe(expected);
    if (quantity) expect(quantity.getAttribute("aria-label")).toBe(`Quantity: ${expected.slice(1)}`);
  });

  it("does not mislabel equipment pool indices or item-picker entries as quantities", () => {
    renderResults(container, "big", [opening(1, { items: [{ ...item("Tool_LaserGun", "Ultimate"), itemRoll: 4 }] })]);
    expect(container.querySelector(".item-quantity")).toBeNull();
    renderItemPicker(container, [{ ...item("PetFood", "None"), itemRoll: 150 }], new Set(), vi.fn());
    expect(container.querySelector(".item-quantity")).toBeNull();
  });

  it("paints the tile in the first rarity and keeps the rarity word for screen readers", () => {
    renderResults(container, "big", [opening(1, { items: [item("Pet_RedPanda", "Legendary / Ultimate"), item("ZeusKeyIcon", "Rare")], hits: ["Pet_RedPanda"] })]);
    const [panda, key] = container.querySelectorAll(".item-row");
    expect(panda.dataset.rarity).toBe("Legendary / Ultimate");
    expect(panda.querySelector(".item-tile").dataset.rarity).toBe("Legendary");
    expect(panda.querySelector(".item-tile").title).toBe("Red Panda · Legendary / Ultimate");
    expect(panda.querySelector(".item-rarity").classList.contains("sr-only")).toBe(true);
    expect(panda.querySelector(".target-hit").textContent).toBe("Yours!");
    expect(key.querySelector(".item-key").textContent).toBe("Key");
    expect(key.querySelector(".item-key").getAttribute("aria-hidden")).toBe("true");
    expect(panda.querySelector(".item-key")).toBeNull();
  });

  it("uses the neutral tone and a plain title for rewards without a rarity", () => {
    renderResults(container, "big", [opening(1, { items: [{ baseName: "futureItem" }] })]);
    const tile = container.querySelector(".item-tile");
    expect(tile.dataset.rarity).toBe("None");
    expect(tile.title).toBe("Future Item");
  });
});

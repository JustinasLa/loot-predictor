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

describe("history renderer", () => {
  it("renders empty history and past boxes without actions", () => {
    renderHistory(container, "big", []);
    expect(container.textContent).toBe("Nothing opened yet.");
    expect(container.querySelector(".empty img").getAttribute("src")).toContain("SmallChestIcon.webp");
    expect(container.querySelector(".empty img").alt).toBe("");
    expect(container.querySelector(".empty img").getAttribute("src")).toMatch(/SmallChestIcon\.webp$/);
    expect(container.querySelector(".empty img").alt).toBe("");
    renderHistory(container, "big", [opening(2), opening(1)]);
    expect([...container.querySelectorAll(".open-box.is-past .open-title")].map((t) => t.textContent)).toEqual(["Opened #2", "Opened #1"]);
    expect(container.querySelector("button")).toBeNull();
    renderHistory(container, "big", [opening(2), opening(1)]);
    expect([...container.querySelectorAll(".open-box.is-past .open-title")].map((t) => t.textContent)).toEqual(["Opened #2", "Opened #1"]);
  });
});

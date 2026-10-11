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
    renderHistory(container, "big", [opening()]);
    expect(container.querySelector(".is-past")).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});

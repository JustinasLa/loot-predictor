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

describe("error renderer", () => {
  it("renders user-provided errors and item names as text", () => {
    const markup = '<img src="x" onerror="alert(1)">';
    renderError(container, markup);
    expect(container.textContent).toBe(`Oops! That didn't work. ${markup}`);
    expect(container.querySelector("img")).toBeNull();
    renderResults(container, "big", [opening(1, { items: [{ ...item(), name: markup }] })]);
    expect(container.querySelector(".item-name").textContent).toBe("Bronze Ring");
    expect(container.querySelector("img[onerror]")).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    renderResults(container, "big", [opening(1, { items: [item(markup)] })]);
    expect(container.querySelector(".item-name").textContent).toBe(markup);
    expect(container.querySelector("img")).toBeNull();
  });
});

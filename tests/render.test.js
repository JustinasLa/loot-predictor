// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderChestList, renderResults, renderHistory, renderXpPath,
  renderItemPicker, renderFindResult, renderError,
} from "../src/ui/render.js";
import { item, step } from "./fixtures.js";

let container;
beforeEach(() => { container = document.createElement("div"); });
const opening = (open = 1, extra = {}) => ({ open, seed: 42, nextSeed: 1, items: [item()], ...extra });

describe("rendered prediction and history", () => {
  it("shows active chest rows and adventure badges and selects by id", () => {
    const select = vi.fn();
    container.textContent = "stale";
    renderChestList(container, { big: {}, adventure_Zeus: { level: 5 } }, "big", select);
    expect(container.children).toHaveLength(2);
    expect(container.children[0].classList.contains("is-active")).toBe(true);
    expect(container.children[1].dataset.on).toBe("no");
    expect(container.children[1].textContent).toContain("lvl 5");
    container.children[1].click();
    expect(select).toHaveBeenCalledWith("adventure_Zeus");
  });

  it("labels chained open actions, reports vault rolls and renders item rarities", () => {
    const open = vi.fn();
    renderResults(container, "big", [opening(), opening(2, { keyRoll: 12 })], open);
    const buttons = container.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual(["open", "open ×2"]);
    expect(buttons[0].title).toContain("advance the seed");
    expect(buttons[1].title).toContain("1 before");
    buttons[0].click();
    buttons[1].click();
    expect(open.mock.calls).toEqual([[1], [2]]);
    expect(container.textContent).toContain("key roll 12");
    expect(container.querySelector("li").dataset.rarity).toBe("Common");
  });

  it("renders empty history and past boxes without actions", () => {
    renderHistory(container, "big", []);
    expect(container.textContent).toContain("nothing opened");
    renderHistory(container, "big", [opening()]);
    expect(container.querySelector(".is-past")).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("XP routes", () => {
  it.each([null, { xp: -1, path: [step()] }, { xp: 0, path: [] }])("renders missing solution %j", (solution) => {
    renderXpPath(container, solution, {}, 1);
    expect(container.textContent).toContain("no path found");
  });

  it("compares XP, displays refunds and cap, and commits only pending steps", () => {
    const path = [step(), step(24, 1, [item("ZeusKeyIcon")]), step(39, 2)];
    const open = vi.fn();
    renderXpPath(container, { xp: 30, path, truncated: true, maxOpens: 3 }, { xp: 20, opens: 2 }, 2, open, 1);
    expect(container.textContent).toContain("+10 xp (+50%)");
    expect(container.textContent).toContain("1 key(s) refunded");
    expect(container.textContent).toContain("3-open limit");
    expect(container.textContent).toContain("1 of 3 opened");
    expect(container.querySelector(".xp-delta").dataset.sign).toBe("up");
    const buttons = container.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual(["open", "open ×2"]);
    expect(buttons[0].title).toContain("this level");
    expect(buttons[1].title).toContain("1 before");
    buttons[0].click();
    buttons[1].click();
    expect(open.mock.calls).toEqual([[path.slice(1, 2)], [path.slice(1)]]);
  });

  it("renders equal XP without refunds or an action and completes the path", () => {
    const solution = { xp: 4, path: [step()] };
    renderXpPath(container, solution, { xp: 4, opens: 1 }, 1);
    expect(container.querySelector(".xp-delta").dataset.sign).toBe("flat");
    expect(container.textContent).toContain("same as always");
    expect(container.textContent).toContain("no keys dropped");
    expect(container.querySelector("button")).toBeNull();
    renderXpPath(container, solution, { xp: 0, opens: 0 }, 1, null, 1);
    expect(container.textContent).toContain("+4 xp (+0%)");
    expect(container.textContent).toContain("path done");
    expect(container.querySelector(".open-box")).toBeNull();
  });
});

describe("item hunts and errors", () => {
  it("renders selected and unselected item chips and toggles by base name", () => {
    const toggle = vi.fn();
    renderItemPicker(container, [item("A"), item("B", "Epic")], new Set(["A"]), toggle);
    expect([...container.children].map((chip) => chip.dataset.on)).toEqual(["yes", "no"]);
    container.children[1].click();
    expect(toggle).toHaveBeenCalledWith("B");
    renderItemPicker(container, [], new Set(), toggle);
    expect(container.textContent).toContain("no item pool");
  });

  it("renders unsuccessful linear and adventure hunts", () => {
    renderFindResult(container, { found: false, opens: 10, missing: ["A", "B"] }, []);
    expect(container.textContent).toContain("still missing: A, B");
    renderFindResult(container, { found: false, maxDepth: 5 }, []);
    expect(container.textContent).toContain("within 5 opens");
  });

  it("renders a linear route and highlights hits, using either seed field", () => {
    const path = [opening(), { ...step(), hits: [] }, { items: [item()], hits: ["Ring_Bronze"] }];
    const open = vi.fn();
    renderFindResult(container, { found: true, opens: 3, path }, ["Ring_Bronze"], open);
    expect(container.textContent).toContain("3 opens");
    expect(container.textContent).toContain("to grab 1 item");
    expect(container.textContent).toContain("seed 42");
    expect(container.querySelectorAll('[data-hit="yes"]')).toHaveLength(1);
    const buttons = container.querySelectorAll("button");
    expect(buttons[0].title).toContain("this box");
    expect(buttons[1].title).toContain("1 before");
    buttons[0].click();
    buttons[2].click();
    expect(open.mock.calls).toEqual([[path.slice(0, 1)], [path]]);
  });

  it("compares distinct shortest and cheapest routes and can render a single route", () => {
    const shortest = { path: [step()], cost: 1 };
    const cheapest = { path: [step(), step(5)], cost: 0 };
    renderFindResult(container, { found: true, shortest, cheapest, same: false, solutions: 2 }, ["A"]);
    expect([...container.querySelectorAll("h3")].map((node) => node.textContent)).toEqual(["fewest opens", "cheapest"]);
    expect(container.textContent).toContain("key refunds pay");
    expect(container.querySelector("button")).toBeNull();
    renderFindResult(container, { found: true, shortest, cheapest: shortest, same: true, solutions: 1 }, ["A"]);
    expect(container.querySelectorAll("h3")).toHaveLength(1);
    expect(container.textContent).toContain("1 route(s) considered");
  });

  it("renders user-provided errors and item names as text", () => {
    const markup = '<img src="x" onerror="alert(1)">';
    renderError(container, markup);
    expect(container.textContent).toBe(`bruh error: ${markup}`);
    expect(container.querySelector("img")).toBeNull();
    renderResults(container, "big", [opening(1, { items: [{ ...item(), name: markup }] })]);
    expect(container.textContent).toContain(markup);
    expect(container.querySelector("img")).toBeNull();
  });
});

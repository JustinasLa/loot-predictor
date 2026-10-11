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

describe("find-result renderer", () => {
  it("renders unsuccessful linear and adventure hunts", () => {
    renderFindResult(container, { found: false, opens: 10, missing: ["A", "B"] }, []);
    expect(container.textContent).toContain("Still needed: A, B");
    renderFindResult(container, { found: false, maxDepth: 5 }, []);
    expect(container.textContent).toContain("within 5 openings");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    renderFindResult(container, { found: false, opens: 1, missing: ["Tool_LaserGun"] }, []);
    expect(container.textContent).toContain("Not found in 1 opening. Still needed: Laser Gun.");
  });

  it.each([
    [{ stopped: true, complete: false }, "Search stopped before it finished"],
    [{ truncated: true, maxNodes: 1000, complete: false }, "Search reached its limit before it finished"],
    [{ complete: false }, "Search ended before it finished"],
  ])("does not claim failure for an incomplete hunt %j", (metadata, message) => {
    renderFindResult(container, { found: false, maxDepth: 5, ...metadata }, ["A"]);
    expect(container.textContent).toContain(message);
    expect(container.textContent).not.toContain("No route found");
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("describes a truncated external search result without optional budget metadata", () => {
    renderFindResult(container, { found: false, truncated: true, maxDepth: 5 }, ["A"]);
    expect(container.textContent)
      .toBe("Search reached its limit before it finished. Try searching again to find a route.");
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("renders a linear route and highlights hits, using either seed field", () => {
    const path = [opening(), { ...step(), hits: [] }, { items: [item()], hits: ["Ring_Bronze"] }];
    const open = vi.fn();
    renderFindResult(container, { found: true, opens: 3, path }, ["Ring_Bronze"], open);
    expect(container.textContent).toContain("3 openings");
    expect(container.textContent).toContain("To collect 1 selected item");
    expect(container.textContent).toContain("Seed 42");
    expect(container.querySelectorAll('[data-hit="yes"]')).toHaveLength(1);
    const buttons = container.querySelectorAll("button");
    expect(buttons[0].title).toBe("Marks this box opened");
    expect(buttons[1].title).toBe("Marks 2 boxes opened");
    buttons[0].click();
    buttons[2].click();
    expect(open.mock.calls).toEqual([[path.slice(0, 1)], [path]]);
  });

  it("compares distinct shortest and cheapest routes and can render a single route", () => {
    const shortest = { path: [step()], cost: 1 };
    const cheapest = { path: [step(), step(5)], cost: 0 };
    renderFindResult(container, { found: true, shortest, cheapest, same: false, solutions: 2 }, ["A"]);
    expect([...container.querySelectorAll(".route-block > h3")].map((node) => node.textContent)).toEqual(["Fewest openings", "Lowest cost"]);
    expect(container.textContent).toContain("Keys found along the way cover the extra openings");
    expect(container.querySelector("button")).toBeNull();
    renderFindResult(container, { found: true, shortest, cheapest: shortest, same: true, solutions: 1 }, ["A"]);
    expect(container.querySelectorAll(".route-block > h3")).toHaveLength(1);
    expect(container.textContent).toContain("1 route checked");
    renderFindResult(container,
      { found: true, shortest, cheapest: { path: [step()], cost: 0 }, same: false, solutions: 2 }, ["A"]);
    expect(container.textContent).not.toContain("extra openings");
  });

  it("presents useful interrupted routes as candidates without claiming optimality", () => {
    const shortest = { path: [step()], cost: 1 };
    const cheapest = { path: [step(), step(5)], cost: 0 };
    const open = vi.fn();
    renderFindResult(container,
      { found: true, shortest, cheapest, same: false, solutions: 2, stopped: true, complete: false },
      ["A"], open);
    expect(container.textContent).toContain("These are the best routes found so far");
    expect([...container.querySelectorAll(".route-block > h3")].map((node) => node.textContent))
      .toEqual(["Fewest openings found", "Lowest cost found"]);
    expect(container.textContent).toContain("lowest-cost route found");
    container.querySelector("button").click();
    expect(open).toHaveBeenCalledWith(shortest.path);
  });
});

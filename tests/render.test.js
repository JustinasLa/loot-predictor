// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderChestList, renderResults, renderHistory, renderXpPath,
  renderItemPicker, renderFindResult, renderError,
} from "../src/ui/render.js";
import { item, step } from "./fixtures.js";

let container;
beforeEach(() => {
  document.body.textContent = "";
  container = document.createElement("div");
});
const opening = (open = 1, extra = {}) => ({ open, seed: 42, nextSeed: 1, items: [item()], ...extra });

describe("keyboard focus across redraws", () => {
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

  it("restores the exact rarity of a selected item after a redraw", () => {
    document.body.append(container);
    const items = [item("A", "Common"), item("A", "Epic"), item("B", "Epic")];
    renderItemPicker(container, items, new Set(), vi.fn());
    container.children[1].focus();
    renderItemPicker(container, items, new Set(["A"]), vi.fn());
    expect(document.activeElement).toBe(container.children[1]);
    expect(document.activeElement.dataset.rarity).toBe("Epic");
    expect(document.activeElement.getAttribute("aria-pressed")).toBe("true");
    expect(container.children[0].getAttribute("aria-pressed")).toBe("true");
    expect(container.children[2].getAttribute("aria-pressed")).toBe("false");
  });

  it("does not focus a different item when the previously focused item disappears", () => {
    document.body.append(container);
    renderItemPicker(container, [item("A"), item("B")], new Set(), vi.fn());
    container.children[1].focus();
    renderItemPicker(container, [item("A")], new Set(), vi.fn());
    expect(document.activeElement).not.toBe(container.children[0]);
  });

  it("moves keyboard focus to the next opening after recording progress", () => {
    document.body.append(container);
    let remaining = [opening(), opening(2)];
    const record = (count) => {
      remaining = remaining.slice(count);
      draw();
    };
    const draw = () => renderResults(container, "big", remaining, record);
    draw();
    const previous = container.querySelector("button");
    previous.focus();
    previous.click();
    expect(previous.isConnected).toBe(false);
    expect(document.activeElement).toBe(container.querySelector("button"));
    expect(container.querySelector(".open-title").textContent).toBe("Opening 2");
    document.activeElement.click();
    expect(document.activeElement).toBe(container);
    expect(container.tabIndex).toBe(-1);
    expect(container.querySelector("button")).toBeNull();
  });

  it("preserves deliberate focus changes made by an opening callback", () => {
    const destination = document.createElement("button");
    document.body.append(destination, container);
    renderResults(container, "big", [opening()], () => {
      renderResults(container, "big", [opening(2)], vi.fn());
      destination.focus();
    });
    const button = container.querySelector("button");
    button.focus();
    button.click();
    expect(document.activeElement).toBe(destination);
  });

  it("keeps existing focus when an opening action does not redraw its button", () => {
    document.body.append(container);
    const record = vi.fn();
    renderResults(container, "big", [opening()], record);
    const button = container.querySelector("button");
    button.focus();
    button.click();
    expect(record).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(button);
  });

  it("does not steal focus for an opening triggered while another control is focused", () => {
    const outside = document.createElement("button");
    document.body.append(outside, container);
    renderResults(container, "big", [opening()], () => renderResults(container, "big", [opening(2)], vi.fn()));
    outside.focus();
    container.querySelector("button").click();
    expect(document.activeElement).toBe(outside);
  });
});

describe("game artwork and reward quantities", () => {
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
    expect(container.querySelector(".chest-fallback").textContent).toBe("FB");
  });

  it.each([
    [{ itemRoll: 7 }, "×7"],
    [{ itemRoll: "150" }, "×150"],
    [{ name: "25 Pet Food" }, "×25"],
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

  it("keeps seeds in closed details and preserves zero-valued prediction data", () => {
    renderResults(container, "big", [opening(1, { seed: 0, nextSeed: 0, keyRoll: 0 })]);
    const details = container.querySelector("details");
    expect(details.open).toBe(false);
    expect(details.querySelector("summary").textContent).toBe("Prediction details");
    expect(details.textContent).toContain("Seed 0 · Next seed 0 · Key roll 0");
    expect(container.querySelector(".open-head .seed-text")).toBeNull();
  });
});

describe("rendered prediction and history", () => {
  it("shows active chest rows and adventure badges and selects by id", () => {
    const select = vi.fn();
    container.textContent = "stale";
    renderChestList(container, { big: {}, adventure_Zeus: { level: 5 } }, "big", select);
    expect(container.children).toHaveLength(2);
    expect(container.children[0].classList.contains("is-active")).toBe(true);
    expect(container.children[1].dataset.on).toBe("no");
    expect(container.children[1].textContent).toContain("Level 5");
    expect(container.children[0].querySelector(".chest-name").textContent).toBe("Big Box");
    container.children[1].click();
    expect(select).toHaveBeenCalledWith("adventure_Zeus");
  });

  it("labels chained open actions, reports vault rolls and renders item rarities", () => {
    const open = vi.fn();
    renderResults(container, "big", [opening(), opening(2, { keyRoll: 12 })], open);
    const buttons = container.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual(["Mark opened", "Mark first 2 opened"]);
    expect(buttons[0].title).toContain("After opening this in Eatventure");
    expect(buttons[1].title).toContain("1 before");
    buttons[0].click();
    buttons[1].click();
    expect(open.mock.calls).toEqual([[1], [2]]);
    expect(container.textContent).toContain("Key roll 12");
    expect(container.querySelector("li").dataset.rarity).toBe("Common");
  });

  it("renders empty history and past boxes without actions", () => {
    renderHistory(container, "big", []);
    expect(container.textContent).toContain("No openings recorded yet");
    renderHistory(container, "big", [opening()]);
    expect(container.querySelector(".is-past")).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("keeps each adventure opening's level visible in predictions and restored history", () => {
    const chain = [
      opening(1, { level: 24 }),
      opening(2, { items: [{ ...item(), level: 4 }] }),
    ];
    renderResults(container, "adventure_Zeus", chain);
    expect([...container.querySelectorAll(".open-title")].map((node) => node.textContent))
      .toEqual(["Opening 1", "Opening 2"]);
    expect([...container.querySelectorAll(".open-subtitle")].map((node) => node.textContent))
      .toEqual(["Zeus' Feast · Level 24", "Zeus' Feast · Level 4"]);
    renderHistory(container, "adventure_Zeus", [...chain].reverse());
    expect([...container.querySelectorAll(".open-title")].map((node) => node.textContent))
      .toEqual(["Opened 2", "Opened 1"]);
    expect([...container.querySelectorAll(".open-subtitle")].map((node) => node.textContent))
      .toEqual(["Zeus' Feast · Level 4", "Zeus' Feast · Level 24"]);
    renderHistory(container, "big", [opening()]);
    expect(container.querySelector(".open-subtitle").textContent).toBe("Big Box");
  });
});

describe("XP routes", () => {
  it.each([null, { xp: -1, path: [step()] }, { xp: 0, path: [] }])("renders missing solution %j", (solution) => {
    renderXpPath(container, solution, {}, 1);
    expect(container.textContent).toContain("No plan found");
  });

  it("compares XP, displays refunds and cap, and commits only pending steps", () => {
    const path = [step(), step(24, 1, [item("ZeusKeyIcon")]), step(39, 2)];
    const open = vi.fn();
    renderXpPath(container, { xp: 30, path, truncated: true, maxOpens: 3 }, { xp: 20, opens: 2 }, 2, open, 1);
    expect(container.textContent).toContain("+10 XP (+50%)");
    expect(container.textContent).toContain("1 bonus opening from key drops");
    expect(container.textContent).toContain("3-opening limit");
    expect(container.textContent).toContain("1 of 3 openings recorded");
    expect(container.querySelector(".xp-delta").dataset.sign).toBe("up");
    const buttons = container.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual(["Mark opened", "Mark first 2 opened"]);
    expect(buttons[0].title).toContain("After opening this in Eatventure");
    expect(buttons[1].title).toContain("1 before");
    buttons[0].click();
    buttons[1].click();
    expect(open.mock.calls).toEqual([[path.slice(1, 2)], [path.slice(1)]]);
  });

  it("renders equal XP without refunds or an action and completes the path", () => {
    const solution = { xp: 4, path: [step()] };
    renderXpPath(container, solution, { xp: 4, opens: 1 }, 1);
    expect(container.querySelector(".xp-delta").dataset.sign).toBe("flat");
    expect(container.textContent).toContain("The same XP as always");
    expect(container.textContent).toContain("No extra keys found");
    expect(container.querySelector("button")).toBeNull();
    renderXpPath(container, solution, { xp: 0, opens: 0 }, 1, null, 1);
    expect(container.textContent).toContain("+4 XP");
    expect(container.textContent).not.toContain("(+0%)");
    expect(container.textContent).toContain("Plan complete");
    expect(container.querySelector(".open-box")).toBeNull();
  });

  it("labels a lower XP result as less instead of equal and explains the cap without inventing keys", () => {
    renderXpPath(container,
      { xp: 25, path: [step()], truncated: true, maxOpens: 1 },
      { xp: 100, opens: 4 }, 4);
    expect(container.querySelector(".xp-delta").dataset.sign).toBe("down");
    expect(container.textContent).toContain("75 XP less (-75%)");
    expect(container.textContent).not.toContain("same as");
    expect(container.querySelector(".xp-warn").textContent).toBe("Search reached the 1-opening limit. This is the best plan found so far.");
    expect(container.textContent).not.toContain("keys kept refunding");
  });

  it("distinguishes cancelled XP searches from a completed search with no path", () => {
    renderXpPath(container, { xp: -1, path: [], stopped: true }, {}, 4);
    expect(container.textContent).toBe("Search stopped before a plan was found. Try again to find a plan.");
    renderXpPath(container, { xp: 4, path: [step()], stopped: true }, { xp: 9, opens: 1 }, 1);
    expect(container.textContent).toContain("Search stopped early. This is the best plan found so far.");
  });
});

describe("item hunts and errors", () => {
  it("searches friendly names and internal IDs without changing selected targets", () => {
    const items = [item("Tool_LaserGun", "Ultimate"), item("Ring_Bronze"), item("Pet_RedPanda", "Ultimate")];
    const selected = new Set(["Ring_Bronze"]);
    const toggle = vi.fn();
    renderItemPicker(container, items, selected, toggle, { query: "  LASER gun  ", rarity: "ULTIMATE" });
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector(".item-name").textContent).toBe("Laser Gun");
    container.querySelector("button").click();
    expect(toggle).toHaveBeenCalledWith("Tool_LaserGun");
    expect([...selected]).toEqual(["Ring_Bronze"]);
    renderItemPicker(container, items, selected, toggle, { query: "ring_bronze", rarity: "all" });
    expect(container.querySelector("button").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".item-check").getAttribute("aria-hidden")).toBe("true");
  });

  it("filters combined item rarities using either supported representation", () => {
    const common = item("Ring_Bronze");
    const combined = { ...item("Pet_RedPanda", "Legendary / Ultimate"), rarities: ["Legendary", "Ultimate"] };
    const combinedLabel = item("Pet_Panda", "Epic / Legendary");
    renderItemPicker(container, [common, combined, combinedLabel], new Set(), vi.fn(), { rarity: "LEGENDARY" });
    expect([...container.querySelectorAll("button")].map((button) => button.dataset.baseName)).toEqual(["Pet_RedPanda", "Pet_Panda"]);
    renderItemPicker(container, [common, combined], new Set(), vi.fn(), { query: "common", rarity: "common" });
    expect(container.querySelector("button").dataset.baseName).toBe("Ring_Bronze");
  });

  it("explains an empty filtered list and restores items when filters are cleared", () => {
    const items = [item("Ring_Bronze")];
    renderItemPicker(container, items, new Set(), vi.fn(), { query: "Panda" });
    expect(container.textContent).toBe("No items match your search. Try another name or choose All rarities.");
    expect(container.querySelector("button")).toBeNull();
    renderItemPicker(container, items, new Set(), vi.fn(), { query: "", rarity: "" });
    expect(container.querySelector(".item-name").textContent).toBe("Bronze Ring");
  });

  it("renders selected and unselected item chips and toggles by base name", () => {
    const toggle = vi.fn();
    renderItemPicker(container, [item("A"), item("B", "Epic")], new Set(["A"]), toggle);
    expect([...container.children].map((chip) => chip.dataset.on)).toEqual(["yes", "no"]);
    container.children[1].click();
    expect(toggle).toHaveBeenCalledWith("B");
    renderItemPicker(container, [], new Set(), toggle);
    expect(container.textContent).toContain("There are no searchable items for this box yet");
  });

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
    expect(buttons[0].title).toContain("After opening this in Eatventure");
    expect(buttons[1].title).toContain("1 before");
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

  it("renders user-provided errors and item names as text", () => {
    const markup = '<img src="x" onerror="alert(1)">';
    renderError(container, markup);
    expect(container.textContent).toBe(`Something went wrong: ${markup}`);
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

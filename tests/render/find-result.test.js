// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderFindResult } from "../../src/ui/render.js";
import { item, step } from "../fixtures.js";

let container;
beforeEach(() => {
  document.body.textContent = "";
  container = document.createElement("div");
});
const opening = (open = 1, extra = {}) => ({ open, seed: 42, nextSeed: 1, items: [item()], ...extra });
const titles = () => [...container.querySelectorAll(".open-title")].map((node) => node.textContent);

describe("find-result renderer", () => {
  it("renders unsuccessful linear and adventure hunts with the missing pictures", () => {
    expect(renderFindResult(container, { found: false, opens: 10, missing: ["A", "B"] }, [item("A", "Epic"), "B"])).toBe("missing");
    expect(container.querySelector(".find-banner-text").textContent).toBe("Not in the next 10 opens.");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const tiles = container.querySelectorAll(".find-sprites .item-tile");
    expect([...tiles].map((tile) => tile.dataset.rarity)).toEqual(["Epic", "None"]);
    renderFindResult(container, { found: false, maxDepth: 5 }, ["Ring_Bronze"]);
    expect(container.querySelector(".find-banner-text").textContent).toBe("Not in the next 5 opens.");
    expect(container.querySelectorAll(".find-sprites .item-tile")).toHaveLength(1);
    renderFindResult(container, { found: false, opens: 1, missing: ["Tool_LaserGun"] }, []);
    expect(container.querySelector(".find-banner-text").textContent).toBe("Not in the next 1 open.");
    renderFindResult(container, { found: false, opens: 12345, missing: ["A"] }, []);
    expect(container.querySelector(".find-banner-text").textContent).toBe(`Not in the next ${(12345).toLocaleString()} opens.`);
  });

  it.each([
    [{ stopped: true, complete: false }, "Stopped.", "stopped"],
    [{ stopped: true, truncated: true }, "Stopped.", "stopped"],
    [{ truncated: true, maxNodes: 1000, complete: false }, "Hit the search limit.", "limit"],
    [{ complete: false }, "Stopped.", "stopped"],
  ])("does not claim failure for an incomplete hunt %j", (metadata, message, kind) => {
    expect(renderFindResult(container, { found: false, maxDepth: 5, ...metadata }, ["A"])).toBe(kind);
    expect(container.textContent).toBe(message);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("renders a linear route, marks wanted items and folds plain openings", () => {
    const path = [opening(), { ...step(), hits: [] }, { ...step(), hits: [] }, { items: [item()], hits: ["Ring_Bronze"] }];
    const open = vi.fn();
    expect(renderFindResult(container, { found: true, opens: 4, path }, [item()], open)).toBe("found");
    expect(container.querySelector(".find-found .find-banner-text").textContent).toBe("Found in 4 opens!");
    expect(container.querySelector(".find-found .display-text")).not.toBeNull();
    expect(container.querySelector(".route-toggle")).toBeNull();
    expect(container.textContent).toContain("Seed 42");
    expect(titles()).toEqual(["Next box", "#2", "#3", "#4"]);
    expect(container.querySelectorAll(".open-title")[1].getAttribute("aria-label")).toBe("Opening 2");
    const fold = container.querySelector("details.find-skip");
    expect(fold.querySelector("summary").textContent).toBe("+2 opens");
    expect(fold.querySelectorAll(".open-box")).toHaveLength(2);
    const yours = container.querySelectorAll('[data-hit="yes"]');
    expect(yours).toHaveLength(1);
    expect(yours[0].textContent).toContain("Yours!");
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(4);
    expect(buttons[0].textContent).toBe("I opened it!");
    expect(buttons[1].textContent).toBe("Opened up to here");
    buttons[0].click();
    buttons[3].click();
    expect(open.mock.calls).toEqual([[path.slice(0, 1)], [path]]);
  });

  it("keeps a single plain opening unfolded and says Found in 1 open", () => {
    renderFindResult(container, { found: true, opens: 2, path: [opening(), { ...step(), hits: [] }, { ...step() }] }, []);
    expect(container.querySelector(".find-skip")).toBeNull();
    renderFindResult(container, { found: true, opens: 1, path: [opening()] }, []);
    expect(container.querySelector(".find-found .find-banner-text").textContent).toBe("Found in 1 open!");
    expect(container.querySelector("button")).toBeNull();
  });

  it("toggles between two different adventure routes with radio pills", () => {
    const shortest = { path: [step(12)], cost: 1 };
    const cheapest = { path: [step(3), step(5)], cost: 0 };
    const open = vi.fn();
    renderFindResult(container, { found: true, shortest, cheapest, same: false, solutions: 2 }, ["A"], open);
    expect([...container.querySelectorAll(".route-block > h3")].map((node) => node.textContent)).toEqual(["Fastest", "Fewest keys"]);
    const radios = [...container.querySelectorAll(".route-toggle input[type=radio]")];
    expect(radios.map((radio) => radio.closest("label").textContent)).toEqual(["Fastest · 1 open", "Fewest keys · 0 keys"]);
    expect(radios[0].checked).toBe(true);
    expect(radios[0].name).toBe(radios[1].name);
    const blocks = container.querySelectorAll(".route-block");
    expect(blocks[1].classList.contains("is-hidden")).toBe(true);
    expect(titles()).toEqual(["Open at level 12", "Open at level 3", "Open at level 5"]);
    expect(container.querySelector("button").textContent).toBe("I opened it!");
    radios[1].checked = true;
    radios[1].dispatchEvent(new Event("change"));
    expect(blocks[0].classList.contains("is-hidden")).toBe(true);
    expect(blocks[1].classList.contains("is-hidden")).toBe(false);
    expect(container.querySelector(".find-found .find-banner-text").textContent).toBe("Found in 2 opens!");
    blocks[1].querySelector("button").click();
    expect(open).toHaveBeenCalledWith(cheapest.path.slice(0, 1));
    radios[0].checked = true;
    radios[0].dispatchEvent(new Event("change"));
    expect(blocks[0].classList.contains("is-hidden")).toBe(false);
    expect(container.querySelector(".find-found .find-banner-text").textContent).toBe("Found in 1 open!");
  });

  it("shows one route without a toggle when both routes are the same", () => {
    const shortest = { path: [{ ...step(), level: undefined }], cost: 1 };
    renderFindResult(container, { found: true, shortest, cheapest: shortest, same: true, solutions: 1 }, ["A"]);
    expect(container.querySelectorAll(".route-block > h3")).toHaveLength(1);
    expect(container.querySelector(".route-toggle")).toBeNull();
    expect(titles()).toEqual(["Next box"]);
  });

  it("labels key costs and keeps negative costs at zero keys", () => {
    renderFindResult(container, { found: true, shortest: { path: [step()], cost: 2 }, cheapest: { path: [step(), step()], cost: 1 }, same: false }, []);
    expect(container.querySelectorAll(".route-pill")[1].textContent).toBe("Fewest keys · 1 key");
    renderFindResult(container, { found: true, shortest: { path: [step()], cost: 2 }, cheapest: { path: [step(), step()], cost: -1 }, same: false }, []);
    expect(container.querySelectorAll(".route-pill")[1].textContent).toBe("Fewest keys · 0 keys");
  });

  it.each([
    [{ stopped: true, complete: false }, "Stopped early. Best so far:"],
    [{ truncated: true, complete: false }, "Hit the search limit. Best so far:"],
  ])("presents interrupted routes as best so far %j", (metadata, message) => {
    const shortest = { path: [step()], cost: 1 };
    const cheapest = { path: [step(), step(5)], cost: 0 };
    const open = vi.fn();
    renderFindResult(container, { found: true, shortest, cheapest, same: false, solutions: 2, ...metadata }, ["A"], open);
    expect(container.querySelector('[role="status"]').textContent).toBe(message);
    container.querySelector("button").click();
    expect(open).toHaveBeenCalledWith(shortest.path);
  });
});

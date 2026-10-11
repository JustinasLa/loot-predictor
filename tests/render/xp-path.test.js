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

describe("xp-path renderer", () => {
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
    expect([...buttons].map((button) => button.textContent)).toEqual(["I opened it!", "Opened up to here"]);
    expect(buttons[0].title).toBe("Marks this box opened");
    expect(buttons[1].title).toBe("Marks 2 boxes opened");
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

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
    expect(container.textContent).toBe("No plan found. Try more keys or a higher level.");
    expect(container.querySelector(".error-box")).toBeNull();
    expect(container.querySelector(".box-art")).toBeNull();
  });

  it("shows the adventure icon in an empty plan", () => {
    renderXpPath(container, { xp: -1, path: [] }, {}, 1, null, 0, "adventure_Pirate");
    expect(container.querySelector(".empty .box-art").dataset.box).toBe("pirate");
  });

  it("compares XP, displays refunds and cap, and commits only pending steps", () => {
    const path = [step(), step(24, 1, [item("ZeusKeyIcon")]), step(39, 2)];
    path[2].xp = 1200;
    const open = vi.fn();
    renderXpPath(container, { xp: 1230, path, truncated: true, maxOpens: 3 }, { xp: 1220, opens: 2 }, 2, open, 1, "adventure_Zeus");
    const delta = container.querySelector(".xp-delta");
    expect(delta.textContent).toBe("+10 XP");
    expect(delta.dataset.sign).toBe("up");
    expect(container.querySelector(".xp-summary").classList.contains("banner--go")).toBe(true);
    expect(container.querySelector(".xp-versus").textContent).toBe("vs 1,220 XP in 2 openings at top level");
    expect(container.querySelector(".xp-spend").textContent).toBe("3 opens");
    expect(container.querySelector(".xp-keys").textContent).toBe("1 bonus key");
    expect(container.querySelector(".xp-keys img").getAttribute("src")).toContain("ZeusKeyIcon");
    const warn = container.querySelector(".xp-warn");
    expect(warn.textContent).toBe("Best so far");
    expect(warn.title).toBe("Hit the opening limit");
    const progress = container.querySelector(".xp-progress");
    expect(progress.querySelector("[aria-hidden]").textContent).toBe("1 of 3 done");
    expect(progress.querySelector(".sr-only").textContent).toBe(" 1 of 3 openings recorded.");
    const titles = [...container.querySelectorAll(".open-title")].map((title) => title.textContent);
    expect(titles).toEqual(["Open at level 24", "Open at level 39"]);
    expect([...container.querySelectorAll(".xp-pill")].map((pill) => pill.textContent)).toEqual(["+4 XP", "+1,200 XP"]);
    expect(container.querySelector(".open-subtitle")).toBeNull();
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
    expect(container.querySelector(".xp-delta").textContent).toBe("Same as top level");
    expect(container.querySelector(".xp-summary").classList.contains("banner--go")).toBe(false);
    expect(container.querySelector(".xp-keys")).toBeNull();
    expect(container.textContent).not.toContain("No extra keys");
    expect(container.querySelector("button")).toBeNull();
    renderXpPath(container, solution, { xp: 0, opens: 0 }, 1, null, 1);
    expect(container.querySelector(".xp-delta").textContent).toBe("+4 XP");
    expect(container.textContent).not.toContain("%");
    const progress = container.querySelector(".xp-progress");
    expect(progress.classList.contains("is-done")).toBe(true);
    expect(progress.querySelector("[aria-hidden]").textContent).toBe("Plan done!");
    expect(progress.textContent).toContain("Plan complete");
    expect(container.querySelector(".open-box")).toBeNull();
  });

  it("labels a lower XP result as less instead of equal and explains the cap without inventing keys", () => {
    renderXpPath(container,
      { xp: 25, path: [step()], truncated: true, maxOpens: 1 },
      { xp: 100, opens: 4 }, 4);
    expect(container.querySelector(".xp-delta").dataset.sign).toBe("down");
    expect(container.querySelector(".xp-delta").textContent).toBe("75 XP less than top level");
    expect(container.textContent).not.toContain("Same as");
    expect(container.querySelector(".xp-warn").textContent).toBe("Best so far");
    expect(container.querySelector(".xp-keys")).toBeNull();
  });

  it("titles a step without a level by its number and omits a missing XP pill", () => {
    renderXpPath(container, { xp: 4, path: [{ ...step(), level: undefined, xp: undefined }] }, { xp: 4, opens: 1 }, 1);
    expect(container.querySelector(".open-title").textContent).toBe("Step 1");
    expect(container.querySelector(".xp-pill")).toBeNull();
  });

  it("distinguishes cancelled XP searches from a completed search with no path", () => {
    renderXpPath(container, { xp: -1, path: [], stopped: true }, {}, 4);
    expect(container.textContent).toBe("Stopped.");
    expect(container.querySelector("button")).toBeNull();
    renderXpPath(container, { xp: 4, path: [step()], stopped: true }, { xp: 9, opens: 1 }, 1);
    expect([...container.querySelectorAll(".xp-warn")].map((chip) => chip.textContent)).toEqual(["Stopped early"]);
  });
});

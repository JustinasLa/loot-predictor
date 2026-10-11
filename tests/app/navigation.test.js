// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/solver/xp-path.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findOptimalXpPath: vi.fn(actual.findOptimalXpPath) };
});
vi.mock("../../src/solver/find-items.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findAllPathsAsync: vi.fn(actual.findAllPathsAsync), findItemLinearAsync: vi.fn(actual.findItemLinearAsync) };
});

import { $, $$, stored, dispatch, chest, markOpened, init, restored, setupApp } from "../helpers/app-harness.js";

setupApp();

const press = (target, key) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

describe("box rail", () => {
  it("groups boxes, hides empty groups and badges levels and openings", async () => {
    await init(restored());
    const groups = Object.fromEntries($$(".box-group").map((group) => [group.dataset.group, group]));
    expect(groups.boxes.querySelectorAll("[data-card-id]").length).toBeGreaterThan(0);
    expect(groups.adventures.querySelectorAll("[data-card-id]")).toHaveLength(2);
    expect(groups.eggs.querySelectorAll("[data-card-id]")).toHaveLength(1);
    expect(groups.events.querySelectorAll("[data-card-id]")).toHaveLength(1);
    expect(groups.events.classList.contains("is-hidden")).toBe(false);
    expect($('[data-card-id="adventure_Zeus"]').textContent).toContain("Lv 5");
    markOpened(2);
    expect($('[data-card-id="big"]').textContent).toContain("2 opened");
    expect($('[data-card-id="big"]').getAttribute("aria-current")).toBe("true");
  });

  it("hides groups with no boxes", async () => {
    await init({ saved: { big: { initialSeed: 1 } }, live: { big: { seed: 1, opened: 0, history: [] } } });
    expect($('.box-group[data-group="events"]').classList.contains("is-hidden")).toBe(true);
    expect($('.box-group[data-group="boxes"]').classList.contains("is-hidden")).toBe(false);
  });

  it("shows the selected box art in the header", async () => {
    await init(restored());
    expect($("#current-chest-art").dataset.box).toBe("big");
    expect($("#current-chest-art img").getAttribute("src")).toBe("/assets/items/BigChestIcon.webp");
    chest("egg_Rare");
    expect($("#current-chest-art").dataset.box).toBe("egg");
    expect($("#current-chest-name").textContent).toBe("Rare Egg");
  });

  it("keeps one box selected across tabs", async () => {
    await init(restored());
    chest("egg_Rare", "find");
    expect($("#panel-find").classList.contains("is-hidden")).toBe(false);
    dispatch("#nav-predict");
    expect($("#current-chest-name").textContent).toBe("Rare Egg");
    expect(stored().ui).toMatchObject({ cardId: "egg_Rare", tab: "predict" });
  });
});

describe("tabs", () => {
  it("supports arrow, Home and End keys across visible tabs and ignores other keys", async () => {
    await init(restored());
    const predict = $("#nav-predict");
    const find = $("#nav-find");
    expect($("#nav-xp").classList.contains("is-hidden")).toBe(true);
    predict.focus();
    press(predict, "ArrowRight");
    expect(document.activeElement).toBe(find);
    expect(find.getAttribute("aria-selected")).toBe("true");
    press(find, "ArrowRight");
    expect(document.activeElement).toBe(predict);
    press(predict, "ArrowLeft");
    expect(document.activeElement).toBe(find);
    press(find, "Home");
    expect(document.activeElement).toBe(predict);
    press(predict, "End");
    expect(document.activeElement).toBe(find);
    expect(press(find, "Tab").defaultPrevented).toBe(false);
    expect(stored().ui.tab).toBe("find");
  });

  it("offers the XP tab only for adventure boxes and falls back to Next", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    expect($("#nav-xp").classList.contains("is-hidden")).toBe(false);
    press($("#nav-predict"), "End");
    expect(document.activeElement).toBe($("#nav-xp"));
    expect($("#panel-xp").classList.contains("is-hidden")).toBe(false);
    expect($("#smart-xp").classList.contains("is-hidden")).toBe(false);
    chest("big");
    expect($("#nav-xp").classList.contains("is-hidden")).toBe(true);
    expect($("#panel-predict").classList.contains("is-hidden")).toBe(false);
    expect(stored().ui.tab).toBe("predict");
  });

  it("restores the XP tab only when the box supports it", async () => {
    await init(restored({ ui: { cardId: "big", tab: "xp" } }));
    expect($("#panel-predict").classList.contains("is-hidden")).toBe(false);
  });

  it("ignores tab persistence before a save loads", async () => {
    await init();
    dispatch("#nav-find");
    expect($("#panel-find").classList.contains("is-hidden")).toBe(false);
    expect(stored()).toBeNull();
  });
});

describe("phone screens", () => {
  it("goes back to the Boxes screen and returns to a box", async () => {
    await init(restored());
    expect($("#workspace").dataset.screen).toBe("box");
    dispatch("#back-to-boxes");
    expect($("#workspace").dataset.screen).toBe("boxes");
    expect(document.body.dataset.screen).toBe("boxes");
    expect(location.hash).toBe("#boxes");
    chest("small");
    expect($("#workspace").dataset.screen).toBe("box");
    expect(location.hash).toBe("#box");
    chest("small");
    expect(location.hash).toBe("#box");
  });

  it("opens a tapped box at the top with focus on its name, and keeps focus on desktop", async () => {
    await init(restored());
    const root = document.documentElement;
    let top = 0;
    const scrolls = [];
    Object.defineProperty(root, "scrollTop", { configurable: true, get: () => top, set: (value) => { top = value; scrolls.push(value); } });
    top = 400;
    dispatch("#back-to-boxes");
    expect(top).toBe(0);
    top = 400;
    chest("egg_Rare");
    expect(top).toBe(0);
    expect(document.activeElement).toBe($("#current-chest-name"));
    expect($("#current-chest-name").textContent).toBe("Rare Egg");
    top = 400;
    scrolls.length = 0;
    const tile = $('#box-rail-list [data-card-id="small"]');
    tile.focus();
    tile.click();
    expect(scrolls).toEqual([]);
    expect(top).toBe(400);
    expect(document.activeElement.dataset.cardId).toBe("small");
    delete root.scrollTop;
  });

  it("follows the browser Back and Forward buttons", async () => {
    await init(restored());
    history.replaceState(null, "", "#boxes");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect($("#workspace").dataset.screen).toBe("boxes");
    history.replaceState(null, "", "#box");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect($("#workspace").dataset.screen).toBe("box");
  });
});

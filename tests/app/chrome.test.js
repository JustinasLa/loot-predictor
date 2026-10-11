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

import { $, init, restored, setupApp } from "../helpers/app-harness.js";

setupApp();

const tab = (shiftKey = false) => {
  const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(event);
  return event;
};

describe("app frame", () => {
  it("mounts the HUD with only Help before a save loads", async () => {
    await init();
    expect($("#app-root .hud .hud-title").textContent).toBe("Loot Lookout");
    expect($("#help-trigger").getAttribute("aria-label")).toBe("Help");
    expect($("#user-panel-loggedin").classList.contains("is-hidden")).toBe(true);
    expect($("#toast-region").getAttribute("role")).toBe("status");
  });

  it("traps Tab inside an open sheet", async () => {
    await init(restored());
    $("#help-trigger").click();
    const close = $("#help-sheet .sheet-close");
    expect(document.activeElement).toBe(close);
    // The help sheet has a single control: Tab and Shift+Tab stay on it.
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
  });
});

describe("HUD and frame", () => {
  it("lays out the HUD: back, brand, session pill, help and the hidden save-only group", async () => {
    await init();
    const hud = $(".hud");
    const left = hud.querySelector(".hud-left");
    expect(left.querySelector("#back-to-boxes").getAttribute("aria-label")).toBe("Back to boxes");
    expect(left.querySelector(".hud-brand img").getAttribute("src")).toMatch(/BigChestIcon\.webp$/);
    expect(left.querySelector(".hud-brand .display-text").textContent).toBe("Loot Lookout");
    const right = hud.querySelector(".hud-right");
    expect([...right.children].map((node) => node.id)).toEqual(["session-label", "help-trigger", "user-panel-loggedin"]);
    expect([...$("#user-panel-loggedin").children].map((node) => node.id)).toEqual(["settings-trigger", "user-menu-trigger"]);
    expect($("#session-label").classList.contains("hud-pill")).toBe(true);
    for (const button of hud.querySelectorAll("button")) {
      expect(button.classList.contains("icon-btn")).toBe(true);
      expect(button.classList.contains("btn--primary")).toBe(true);
      const glyph = button.querySelector("svg");
      expect(glyph.getAttribute("aria-hidden")).toBe("true");
      // Only the save button carries a (decorative, aria-hidden) word.
      expect(button.textContent.trim()).toBe(button.id === "user-menu-trigger" ? "Save" : "");
    }
    expect($("#user-menu-trigger .hud-save-label").getAttribute("aria-hidden")).toBe("true");
    // The frame: a rail and a main column inside one workspace.
    expect($("#workspace > #box-rail")).not.toBeNull();
    expect($("#workspace > .box-main")).not.toBeNull();
    expect($("#main-content").contains($("#workspace"))).toBe(true);
    expect($(".scroll-sentinel").getAttribute("aria-hidden")).toBe("true");
  });

  it("shows Settings and Save only once a save is loaded", async () => {
    await init();
    $("#load-demo").click();
    expect($("#user-panel-loggedin").classList.contains("is-hidden")).toBe(false);
    expect($("#workspace").dataset.screen).toBe("box");
  });

  it("matches the browser theme colour to the HUD and turns detail rows off", async () => {
    await init();
    const metas = document.head.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0].content).toBe("#14181f");
    expect(document.body.dataset.details).toBe("off");
    // jsdom has no IntersectionObserver: the HUD simply stays flat.
    expect(document.body.classList.contains("is-scrolled")).toBe(false);
  });
});

describe("chrome helpers", () => {
  it("creates the theme-color meta when the page lacks one", async () => {
    const { syncThemeColor, THEME_COLOR } = await import("../../src/app/chrome.js");
    document.head.querySelector('meta[name="theme-color"]').remove();
    const meta = syncThemeColor();
    expect(meta.parentNode).toBe(document.head);
    expect(meta.getAttribute("content")).toBe(THEME_COLOR);
    expect(syncThemeColor()).toBe(meta);
  });

  it("toggles body.is-scrolled from the top sentinel", async () => {
    const { watchScroll } = await import("../../src/app/chrome.js");
    const observed = [];
    let callback;
    class FakeObserver {
      constructor(fn) { callback = fn; }
      observe(node) { observed.push(node); }
    }
    const observer = watchScroll(document, FakeObserver);
    expect(observer).toBeInstanceOf(FakeObserver);
    expect(observed).toEqual([$(".scroll-sentinel")]);
    callback([{ isIntersecting: false }]);
    expect(document.body.classList.contains("is-scrolled")).toBe(true);
    callback([{ isIntersecting: true }]);
    expect(document.body.classList.contains("is-scrolled")).toBe(false);
  });

  it("does nothing without a sentinel or an IntersectionObserver", async () => {
    const { watchScroll } = await import("../../src/app/chrome.js");
    // jsdom ships no IntersectionObserver, so the defaults observe nothing.
    expect(globalThis.IntersectionObserver).toBeUndefined();
    expect(watchScroll()).toBeNull();
    $(".scroll-sentinel").remove();
    expect(watchScroll(document, class { observe() {} })).toBeNull();
  });
});

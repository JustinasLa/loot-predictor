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

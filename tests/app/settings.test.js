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

import { $, stored, input, init, restored, setupApp } from "../helpers/app-harness.js";

setupApp();

describe("settings sheet", () => {
  it("opens from the gear and keeps every advanced control inside", async () => {
    await init(restored());
    const trigger = $("#settings-trigger");
    trigger.click();
    const sheet = $("#settings-sheet");
    expect(sheet.classList.contains("is-hidden")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    for (const id of ["vault", "seed", "count", "show-details", "open-custom", "open-custom-go"]) {
      expect(sheet.querySelector("#" + id), id).not.toBeNull();
    }
    expect(sheet.querySelectorAll(".open-btn")).toHaveLength(2);
    trigger.click();
    expect(sheet.classList.contains("is-hidden")).toBe(true);
  });

  it("shows seed details only when switched on", async () => {
    await init(restored());
    expect(document.body.dataset.details).toBe("off");
    $("#show-details").checked = true;
    $("#show-details").dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.body.dataset.details).toBe("on");
    $("#show-details").checked = false;
    $("#show-details").dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.body.dataset.details).toBe("off");
  });

  it("hides the Find and XP rows for regular boxes", async () => {
    await init(restored());
    expect($(".find-search-options").classList.contains("is-hidden")).toBe(true);
    expect($("#xp-settings").classList.contains("is-hidden")).toBe(true);
  });

  it("applies the vault chance to the preview and persists it", async () => {
    await init(restored());
    input("#vault", 40);
    expect(stored().ui.vault).toBe("40");
    expect($("#xp-vault").value).toBe("40");
  });
});

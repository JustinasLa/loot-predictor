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

import { $, $$, chest, stored, input, init, restored, setupApp } from "../helpers/app-harness.js";

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

  it("focuses the first control, traps Tab and returns focus to the gear on Escape", async () => {
    await init(restored());
    const trigger = $("#settings-trigger");
    trigger.focus();
    trigger.click();
    const sheet = $("#settings-sheet");
    expect(sheet.querySelector('[role="dialog"]').getAttribute("aria-labelledby")).toBe("settings-title");
    expect($("#settings-title").textContent).toBe("Settings");
    expect(document.activeElement).toBe($("#vault"));
    expect(sheet.contains(document.activeElement)).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(sheet.classList.contains("is-hidden")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    sheet.querySelector(".sheet-close").click();
    expect(sheet.classList.contains("is-hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("orders the rows core, next, marking, find, XP and keeps real labels", async () => {
    await init(restored());
    const sections = $$("#settings-sheet .settings-section");
    expect(sections.map((node) => node.classList[1])).toEqual([
      "settings-core", "settings-next", "settings-marking", "settings-find", "settings-xp",
    ]);
    expect(sections[0].querySelector("#vault + *, #vault")).not.toBeNull();
    expect($("#vault").labels[0].textContent.trim()).toBe("Vault key chance (%)");
    expect($("#seed").labels[0].textContent.replace(/\s+/g, " ").trim()).toBe("Seed Advanced");
    expect($('label[for="seed"] .tag').textContent).toBe("Advanced");
    for (const field of $$("#settings-sheet input[type=number]")) expect(field.labels.length, field.id).toBeGreaterThan(0);
    expect($(".settings-footer").textContent).toBe("Only change these if you know why.");
    expect($("#settings-sheet .settings-footer").previousElementSibling.classList.contains("settings-xp")).toBe(true);
  });

  it("keeps the advanced inputs off the main screens", async () => {
    await init(restored());
    for (const id of ["vault", "seed", "count", "open-custom", "xp-maxopens", "find-maxlevel", "find-maxdepth"]) {
      expect($("#" + id).closest("#settings-sheet"), id).not.toBeNull();
    }
  });

  it("steps the vault chance with the +/- buttons and updates the preview", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    const before = $("#out").textContent;
    const more = $('[data-step-for="vault"][data-step="1"]');
    expect(more.getAttribute("aria-label")).toBe("More Vault key chance (%)");
    input("#vault", 99);
    more.click();
    more.click();
    expect($("#vault").value).toBe("100");
    expect($("#xp-vault").value).toBe("100");
    expect(stored().ui.vault).toBe("100");
    expect($("#out").textContent).not.toBe(before);
    $('[data-step-for="vault"][data-step="-1"]').click();
    expect($("#vault").value).toBe("99");
  });

  it("shows the key that the current box drops", async () => {
    await init(restored({ ui: { cardId: "adventure_Zeus" } }));
    $("#settings-trigger").click();
    expect($("#vault-key-art").getAttribute("src")).toMatch(/\/ZeusKeyIcon\.webp$/);
    $("#settings-trigger").click();
    chest("adventure_Pirate");
    $("#settings-trigger").click();
    expect($("#vault-key-art").getAttribute("src")).toMatch(/\/PirateKeyIcon\.webp$/);
  });

  it("rejects an invalid seed with the field name and restores the live seed", async () => {
    await init(restored());
    const seed = $("#seed").value;
    expect($("#seed").disabled).toBe(false);
    input("#seed", "1.5");
    expect($("#seed").value).toBe(seed);
    expect($("#out .error-box").textContent).toMatch(/^Oops! That didn't work\. /);
    input("#seed", 12345);
    expect(stored().live.big.seed).toBe(12345);
  });
});

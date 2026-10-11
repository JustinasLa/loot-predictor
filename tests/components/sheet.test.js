// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

let sheet;
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = `
    <button id="opener" aria-expanded="false">Open</button>
    <div id="demo-sheet" class="sheet-layer is-hidden">
      <div class="sheet-backdrop" data-sheet-close></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <button id="first" data-sheet-close aria-label="Close">x</button>
        <button id="hidden-one" class="is-hidden">Hidden</button>
        <input id="middle" />
        <input id="secret" type="hidden" />
        <button id="last" data-sheet-action>Go</button>
      </div>
    </div>
    <div id="empty-sheet" class="sheet-layer is-hidden"><div class="sheet"><p>Nothing to focus</p></div></div>`;
  sheet = await import("../../src/ui/components/sheet.js");
  sheet.initSheets();
});

const key = (name, shiftKey = false) => {
  const event = new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  return event;
};
const $ = (selector) => document.querySelector(selector);

describe("sheet component", () => {
  it("makes the page behind inert while any sheet is open, keeping what was already inert", () => {
    document.body.insertAdjacentHTML("afterbegin", '<header class="hud"></header><main id="main-content" inert></main>');
    sheet.openSheet("demo-sheet");
    expect($(".hud").hasAttribute("inert")).toBe(true);
    sheet.openSheet("empty-sheet");
    sheet.closeSheet("empty-sheet");
    // Another sheet is still open: the background stays inert.
    expect($(".hud").hasAttribute("inert")).toBe(true);
    sheet.closeSheet("demo-sheet");
    expect($(".hud").hasAttribute("inert")).toBe(false);
    expect($("#main-content").hasAttribute("inert")).toBe(true);
    expect("inertWas" in $(".hud").dataset).toBe(false);
  });

  it("works on pages without a HUD or main region", () => {
    sheet.openSheet("demo-sheet");
    sheet.closeSheet("demo-sheet");
    expect($("#demo-sheet").classList.contains("is-hidden")).toBe(true);
  });

  it("opens with focus on the first control and restores focus on close", () => {
    const opener = $("#opener");
    opener.focus();
    sheet.openSheet("demo-sheet", opener);
    expect($("#demo-sheet").classList.contains("is-hidden")).toBe(false);
    expect(opener.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe($("#first"));
    expect(sheet.isSheetOpen("demo-sheet")).toBe(true);
    sheet.openSheet("demo-sheet", opener);
    $("#first").click();
    expect($("#demo-sheet").classList.contains("is-hidden")).toBe(true);
    expect(opener.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(opener);
    sheet.closeSheet("demo-sheet");
    expect(sheet.isSheetOpen("demo-sheet")).toBe(false);
  });

  it("toggles, closes from actions and the backdrop, and ignores clicks elsewhere", () => {
    sheet.toggleSheet("demo-sheet", $("#opener"));
    $("#middle").click();
    expect(sheet.isSheetOpen("demo-sheet")).toBe(true);
    $("#last").click();
    expect(sheet.isSheetOpen("demo-sheet")).toBe(false);
    sheet.toggleSheet("demo-sheet", $("#opener"));
    $(".sheet-backdrop").click();
    expect(sheet.isSheetOpen("demo-sheet")).toBe(false);
    sheet.toggleSheet("demo-sheet", $("#opener"));
    sheet.toggleSheet("demo-sheet", $("#opener"));
    expect(sheet.isSheetOpen("demo-sheet")).toBe(false);
  });

  it("traps Tab, closes the newest sheet on Escape and opens without a trigger", () => {
    sheet.openSheet("demo-sheet");
    $("#last").focus();
    expect(key("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($("#first"));
    expect(key("Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($("#last"));
    $("#middle").focus();
    expect(key("Tab").defaultPrevented).toBe(false);
    $("#opener").focus();
    expect(key("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($("#first"));
    expect(key("ArrowDown").defaultPrevented).toBe(false);
    key("Escape");
    expect(sheet.isSheetOpen("demo-sheet")).toBe(false);
    expect(document.activeElement).toBe($("#first"));
  });

  it("ignores keys with no open sheet or a detached sheet", () => {
    expect(key("Escape").defaultPrevented).toBe(false);
    sheet.openSheet("empty-sheet");
    expect(sheet.isSheetOpen("empty-sheet")).toBe(true);
    $("#empty-sheet").remove();
    expect(key("Escape").defaultPrevented).toBe(false);
  });
});

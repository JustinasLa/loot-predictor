// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { bodyHtml } from "./helpers/html.js";

const html = bodyHtml();
import { renderChestList, renderItemPicker, renderResults, renderError } from "../src/ui/render.js";
import { item } from "./fixtures.js";
import { initSteppers } from "../src/ui/components/stepper.js";

// Stepper buttons get their names from one rule in stepper.js.
const mountShell = () => {
  document.body.innerHTML = html;
  initSteppers(document);
};

beforeEach(() => { document.body.innerHTML = ""; });

describe("keyboard-accessible controls", () => {
  it("provides native, focusable save-loading and HUD buttons", () => {
    mountShell();

    for (const id of ["load-save", "load-save-menu", "welcome-load-save", "load-demo", "help-trigger", "settings-trigger", "user-menu-trigger", "back-to-boxes"]) {
      const button = document.getElementById(id);
      expect(button.tagName).toBe("BUTTON");
      expect(button.type).toBe("button");
      expect(button.tabIndex).toBe(0);
    }
    const loadButton = document.getElementById("load-save");
    loadButton.focus();
    expect(document.activeElement).toBe(loadButton);

    for (const button of document.querySelectorAll(".hud button, .sheet-close, [data-step-for]")) {
      expect(button.getAttribute("aria-label")?.trim(), button.outerHTML).toBeTruthy();
    }
    for (const sheet of document.querySelectorAll(".sheet")) {
      expect(sheet.getAttribute("role")).toBe("dialog");
      expect(sheet.getAttribute("aria-modal")).toBe("true");
      expect(document.getElementById(sheet.getAttribute("aria-labelledby")).textContent.trim()).not.toBe("");
    }
    expect(document.getElementById("open-custom").labels[0].textContent.trim()).not.toBe("");
  });

  it("offers a focusable shortcut past navigation and names every form control", () => {
    mountShell();
    const skip = document.querySelector('a[href="#main-content"]');
    const main = document.getElementById("main-content");
    expect(skip).not.toBeNull();
    expect(skip.textContent.trim()).not.toBe("");
    expect(main.tagName).toBe("MAIN");
    main.focus();
    expect(document.activeElement).toBe(main);

    for (const control of document.querySelectorAll("input, select, textarea")) {
      const labels = [...control.labels].map((label) => label.textContent.trim()).join(" ");
      const ariaLabel = control.getAttribute("aria-label")?.trim();
      const labelledBy = control.getAttribute("aria-labelledby")?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent.trim()).join(" ");
      expect(labels || ariaLabel || labelledBy, `Missing name for #${control.id}`).toBeTruthy();
    }
  });

  it("keeps accessible labels and control relationships valid throughout the shell", () => {
    mountShell();
    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const attribute of ["aria-controls", "aria-labelledby", "aria-describedby"]) {
      for (const control of document.querySelectorAll(`[${attribute}]`)) {
        for (const id of control.getAttribute(attribute).split(/\s+/)) {
          expect(document.getElementById(id), `${attribute} references missing #${id}`).not.toBeNull();
        }
      }
    }
    for (const button of document.querySelectorAll("button")) {
      expect(button.getAttribute("aria-label")?.trim() || button.textContent.trim(),
        `Missing button name for #${button.id}`).toBeTruthy();
    }
    for (const button of document.querySelectorAll(".open-btn")) {
      const name = button.getAttribute("aria-label") || button.textContent;
      expect(name).toMatch(/mark|track|simulate/i);
      expect(name).toContain(button.dataset.open);
    }
  });

  it("names every icon button, gives every image an alt and wires the HUD sheet triggers", () => {
    mountShell();
    const iconButtons = document.querySelectorAll(".icon-btn");
    expect(iconButtons.length).toBeGreaterThan(0);
    for (const button of iconButtons) {
      expect(button.getAttribute("aria-label")?.trim(), button.outerHTML).toBeTruthy();
    }
    const images = document.querySelectorAll("img");
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.hasAttribute("alt"), image.outerHTML).toBe(true);
    }
    for (const [id, sheet] of [["settings-trigger", "settings-sheet"], ["help-trigger", "help-sheet"], ["user-menu-trigger", "user-menu"]]) {
      const trigger = document.getElementById(id);
      expect(trigger.getAttribute("aria-controls")).toBe(sheet);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      const target = document.getElementById(sheet);
      expect(target, `#${id} controls a missing sheet`).not.toBeNull();
      expect(target.querySelector('[role="dialog"]')).not.toBeNull();
    }
    // Decorative HUD glyphs stay out of the accessibility tree.
    for (const glyph of document.querySelectorAll(".hud svg")) {
      expect(glyph.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("keeps the focused item selected and usable through repeated activation", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const selected = new Set();
    const items = [item("A"), item("B", "Epic")];
    const draw = () => renderItemPicker(container, items, selected, (baseName) => {
      if (selected.has(baseName)) selected.delete(baseName);
      else selected.add(baseName);
      draw();
    });
    draw();
    const original = container.children[1];
    original.focus();
    // Native keyboard activation produces a click; jsdom does not synthesize
    // that browser default action from key events.
    original.click();

    expect(document.activeElement).not.toBe(original);
    expect(document.activeElement.dataset.baseName).toBe("B");
    expect(document.activeElement.getAttribute("aria-pressed")).toBe("true");
    expect(container.children[0].getAttribute("aria-pressed")).toBe("false");
    document.activeElement.click();
    expect(document.activeElement.dataset.baseName).toBe("B");
    expect(document.activeElement.getAttribute("aria-pressed")).toBe("false");
    expect(selected.size).toBe(0);
  });

  it("preserves rail focus while box groups redraw after selection", () => {
    const boxes = document.createElement("div");
    const find = document.createElement("div");
    document.body.append(boxes, find);
    const states = { small: {}, big: {} };
    let active = "small";
    const draw = () => {
      for (const container of [boxes, find]) {
        renderChestList(container, states, active, (id) => { active = id; draw(); });
      }
    };
    draw();
    find.children[1].focus();
    find.children[1].click();

    expect(document.activeElement).toBe(find.children[1]);
    expect(document.activeElement.dataset.cardId).toBe("big");
    expect(document.activeElement.getAttribute("aria-current")).toBe("true");
    expect(find.children[0].hasAttribute("aria-current")).toBe(false);
  });

  it("does not move focus into either renderer during unrelated updates", () => {
    const outside = document.createElement("button");
    const chests = document.createElement("div");
    const items = document.createElement("div");
    document.body.append(outside, chests, items);
    outside.focus();
    renderChestList(chests, { small: {} }, "small", () => {});
    renderItemPicker(items, [item()], new Set(), () => {});
    expect(document.activeElement).toBe(outside);
  });
});

describe("accessible game artwork", () => {
  it("keeps item names, rarity and selection readable independently of the art", () => {
    const container = document.createElement("div");
    document.body.append(container);
    renderItemPicker(container, [item("Ring_Bronze", "Common"), item("Ring_Gold", "Epic")],
      new Set(["Ring_Bronze"]), () => {});
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.querySelector(".item-name").textContent.trim()).not.toBe("");
      expect(button.querySelector(".item-name").textContent).not.toContain("_");
      expect(button.querySelector(".item-rarity").textContent).toBe(button.dataset.rarity);
      expect(button.getAttribute("aria-pressed")).toBe(String(button.dataset.baseName === "Ring_Bronze"));
      const art = button.querySelector("img");
      expect(art).not.toBeNull();
      // The adjacent visible name already identifies the item. Repeating it
      // as image alt text would make each button unnecessarily verbose.
      expect(art.getAttribute("alt")).toBe("");
      expect(art.tabIndex).toBe(-1);
    }
  });

  it("exposes predicted drops as a readable list even when images are unavailable", () => {
    const container = document.createElement("div");
    renderResults(container, "adventure_Zeus", [{
      open: 1, seed: 42, nextSeed: 123, level: 5,
      items: [item("Ring_Bronze", "Common"), item("Ring_Gold", "Epic")],
    }], () => {});
    const list = container.querySelector("ul");
    expect(list).not.toBeNull();
    expect(list.querySelectorAll("li")).toHaveLength(2);
    for (const drop of list.querySelectorAll("li")) {
      const name = drop.querySelector(".item-name").textContent;
      const rarity = drop.querySelector(".item-rarity").textContent;
      drop.querySelector("img").dispatchEvent(new Event("error"));
      expect(drop.querySelector(".item-name").textContent).toBe(name);
      expect(drop.querySelector(".item-rarity").textContent).toBe(rarity);
    }
    expect(container.querySelector(".open-card-btn").textContent).toBe("I opened it!");
  });
});

describe("accessible state feedback", () => {
  it("keeps live status regions in the document and announces rendered errors", () => {
    document.body.innerHTML = html;
    for (const id of ["open-status", "xp-status", "find-status", "import-status"]) {
      expect(document.getElementById(id).getAttribute("role")).toBe("status");
    }
    expect(document.getElementById("toast-region").getAttribute("aria-live")).toBe("polite");
    const trigger = document.getElementById("user-menu-trigger");
    expect(trigger.getAttribute("aria-controls")).toBe("user-menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    const out = document.getElementById("out");
    renderError(out, "invalid save");
    expect(out.querySelector('[role="alert"]').textContent).toContain("invalid save");
  });
});

describe("keyboard navigation through the workspace", () => {
  it("moves focus into a loaded workspace, supports tabs and restores focus after Escape", async () => {
    document.body.innerHTML = html;
    localStorage.clear();
    await import("../src/app.js");
    const demo = document.getElementById("load-demo");
    demo.focus();
    demo.click();
    expect(document.activeElement).toBe(document.getElementById("current-chest-name"));
    expect(document.activeElement.closest(".is-hidden, [hidden]")).toBeNull();

    const predict = document.getElementById("nav-predict");
    const find = document.getElementById("nav-find");
    const press = (target, key) => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    const selected = (active, inactive) => {
      expect(document.activeElement).toBe(active);
      expect(active.getAttribute("aria-selected")).toBe("true");
      expect(active.tabIndex).toBe(0);
      expect(inactive.getAttribute("aria-selected")).toBe("false");
      expect(inactive.tabIndex).toBe(-1);
      const panel = document.getElementById(active.getAttribute("aria-controls"));
      expect(panel.getAttribute("role")).toBe("tabpanel");
      expect(panel.getAttribute("aria-labelledby")).toBe(active.id);
      expect(panel.classList.contains("is-hidden")).toBe(false);
    };

    predict.focus();
    press(predict, "ArrowRight");
    selected(find, predict);
    press(find, "ArrowRight");
    selected(predict, find);
    press(predict, "ArrowLeft");
    selected(find, predict);
    press(find, "Home");
    selected(predict, find);
    press(predict, "End");
    selected(find, predict);

    const trigger = document.getElementById("user-menu-trigger");
    trigger.click();
    expect(document.activeElement.closest("#user-menu")).not.toBeNull();
    press(document.activeElement, "Escape");
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("user-menu").classList.contains("is-hidden")).toBe(true);

    localStorage.clear();
  });
});

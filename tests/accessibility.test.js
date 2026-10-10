// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import html from "../index.html?raw";
import { renderChestList, renderItemPicker, renderError } from "../src/ui/render.js";
import { item } from "./fixtures.js";

beforeEach(() => { document.body.innerHTML = ""; });

describe("keyboard-accessible controls", () => {
  it("provides native, focusable save-loading and category buttons", () => {
    document.body.innerHTML = html;

    for (const id of ["load-save", "load-save-menu"]) {
      const button = document.getElementById(id);
      expect(button.tagName).toBe("BUTTON");
      expect(button.type).toBe("button");
      expect(button.tabIndex).toBe(0);
    }
    const loadButton = document.getElementById("load-save");
    loadButton.focus();
    expect(document.activeElement).toBe(loadButton);

    for (const button of document.querySelectorAll(".channel-category-head")) {
      expect(button.tagName).toBe("BUTTON");
      button.focus();
      expect(document.activeElement).toBe(button);
      expect(document.getElementById(button.getAttribute("aria-controls"))).not.toBeNull();
      expect(button.getAttribute("aria-expanded")).toBe("true");
    }
    expect(document.getElementById("open-custom").labels[0].textContent).toBe("custom");
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

  it("preserves sidebar focus while both chest lists redraw after selection", () => {
    const predict = document.createElement("div");
    const find = document.createElement("div");
    document.body.append(predict, find);
    const states = { small: {}, big: {} };
    let active = "small";
    const draw = () => {
      for (const container of [predict, find]) {
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

describe("accessible state feedback", () => {
  it("keeps live status regions in the document and announces rendered errors", () => {
    document.body.innerHTML = html;
    for (const id of ["open-status", "xp-status", "find-status"]) {
      expect(document.getElementById(id).getAttribute("role")).toBe("status");
    }
    const trigger = document.getElementById("user-menu-trigger");
    expect(trigger.getAttribute("aria-controls")).toBe("user-menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    const out = document.getElementById("out");
    renderError(out, "invalid save");
    expect(out.querySelector('[role="alert"]').textContent).toContain("invalid save");
  });
});

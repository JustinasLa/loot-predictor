// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("predictions renderer", () => {
  it("moves keyboard focus to the next opening after recording progress", () => {
    document.body.append(container);
    let remaining = [opening(), opening(2)];
    const record = (count) => {
      remaining = remaining.slice(count);
      draw();
    };
    const draw = () => renderResults(container, "big", remaining, record);
    draw();
    const previous = container.querySelector("button");
    previous.focus();
    previous.click();
    expect(previous.isConnected).toBe(false);
    expect(document.activeElement).toBe(container.querySelector("button"));
    expect(container.querySelector(".open-title").textContent).toBe("Next box");
    document.activeElement.click();
    expect(document.activeElement).toBe(container);
    expect(container.tabIndex).toBe(-1);
    expect(container.querySelector("button")).toBeNull();
  });

  it("preserves deliberate focus changes made by an opening callback", () => {
    const destination = document.createElement("button");
    document.body.append(destination, container);
    renderResults(container, "big", [opening()], () => {
      renderResults(container, "big", [opening(2)], vi.fn());
      destination.focus();
    });
    const button = container.querySelector("button");
    button.focus();
    button.click();
    expect(document.activeElement).toBe(destination);
  });

  it("keeps existing focus when an opening action does not redraw its button", () => {
    document.body.append(container);
    const record = vi.fn();
    renderResults(container, "big", [opening()], record);
    const button = container.querySelector("button");
    button.focus();
    button.click();
    expect(record).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(button);
  });

  it("does not steal focus for an opening triggered while another control is focused", () => {
    const outside = document.createElement("button");
    document.body.append(outside, container);
    renderResults(container, "big", [opening()], () => renderResults(container, "big", [opening(2)], vi.fn()));
    outside.focus();
    container.querySelector("button").click();
    expect(document.activeElement).toBe(outside);
  });

  it("labels chained open actions, reports vault rolls and renders item rarities", () => {
    const open = vi.fn();
    renderResults(container, "big", [opening(), opening(2, { keyRoll: 12 })], open);
    const buttons = container.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual(["I opened it!", "I opened up to #2"]);
    expect(buttons[0].title).toBe("Marks this box opened");
    expect(buttons[1].title).toBe("Marks 2 boxes opened");
    buttons[0].click();
    buttons[1].click();
    expect(open.mock.calls).toEqual([[1], [2]]);
    expect(container.textContent).toContain("Key roll 12");
    expect(container.querySelector("li").dataset.rarity).toBe("Common");
  });

  describe("collapse after marking", () => {
    const setup = () => {
      const panel = document.createElement("section");
      const leaving = document.createElement("div");
      leaving.className = "out-leaving";
      panel.append(leaving, container);
      document.body.append(panel);
      return leaving;
    };
    afterEach(() => {
      delete window.matchMedia;
      vi.useRealTimers();
    });

    it("folds up to five opened cards into the silent sibling, then clears it", () => {
      vi.useFakeTimers();
      window.matchMedia = vi.fn(() => ({ matches: false }));
      const leaving = setup();
      const chain = Array.from({ length: 8 }, (_, index) => opening(index + 1));
      const draw = (from) => renderResults(container, "big", chain.slice(from), (count) => draw(from + count));
      draw(0);
      container.querySelectorAll(".open-card-btn")[6].click();
      expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
      expect(leaving.children).toHaveLength(5);
      expect([...leaving.children].every((card) => card.classList.contains("is-collapsing"))).toBe(true);
      expect(leaving.querySelector("button")).toBeNull();
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild.classList.contains("is-arriving")).toBe(true);
      vi.advanceTimersByTime(250);
      expect(leaving.children).toHaveLength(0);
    });

    it("stays instant under reduced motion or without matchMedia", () => {
      const leaving = setup();
      const draw = () => renderResults(container, "big", [opening(), opening(2)], draw);
      draw();
      container.querySelector(".open-card-btn").click();
      expect(leaving.children).toHaveLength(0);
      window.matchMedia = vi.fn(() => ({ matches: true }));
      container.querySelector(".open-card-btn").click();
      expect(leaving.children).toHaveLength(0);
      expect(container.querySelector(".is-arriving")).toBeNull();
    });

    it("skips the animation without a leaving sibling or when the redraw shows no cards", () => {
      window.matchMedia = vi.fn(() => ({ matches: false }));
      const draw = () => renderResults(container, "big", [opening()], draw);
      document.body.append(container);
      draw();
      container.querySelector(".open-card-btn").click();
      expect(container.querySelector(".is-arriving")).toBeNull();
      const other = document.createElement("div");
      container.before(other);
      container.querySelector(".open-card-btn").click();
      expect(other.children).toHaveLength(0);
      const leaving = setup();
      renderResults(container, "big", [opening()], () => { container.textContent = ""; });
      container.querySelector(".open-card-btn").click();
      renderResults(container, "big", [opening()], () => { container.innerHTML = "<p class='error-box'>Oops</p>"; });
      container.querySelector(".open-card-btn").click();
      expect(leaving.children).toHaveLength(0);
      expect(window.matchMedia).not.toHaveBeenCalled();
    });
  });
});

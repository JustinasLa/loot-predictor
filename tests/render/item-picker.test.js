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

describe("item-picker renderer", () => {
  it("restores the exact rarity of a selected item after a redraw", () => {
    document.body.append(container);
    const items = [item("A", "Common"), item("A", "Epic"), item("B", "Epic")];
    renderItemPicker(container, items, new Set(), vi.fn());
    container.children[1].focus();
    renderItemPicker(container, items, new Set(["A"]), vi.fn());
    expect(document.activeElement).toBe(container.children[1]);
    expect(document.activeElement.dataset.rarity).toBe("Epic");
    expect(document.activeElement.getAttribute("aria-pressed")).toBe("true");
    expect(container.children[0].getAttribute("aria-pressed")).toBe("true");
    expect(container.children[2].getAttribute("aria-pressed")).toBe("false");
  });

  it("does not focus a different item when the previously focused item disappears", () => {
    document.body.append(container);
    renderItemPicker(container, [item("A"), item("B")], new Set(), vi.fn());
    container.children[1].focus();
    renderItemPicker(container, [item("A")], new Set(), vi.fn());
    expect(document.activeElement).not.toBe(container.children[0]);
  });

  it("searches friendly names and internal IDs without changing selected targets", () => {
    const items = [item("Tool_LaserGun", "Ultimate"), item("Ring_Bronze"), item("Pet_RedPanda", "Ultimate")];
    const selected = new Set(["Ring_Bronze"]);
    const toggle = vi.fn();
    renderItemPicker(container, items, selected, toggle, { query: "  LASER gun  ", rarity: "ULTIMATE" });
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector(".item-name").textContent).toBe("Laser Gun");
    container.querySelector("button").click();
    expect(toggle).toHaveBeenCalledWith("Tool_LaserGun");
    expect([...selected]).toEqual(["Ring_Bronze"]);
    renderItemPicker(container, items, selected, toggle, { query: "ring_bronze", rarity: "all" });
    expect(container.querySelector("button").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".item-check").getAttribute("aria-hidden")).toBe("true");
  });

  it("filters combined item rarities using either supported representation", () => {
    const common = item("Ring_Bronze");
    const combined = { ...item("Pet_RedPanda", "Legendary / Ultimate"), rarities: ["Legendary", "Ultimate"] };
    const combinedLabel = item("Pet_Panda", "Epic / Legendary");
    renderItemPicker(container, [common, combined, combinedLabel], new Set(), vi.fn(), { rarity: "LEGENDARY" });
    expect([...container.querySelectorAll("button")].map((button) => button.dataset.baseName)).toEqual(["Pet_RedPanda", "Pet_Panda"]);
    renderItemPicker(container, [common, combined], new Set(), vi.fn(), { query: "common", rarity: "common" });
    expect(container.querySelector("button").dataset.baseName).toBe("Ring_Bronze");
  });

  it("explains an empty filtered list and restores items when filters are cleared", () => {
    const items = [item("Ring_Bronze")];
    renderItemPicker(container, items, new Set(), vi.fn(), { query: "Panda" });
    expect(container.textContent).toBe("No match.");
    expect(container.querySelector("button")).toBeNull();
    renderItemPicker(container, items, new Set(), vi.fn(), { query: "", rarity: "" });
    expect(container.querySelector(".item-name").textContent).toBe("Bronze Ring");
  });

  it("renders selected and unselected item chips and toggles by base name", () => {
    const toggle = vi.fn();
    renderItemPicker(container, [item("A"), item("B", "Epic")], new Set(["A"]), toggle);
    expect([...container.children].map((chip) => chip.dataset.on)).toEqual(["yes", "no"]);
    container.children[1].click();
    expect(toggle).toHaveBeenCalledWith("B");
    renderItemPicker(container, [], new Set(), toggle);
    expect(container.textContent).toBe("Nothing to find in this box.");
  });
});

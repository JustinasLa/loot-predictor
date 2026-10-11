// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { bindChipsToSelect } from "../../src/ui/components/chips.js";

describe("chips component", () => {
  it("mirrors a select and only fires change when the value changes", () => {
    document.body.innerHTML = `
      <div id="chips">
        <button class="chip" data-value="all">All</button>
        <button class="chip" data-value="rare">Rare</button>
      </div>
      <select id="pick"><option value="all">All</option><option value="rare">Rare</option></select>`;
    const select = document.getElementById("pick");
    const [all, rare] = document.querySelectorAll(".chip");
    const changed = vi.fn();
    select.addEventListener("change", changed);
    const sync = bindChipsToSelect(document.getElementById("chips"), select);
    expect(all.getAttribute("aria-pressed")).toBe("true");
    rare.click();
    expect(select.value).toBe("rare");
    expect(rare.getAttribute("aria-pressed")).toBe("true");
    expect(all.getAttribute("aria-pressed")).toBe("false");
    rare.click();
    expect(changed).toHaveBeenCalledTimes(1);
    select.value = "all";
    sync();
    expect(all.getAttribute("aria-pressed")).toBe("true");
    select.value = "rare";
    select.dispatchEvent(new Event("change"));
    expect(rare.getAttribute("aria-pressed")).toBe("true");
  });
});

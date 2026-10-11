// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { initSteppers } from "../../src/ui/components/stepper.js";

describe("stepper component", () => {
  it("clamps to min and max, fires input and change, and names its buttons", () => {
    document.body.innerHTML = `
      <label for="lvl">Level</label>
      <button data-step-for="lvl" data-step="-1"></button>
      <input id="lvl" type="number" min="1" max="3" value="2" />
      <button data-step-for="lvl" data-step="1"></button>`;
    initSteppers();
    const [less, more] = document.querySelectorAll("button");
    const input = document.getElementById("lvl");
    const events = vi.fn();
    input.addEventListener("input", () => events("input"));
    input.addEventListener("change", () => events("change"));
    expect(less.getAttribute("aria-label")).toBe("Decrease Level");
    expect(more.getAttribute("aria-label")).toBe("Increase Level");
    more.click();
    more.click();
    expect(input.value).toBe("3");
    less.click();
    less.click();
    less.click();
    expect(input.value).toBe("1");
    expect(events.mock.calls.slice(0, 2)).toEqual([["input"], ["change"]]);
    input.value = "";
    more.click();
    expect(input.value).toBe("1");
  });

  it("drops a trailing question mark or colon from the label", () => {
    document.body.innerHTML = `
      <label for="n">How many?</label><input id="n" type="number" />
      <button data-step-for="n" data-step="1"></button>
      <label for="m">Keys:</label><input id="m" type="number" />
      <button data-step-for="m" data-step="-1"></button>`;
    initSteppers();
    expect([...document.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")))
      .toEqual(["Increase How many", "Decrease Keys"]);
  });

  it("works without limits, keeps given labels and handles unlabelled inputs", () => {
    document.body.innerHTML = `
      <div id="root">
        <button data-step-for="free" data-step="1" aria-label="Up"></button>
        <input id="free" type="number" />
        <button data-step-for="free" data-step="-1"></button>
      </div>`;
    initSteppers(document.getElementById("root"));
    const [up, down] = document.querySelectorAll("button");
    expect(up.getAttribute("aria-label")).toBe("Up");
    expect(down.getAttribute("aria-label")).toBe("Decrease");
    up.click();
    expect(document.getElementById("free").value).toBe("0");
    up.click();
    down.click();
    down.click();
    expect(document.getElementById("free").value).toBe("-1");
  });
});

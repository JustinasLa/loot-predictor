// Settings sheet rows must fit narrow phones (issue #16). jsdom has no layout,
// so these guard the CSS rules that let each row shrink instead of overflowing.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/ui/styles/settings.css", import.meta.url), "utf8")
  .replace(/\r\n/g, "\n");

describe("settings sheet on narrow screens", () => {
  it("never forces setting labels onto one line", () => {
    expect(css).not.toMatch(/white-space:\s*nowrap/);
  });

  it("lets the label shrink beside its field", () => {
    expect(css).toMatch(/\n\.setting-row > label\s*\{[^}]*flex:\s*1;[^}]*min-width:\s*0/);
  });

  it("stacks the key-drop stepper under its label on phones", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(phone).toMatch(/\.setting-row--vault\s*\{[^}]*flex-direction:\s*column/);
  });
});

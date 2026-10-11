// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PARTIALS, mountShell, shellMarkup } from "../src/ui/shell.js";
import { documentHtml } from "./helpers/html.js";

describe("app shell", () => {
  it("fills every slot, including slots inside partials, and the base URL", () => {
    const markup = shellMarkup();
    expect(markup).not.toMatch(/\{\{/);
    expect(markup).toContain('src="/assets/items/BigChestIcon.webp"');
    expect(shellMarkup("./")).toContain('src="./assets/items/BigChestIcon.webp"');
    const root = document.createElement("div");
    expect(mountShell(root)).toBe(root);
    for (const id of ["welcome-screen", "workspace", "out", "history", "find-out", "xp-out", "settings-sheet", "user-menu", "help-sheet", "count", "find-maxlevel", "xp-maxopens", "open-custom"]) {
      expect(root.querySelector("#" + id), id).not.toBeNull();
    }
    expect(documentHtml()).toContain('<div id="app-root"><!-- area:phone-shell-polish start');
  });

  it("marks each partial with its workstream area", () => {
    for (const [name, partial] of Object.entries(PARTIALS)) {
      expect(partial, name).toMatch(/<!-- area:[a-z-]+ start/);
      expect(partial, name).toMatch(/<!-- area:[a-z-]+ end -->/);
    }
  });

  it("rejects unknown and recursive slots", () => {
    expect(() => shellMarkup("/", {}, "{{slot:nope}}")).toThrow("Unknown shell slot: nope");
    expect(() => shellMarkup("/", { a: "{{slot:b}}", b: "{{slot:a}}" }, "{{slot:a}}")).toThrow("Recursive shell slot: a");
  });
});

// Page head, app icons and the web manifest (workstream phone-shell-polish).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
// Normalise line endings so checks pass on Windows checkouts with autocrlf.
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const head = read("index.html").match(/<head>([\s\S]*)<\/head>/)[1];
const PNG = [0x89, 0x50, 0x4e, 0x47];

function pngSize(path) {
  const bytes = readFileSync(new URL(path, root));
  expect([...bytes.subarray(0, 4)]).toEqual(PNG);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("page head", () => {
  it("sets the title, description, viewport and theme colour", () => {
    expect(head).toContain("<title>Loot Lookout</title>");
    expect(head).toContain('<meta name="description" content="See what\'s in your next Eatventure box." />');
    expect(head).toMatch(/name="viewport" content="[^"]*viewport-fit=cover/);
    expect(head).toContain('<meta name="theme-color" content="#14181f" />');
  });

  it("links the favicon, touch icon and manifest through the base URL", () => {
    const links = [...head.matchAll(/<link rel="(icon|apple-touch-icon|manifest)"[^>]*href="%BASE_URL%([^"]+)"/g)]
      .map(([, rel, path]) => [rel, path]);
    expect(Object.fromEntries(links)).toEqual({
      icon: "icons/favicon-32.png",
      "apple-touch-icon": "icons/apple-touch-icon.png",
      manifest: "manifest.webmanifest",
    });
    for (const [, path] of links) expect(existsSync(new URL(`public/${path}`, root)), path).toBe(true);
  });
});

describe("app icons and manifest", () => {
  it("ships real PNG icons at the declared sizes", () => {
    expect(pngSize("public/icons/favicon-32.png")).toEqual([32, 32]);
    expect(pngSize("public/icons/apple-touch-icon.png")).toEqual([180, 180]);
    expect(pngSize("public/icons/icon-192.png")).toEqual([192, 192]);
    expect(pngSize("public/icons/icon-512.png")).toEqual([512, 512]);
  });

  it("describes the installed app with relative paths", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    expect(manifest.name).toBe("Loot Lookout");
    expect(manifest.theme_color).toBe("#14181f");
    expect(manifest.background_color).toBe("#4fb3ff");
    expect(manifest.start_url).toBe("./");
    for (const icon of manifest.icons) {
      expect(icon.src).not.toMatch(/^\//);
      const [w, h] = pngSize(`public/${icon.src}`);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });
});

describe("phone frame rules", () => {
  const mobile = read("src/ui/styles/mobile.css");
  const shell = read("src/ui/styles/shell.css");

  it("reserves room for the sticky action bar only while one is on screen", () => {
    expect(mobile).toContain(".action-bar:not(.is-hidden)) {\n    padding-bottom: var(--bar-room);");
    expect(mobile).toContain("env(safe-area-inset-bottom)");
    expect(mobile).toMatch(/\.toast-region \{\s*bottom: calc\(var\(--bar-room\)/);
  });

  it("switches phone screens with data-screen, never is-hidden, and pins the tabs", () => {
    expect(mobile).toContain('.workspace[data-screen="boxes"] .box-main { display: none; }');
    expect(mobile).toContain('.workspace[data-screen="box"] .box-rail { display: none; }');
    expect(mobile).toMatch(/\.seg-tabs \{\s*position: sticky;/);
  });

  it("keeps the awning as the only decoration, respects safe areas and reduced motion", () => {
    expect(shell).toContain("repeating-linear-gradient(90deg, #e6bd3c 0 16px, #fff 16px 32px)");
    expect(shell).toContain("env(safe-area-inset-top");
    expect(read("src/ui/styles/base.css")).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none !important[\s\S]*transition: none !important/);
  });
});

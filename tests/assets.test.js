import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { CHEST_ID_MAP, EGG_RARITY_MAP, ITEM_POOLS } from "../src/loot/tables.js";
import { getChestPresentation, getItemPresentation } from "../src/ui/presentation.js";

const artDirectory = new URL("../public/assets/items/", import.meta.url);
const itemIds = [...new Set([
  ...Object.values(ITEM_POOLS).flat(),
  "PetFood", "ZeusKeyIcon", "PirateKeyIcon",
])];
const cardIds = [...new Set([
  ...Object.values(CHEST_ID_MAP),
  ...Object.values(EGG_RARITY_MAP),
])];

function expectBundledImage(image, label) {
  expect(image, `${label} needs bundled game artwork`).toBeTypeOf("string");
  const url = new URL(image, "https://example.test/loot-predictor/");
  expect(url.origin, `${label} should work without contacting an image host`)
    .toBe("https://example.test");
  expect(url.pathname, `${label} should use the local item directory`)
    .toMatch(/\/assets\/items\/[A-Za-z0-9_]+\.(?:png|webp)$/);
  const file = url.pathname.split("/").at(-1);
  expect(readFileSync(new URL(file, artDirectory)).length, `${label}: ${file}`)
    .toBeGreaterThan(32);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("bundled game artwork", () => {
  it("covers every possible equipment, pet, egg, food and bonus-key reward", () => {
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", artDirectory), "utf8"));
    const sources = new Map(manifest.assets.map((asset) => [asset.file, asset.source]));
    for (const id of itemIds) {
      const presentation = getItemPresentation(id);
      expectBundledImage(presentation.image, id);
      expect(presentation.name, `${id} needs a readable item name`).not.toBe(id);
      expect(presentation.name, `${id} should not expose a raw game ID`).not.toContain("_");
      const file = presentation.image.split("/").at(-1);
      expect(presentation.sourceUrl, `${id} must credit the actual bundled artwork source`)
        .toBe(sources.get(file));
    }
  });

  it("provides an illustration and an explanation for every supported save category", () => {
    for (const id of cardIds) {
      const presentation = getChestPresentation(id);
      expectBundledImage(presentation.image, id);
      expect(presentation.name, id).not.toBe(id);
      expect(presentation.description, id).toBeTruthy();
    }
  });

  it("contains complete image files rather than downloaded error pages", () => {
    const images = readdirSync(artDirectory).filter((name) => /\.(?:png|webp)$/.test(name));
    expect(images.length).toBeGreaterThanOrEqual(itemIds.length);
    for (const file of images) {
      const bytes = readFileSync(new URL(file, artDirectory));
      if (file.endsWith(".webp")) {
        expect(bytes.subarray(0, 4).toString("ascii"), file).toBe("RIFF");
        expect(bytes.subarray(8, 12).toString("ascii"), file).toBe("WEBP");
        expect(bytes.readUInt32LE(4) + 8, `${file} must not be truncated`).toBe(bytes.length);
      } else {
        expect(bytes.subarray(0, 8).toString("hex"), file).toBe("89504e470d0a1a0a");
        expect(bytes.subarray(12, 16).toString("ascii"), file).toBe("IHDR");
        expect(bytes.readUInt32BE(16), `${file} width`).toBeGreaterThan(0);
        expect(bytes.readUInt32BE(20), `${file} height`).toBeGreaterThan(0);
        expect(bytes.subarray(-12).toString("hex"), `${file} must have its final chunk`)
          .toBe("0000000049454e44ae426082");
      }
    }
  });

  it("keeps the artwork provenance manifest complete and consistent with bundled bytes", () => {
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", artDirectory), "utf8"));
    const images = readdirSync(artDirectory).filter((name) => name.endsWith(".webp")).sort();
    expect(manifest.assets.map((asset) => asset.file).sort()).toEqual(images);
    expect(manifest.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
    for (const asset of manifest.assets) {
      const bytes = readFileSync(new URL(asset.file, artDirectory));
      expect(bytes.length, asset.file).toBe(asset.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), asset.file).toBe(asset.sha256);
      expect(asset.sourceSha256, asset.file).toMatch(/^[a-f0-9]{64}$/);
      const source = new URL(asset.source);
      expect(source.protocol, asset.file).toBe("https:");
      expect(["raw.githubusercontent.com", "eatventuretools.app"], asset.file)
        .toContain(source.hostname);
      if (source.hostname === "raw.githubusercontent.com") {
        expect(asset.source, asset.file).toBe(
          `https://raw.githubusercontent.com/1vcian/ev/${manifest.sourceCommit}/src/${asset.file.replace(/\.webp$/, ".png")}`,
        );
      } else {
        expect(source.pathname, asset.file).toMatch(/^\/images\/[^/]+\/[^/]+\.png$/);
      }
    }
  });

  it.each([
    ["/", "/assets/items/"],
    ["/loot-predictor/", "/loot-predictor/assets/items/"],
    ["./", "/loot-predictor/assets/items/"],
  ])("keeps artwork reachable with the deployment base %s", async (base, expectedDirectory) => {
    vi.stubEnv("BASE_URL", base);
    vi.resetModules();
    const { getItemPresentation: item, getChestPresentation: chest } =
      await import("../src/ui/presentation.js");
    for (const image of [item("Head_Robot").image, chest("event_Space").image]) {
      const url = new URL(image, "https://example.test/loot-predictor/index.html");
      expect(url.origin).toBe("https://example.test");
      expect(url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1))
        .toBe(expectedDirectory);
    }
  });
});

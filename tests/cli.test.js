import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { savegame } from "./fixtures.js";

const read = vi.hoisted(() => vi.fn());
vi.mock("node:fs", async (importOriginal) => ({ ...(await importOriginal()), readFileSync: read }));
const originalArgv = process.argv;
let output, error, exit;
beforeEach(() => {
  vi.resetModules();
  read.mockReset().mockReturnValue(JSON.stringify(savegame()));
  output = vi.spyOn(console, "log").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  exit = vi.spyOn(process, "exit").mockImplementation((code) => { throw new Error(`exit:${code}`); });
});
afterEach(() => { process.argv = originalArgv; });
async function run(...args) {
  process.argv = [process.execPath, "tools/predict.mjs", ...args];
  return import("../tools/predict.mjs");
}

describe("CLI", () => {
  it("prints usage and exits with failure when no file is given", async () => {
    await expect(run()).rejects.toThrow("exit:1");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("usage:"));
    expect(read).not.toHaveBeenCalled();
  });

  it("lists seed, opening count and optional level for chests and eggs", async () => {
    await expect(run("save.json")).rejects.toThrow("exit:0");
    expect(read).toHaveBeenCalledWith("save.json", "utf8");
    const lines = output.mock.calls.flat().join("\n");
    expect(lines).toContain("big");
    expect(lines).toContain("opened=0");
    expect(lines).toContain("level=5");
    expect(lines).toContain("egg_Rare");
    expect(lines).toContain('"save.json" big 5');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("rejects chests absent from the save and lists available choices", async () => {
    await expect(run("save.json", "unknown")).rejects.toThrow("exit:1");
    expect(error).toHaveBeenCalledWith("no such chest in save: unknown");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("available: big, small"));
  });

  it.each([undefined, "0", "invalid"])("defaults missing or invalid counts to five: %s", async (count) => {
    const args = count === undefined ? ["save.json", "big"] : ["save.json", "big", count];
    await run(...args);
    expect(output.mock.calls.flat().join("\n")).toContain("next 5 opens");
    expect(output.mock.calls.filter(([line]) => line.startsWith("open #"))).toHaveLength(5);
    expect(exit).not.toHaveBeenCalled();
  });

  it("prints adventure key rolls and every chained next seed", async () => {
    await run("save.json", "adventure_Zeus", "2");
    const lines = output.mock.calls.flat().join("\n");
    expect(lines).toContain("next 2 opens");
    expect(lines).toContain("[keyRoll");
    expect(output.mock.calls.filter(([line]) => line.includes("-> nextSeed"))).toHaveLength(2);
    expect(lines).toContain("Ring_");
  });

  it("propagates file and parsing errors", async () => {
    read.mockImplementationOnce(() => { throw new Error("file missing"); });
    await expect(run("missing.json", "big")).rejects.toThrow("file missing");
    vi.resetModules();
    read.mockReturnValueOnce("{}");
    await expect(run("invalid.json", "big")).rejects.toThrow("not a valid savegame");
  });

  it("works as an actual process with a save file whose path contains spaces", () => {
    const directory = mkdtempSync(join(tmpdir(), "loot predictor "));
    const file = join(directory, "synthetic save.json");
    const script = fileURLToPath(new URL("../tools/predict.mjs", import.meta.url));
    try {
      writeFileSync(file, JSON.stringify(savegame()));
      const text = execFileSync(process.execPath, [script, file, "egg_Rare", "1"], { encoding: "utf8" });
      expect(text).toContain("Pet: Pet_GoldenRetriever (Rare)");
      expect(text).toContain("-> nextSeed 302596119");
    } finally {
      unlinkSync(file);
      rmdirSync(directory);
    }
  });
});

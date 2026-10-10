import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
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

  it("defaults an omitted count to five", async () => {
    await run("save.json", "big");
    expect(output.mock.calls.flat().join("\n")).toContain("next 5 opens");
    expect(output.mock.calls.filter(([line]) => line.startsWith("open #"))).toHaveLength(5);
    expect(exit).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "invalid", "Infinity", "1e309", "10001", ""])("rejects invalid or excessive count %j", async (count) => {
    await expect(run("save.json", "big", count)).rejects.toThrow("exit:1");
    expect(error).toHaveBeenCalledWith("count must be an integer from 1 to 10000");
    expect(output).not.toHaveBeenCalled();
  });

  it.each(["__proto__", "constructor"])("rejects inherited chest names %s", async (cardId) => {
    await expect(run("save.json", cardId, "1")).rejects.toThrow("exit:1");
    expect(error).toHaveBeenCalledWith(`no such chest in save: ${cardId}`);
  });

  it("prints adventure key rolls and every chained next seed", async () => {
    await run("save.json", "adventure_Zeus", "2");
    const lines = output.mock.calls.flat().join("\n");
    expect(lines).toContain("next 2 opens");
    expect(lines).toContain("[keyRoll");
    expect(output.mock.calls.filter(([line]) => line.includes("-> nextSeed"))).toHaveLength(2);
    expect(lines).toContain("Ring_");
  });

  it("prints file and parsing errors and exits with failure", async () => {
    read.mockImplementationOnce(() => { throw new Error("file missing"); });
    await expect(run("missing.json", "big")).rejects.toThrow("exit:1");
    expect(error).toHaveBeenCalledWith("file missing");
    vi.resetModules();
    read.mockReturnValueOnce("{}");
    await expect(run("invalid.json", "big")).rejects.toThrow("exit:1");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("not a valid savegame"));
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
      const rejected = spawnSync(process.execPath, [script, file, "big", "Infinity"], { encoding: "utf8", timeout: 5000 });
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toBe("");
      expect(rejected.stderr.trim()).toBe("count must be an integer from 1 to 10000");
    } finally {
      unlinkSync(file);
      rmdirSync(directory);
    }
  });
});

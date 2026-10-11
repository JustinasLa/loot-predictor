// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/solver/xp-path.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findOptimalXpPath: vi.fn(actual.findOptimalXpPath) };
});
vi.mock("../../src/solver/find-items.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findAllPathsAsync: vi.fn(actual.findAllPathsAsync), findItemLinearAsync: vi.fn(actual.findItemLinearAsync) };
});

import { IMPORT_ERRORS, importErrorMessage } from "../../src/app/session.js";
import { $, stored, dispatch, markOpened, init, upload, restored, setupApp } from "../helpers/app-harness.js";
import { createDemoSave } from "../../src/ui/demo.js";
import { savegame } from "../fixtures.js";

setupApp();

describe("save import", () => {
  it("reports parsing and file-reader errors", async () => {
    await init();
    await upload("{}");
    expect($("#import-status .error-box").textContent).toBe("Oops! That didn't work. That's not an Eatventure save. How?");
    class UnreadableFile { readAsText() { this.onerror(); } }
    vi.stubGlobal("FileReader", UnreadableFile);
    await upload("{}", "unreadable.json");
    expect($("#import-status .error-box").textContent).toBe("Oops! That didn't work. Couldn't open that file.");
    expect($("#import-status .error-how")).toBeNull();
  });

  it("maps every reader and parser failure to short, exact copy", () => {
    expect(IMPORT_ERRORS).toEqual({
      noBoxes: "No boxes found in this save.",
      badFile: "That's not an Eatventure save.",
      unreadable: "Couldn't open that file.",
    });
    expect(importErrorMessage(new Error("savegame contains no supported chests or eggs"))).toBe("No boxes found in this save.");
    expect(importErrorMessage(new Error("Couldn't open that file."))).toBe("Couldn't open that file.");
    expect(importErrorMessage(new SyntaxError("Unexpected token"))).toBe("That's not an Eatventure save.");
    expect(importErrorMessage(new Error("missing GameSavegame"))).toBe("That's not an Eatventure save.");
  });

  it("has one load button: a wrong file gets a How? link to the save steps instead", async () => {
    await init();
    expect($("#try-another-file")).toBeNull();
    await upload("not json", "notes.txt");
    const how = $("#import-status .error-how");
    expect(how.tagName).toBe("BUTTON");
    expect(how.type).toBe("button");
    expect($("#workspace-status .error-how")).toBeNull();
    const help = $(".welcome-help");
    expect(help.open).toBe(false);
    how.click();
    expect(help.open).toBe(true);
    expect(document.activeElement).toBe(help.querySelector("summary"));
    await upload(JSON.stringify(savegame()), "good.json");
    expect($("#import-status").textContent).toBe("");
  });

  it("shows a busy spinner line while a file is being read", async () => {
    vi.stubGlobal("FileReader", class { readAsText() {} });
    await init();
    Object.defineProperty($("#save"), "files", { configurable: true, value: [new File([""], "savegame.json")] });
    dispatch("#save", "change");
    for (const id of ["#import-status", "#workspace-status"]) {
      const line = $(`${id} .status-line`);
      expect(line.classList.contains("is-busy")).toBe(true);
      expect(line.textContent).toBe("Reading savegame.json…");
    }
  });

  it("rejects a save with no mapped boxes", async () => {
    await init();
    await upload('{"GameSavegame":{}}');
    expect($("#import-status .error-box").textContent).toBe("Oops! That didn't work. No boxes found in this save.");
    expect($("#box-rail-list").querySelectorAll("[data-card-id]")).toHaveLength(0);
  });

  it("keeps an existing preview and tracked progress when a replacement file is invalid", async () => {
    await init(restored());
    markOpened(1);
    const session = stored();
    const preview = $("#out").innerHTML;
    await upload("{}", "invalid.json");
    expect($("#workspace-status .error-box").textContent).toContain("That's not an Eatventure save.");
    expect($("#out").innerHTML).toBe(preview);
    expect(stored()).toEqual(session);
    expect($("#save").value).toBe("");
    await upload(JSON.stringify(savegame()), "fixed.json");
    expect($("#workspace-status").textContent).toBe("");
    expect($("#session-label").dataset.demo).toBe("false");
    expect(stored().live.big.opened).toBe(0);
  });

  it.each(["success", "error"])("uses only the latest selected file when an older read finishes with %s", async (result) => {
    const readers = [];
    vi.stubGlobal("FileReader", class {
      constructor() { readers.push(this); }
      readAsText() {}
    });
    await init();
    const selectFile = (name) => {
      Object.defineProperty($("#save"), "files", { configurable: true, value: [new File([""], name)] });
      dispatch("#save", "change");
    };
    selectFile("first.json");
    selectFile("second.json");
    const newer = savegame();
    newer.Data.GameSavegame.CharacterSavegame.EquipmentChestSavegames[0].Seed = 99;
    readers[1].onload({ target: { result: JSON.stringify(newer) } });
    await vi.waitFor(() => expect($("#user-filename").textContent).toBe("second.json"));
    if (result === "success") readers[0].onload({ target: { result: JSON.stringify(savegame()) } });
    else readers[0].onerror();
    await Promise.resolve();
    expect(stored().saved.big.initialSeed).toBe(99);
    expect($("#user-filename").textContent).toBe("second.json");
  });

  it.each(["success", "error"])("keeps a newly selected demo when an older file read ends with %s", async (result) => {
    const readers = [];
    vi.stubGlobal("FileReader", class {
      constructor() { readers.push(this); }
      readAsText() {}
    });
    await init();
    Object.defineProperty($("#save"), "files", { configurable: true, value: [new File([""], "pending.json")] });
    dispatch("#save", "change");
    expect($("#import-status").textContent).toBe("Reading pending.json…");
    dispatch("#load-demo");
    if (result === "success") readers[0].onload({ target: { result: JSON.stringify(savegame()) } });
    else readers[0].onerror();
    await Promise.resolve();
    await Promise.resolve();
    expect(stored().saved).toEqual(createDemoSave());
    expect($("#user-filename").textContent).toBe("Demo save");
    expect($("#session-label").dataset.demo).toBe("true");
    expect($("#import-status").textContent).toBe("");
    expect($("#workspace-status").textContent).toBe("");
  });

  it("wires every load button to the native file picker", async () => {
    await init(restored());
    const fileClick = vi.spyOn($("#save"), "click").mockImplementation(() => {});
    $("#welcome-load-save").click();
    $("#load-save").click();
    $("#load-save-menu").click();
    expect(fileClick).toHaveBeenCalledTimes(3);
  });

  it("lets the demo banner open the file picker", async () => {
    await init();
    dispatch("#load-demo");
    const banner = $("#demo-banner");
    expect(banner.classList.contains("is-hidden")).toBe(false);
    expect(banner.textContent.replace(/\s+/g, " ").trim()).toBe("Demo save Load my save");
    const link = $("#demo-banner #load-save");
    expect(link.tagName).toBe("BUTTON");
    expect(link.className).toContain("btn--go btn--sm");
    expect(link.textContent).toBe("Load my save");
    const fileClick = vi.spyOn($("#save"), "click").mockImplementation(() => {});
    link.click();
    expect(fileClick).toHaveBeenCalledTimes(1);
  });
});

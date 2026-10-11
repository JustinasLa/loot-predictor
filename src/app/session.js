// Start screen, save loading, the demo, import errors and session restore.
import { parseSavegame } from "../save/parse.js";
import * as storage from "../storage.js";
import { createDemoSave, DEMO_FILENAME } from "../ui/demo.js";
import { renderError, el } from "../ui/render.js";
import { state, currentId } from "./state.js";
import { $, $$, vaultValue } from "./dom.js";
import { previewCount, refresh } from "./predict.js";
import { invalidateXp } from "./xp-planner.js";
import { invalidateFind, resetItemFilters, syncFindPanel } from "./find.js";
import { showTab, enterBoxScreen } from "./navigation.js";

export const IMPORT_ERRORS = {
  noBoxes: "No boxes found in this save.",
  badFile: "That's not an Eatventure save.",
  unreadable: "Couldn't open that file.",
};

function readSave(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { resolve(parseSavegame(e.target.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error(IMPORT_ERRORS.unreadable));
    reader.readAsText(file);
  });
}

export function persist() {
  let count = "5";
  let vault = "0";
  try { count = String(previewCount()); } catch { /* keep a valid preference while an input is being edited */ }
  try { vault = String(vaultValue()); } catch { /* keep a valid preference while an input is being edited */ }
  storage.save({
    saved: state.saved,
    live: state.live,
    // Find targets survive a refresh too: the point is picking the route
    // back up on a later day.
    targets: Object.fromEntries(
      [...state.targets].map(([id, set]) => [id, [...set]]).filter(([, list]) => list.length)
    ),
    ui: { cardId: currentId(), count, vault, filename: state.filename, tab: state.activeTab }
  });
}

export function isDemo() {
  return state.filename === DEMO_FILENAME;
}

function enableControls() {
  for (const id of ["#seed", "#reset", "#open-custom-go"]) $(id).disabled = false;
  for (const button of $$(".open-btn")) button.disabled = false;
  $("#welcome-screen").classList.add("is-hidden");
  $("#workspace").classList.remove("is-hidden");
  $("#user-panel-loggedin").classList.remove("is-hidden");
  const demo = isDemo();
  const name = $("#user-filename");
  name.textContent = demo ? "Demo save" : state.filename;
  name.title = state.filename;
  const session = $("#session-label");
  session.classList.remove("is-hidden");
  session.textContent = demo ? "Demo" : "My save";
  session.dataset.demo = String(demo);
  $("#demo-banner").classList.toggle("is-hidden", !demo);
  document.body.dataset.loaded = "yes";
}

function clearImportStatus() {
  $("#import-status").textContent = "";
  $("#workspace-status").textContent = "";
}

/** Opens the Start screen's "What's a save file?" picture steps. */
export function showSaveHelp() {
  const help = $(".welcome-help");
  help.open = true;
  help.querySelector("summary").focus();
}

function showLoading(filename) {
  clearImportStatus();
  for (const id of ["#import-status", "#workspace-status"]) {
    const line = document.createElement("p");
    line.className = "status-line is-busy load-status";
    line.textContent = `Reading ${filename}…`;
    $(id).append(line);
  }
}

/** Maps a parser or reader error to the short Start-screen copy. */
export function importErrorMessage(error) {
  if (error.message === "savegame contains no supported chests or eggs") return IMPORT_ERRORS.noBoxes;
  if (error.message === IMPORT_ERRORS.unreadable) return IMPORT_ERRORS.unreadable;
  return IMPORT_ERRORS.badFile;
}

function showImportError(error) {
  const message = importErrorMessage(error);
  renderError($("#import-status"), message);
  renderError($("#workspace-status"), message);
  // "Load my save" sits right above; a wrong file gets a "How?" to the steps.
  if (message === IMPORT_ERRORS.badFile) {
    const how = el("button", "error-how", "How?");
    how.type = "button";
    how.addEventListener("click", showSaveHelp);
    $("#import-status .error-reason").append(" ", how);
  }
}

function adoptSave(parsed, filename) {
  invalidateXp();
  invalidateFind();
  state.saved = parsed;
  state.filename = filename;
  state.targets.clear();
  resetItemFilters();
  state.previewLevelChestId = null;
  state.xpLevelChestId = null;
  state.findLevelChestId = null;
  state.live = Object.fromEntries(
    Object.entries(state.saved).map(([id, st]) => [
      id, { seed: st.initialSeed, level: st.level, opened: 0, history: [] }
    ])
  );
  state.cardId = Object.keys(state.saved)[0];
  enableControls();
  showTab("predict");
  refresh();
  syncFindPanel();
  clearImportStatus();
  enterBoxScreen();
  $("#current-chest-name").focus({ preventScroll: true });
}

function restore() {
  const cached = storage.load();
  if (!cached) return false;

  state.saved = cached.saved;
  state.live = cached.live;
  state.targets.clear();
  for (const [id, list] of Object.entries(cached.targets || {})) {
    state.targets.set(id, new Set(list));
  }
  const ui = cached.ui ?? {};
  state.cardId = ui.cardId && state.live[ui.cardId] ? ui.cardId : Object.keys(state.saved)[0];
  state.filename = ui.filename || "savegame";
  if (ui.count) $("#count").value = ui.count;
  if (ui.vault) $("#vault").value = ui.vault;
  enableControls();
  showTab(ui.tab);
  refresh();
  syncFindPanel();
  enterBoxScreen();
  return true;
}

export function initSession() {
  for (const id of ["#load-save", "#load-save-menu", "#welcome-load-save"]) {
    $(id).addEventListener("click", () => $("#save").click());
  }
  $("#load-demo").addEventListener("click", () => {
    // A late file read must not replace a demo selected more recently.
    state.saveLoadToken++;
    adoptSave(createDemoSave(), DEMO_FILENAME);
  });
  $("#save").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    // Keep the File reference, then allow the same file to be chosen again,
    // even when a newer demo or import supersedes this pending read.
    e.target.value = "";
    if (!file) return;
    const token = ++state.saveLoadToken;
    showLoading(file.name);
    try {
      const parsed = await readSave(file);
      if (token === state.saveLoadToken) adoptSave(parsed, file.name);
    } catch (err) {
      if (token === state.saveLoadToken) showImportError(err);
    }
  });
}

/** Restores the cached session, or leaves the Start screen showing. */
export function startSession() {
  if (!restore()) showTab("predict");
}

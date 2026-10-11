// Next tab: the upcoming openings for the selected box.
import { predictChain } from "../loot/simulate.js";
import { validateInteger, validateLevel } from "../validation.js";
import { renderResults, renderError } from "../ui/render.js";
import { state, currentId, currentState, isAdventure } from "./state.js";
import { $, numberField, vaultValue } from "./dom.js";
import { persist } from "./session.js";
import { openChest, syncMarking } from "./marking.js";
import { syncSmartXp } from "./xp-planner.js";
import { renderRail } from "./navigation.js";

export const MAX_PREVIEW = 200;
export const previewCount = () =>
  numberField("#count", (value) => validateInteger(value, "preview count", 1, MAX_PREVIEW), 5);

// For adventure boxes, the level field previews (and opens) at a level other
// than the box's current one. It stays put across opens on the same box and
// only resets when you switch boxes.
export function chainOpts(boxState) {
  const level = isAdventure(currentId())
    ? numberField("#preview-level", validateLevel, boxState.level ?? 1)
    : boxState.level;
  return { level, vaultPercentage: vaultValue() };
}

/** Runs a settings/marking action, showing any error in the visible panel. */
export function predictAction(action) {
  try { action(); }
  catch (err) { renderError($(state.activeTab === "find" ? "#find-out" : "#out"), err.message); }
}

// Shows the level field for adventure boxes and resets it to the box's real
// level, but only on an actual switch.
export function syncPreviewLevelField(cardId, boxState) {
  const adventure = isAdventure(cardId);
  $("#preview-level-field").classList.toggle("is-hidden", !adventure);
  if (adventure && cardId !== state.previewLevelChestId) {
    $("#preview-level").value = boxState.level ?? "";
  }
  state.previewLevelChestId = cardId;
}

function syncShowMore(count) {
  const more = $("#show-more");
  const atCap = count >= MAX_PREVIEW;
  more.disabled = atCap;
  more.textContent = atCap ? "That's all" : "Show 5 more";
}

// Redraw everything that depends on the live seed, then checkpoint.
export function refresh() {
  const out = $("#out");
  let boxState;
  try {
    const cardId = currentId();
    boxState = currentState();
    $("#seed").value = boxState.seed;
    renderRail();
    syncMarking(cardId, boxState);
    syncPreviewLevelField(cardId, boxState);
    syncSmartXp();
    const seed = boxState.seed;
    const options = chainOpts(boxState);
    const count = previewCount();
    renderResults(out, cardId, predictChain(seed, cardId, count, options), (times) => {
      if (currentId() !== cardId || state.live[cardId] !== boxState || boxState.seed !== seed) return;
      try {
        if (JSON.stringify(chainOpts(boxState)) !== JSON.stringify(options)) return;
        openChest(times);
      } catch (err) { renderError(out, err.message); }
    });
    syncShowMore(count);
  } catch (err) {
    renderError(out, err.message);
  } finally {
    if (boxState) persist();
  }
}

function showMore() {
  const current = Number.parseInt($("#count").value, 10) || 0;
  $("#count").value = String(Math.min(MAX_PREVIEW, Math.max(0, current) + 5));
  refresh();
}

export function initPredict() {
  $("#count").addEventListener("change", refresh);
  // Live-updates the preview as you type a level to check.
  $("#preview-level").addEventListener("input", refresh);
  $("#show-more").addEventListener("click", showMore);
}

// XP tab (adventure boxes): plan the levels that earn the most XP.
import { findOptimalXpPath } from "../solver/xp-path.js";
import { DOMINANT_ADVENTURE_LEVELS } from "../loot/tables.js";
import { simulateAdventureChestOpening } from "../loot/simulate.js";
import { getItemXp } from "../loot/xp.js";
import { validateLevel, validateVaultPercentage } from "../validation.js";
import { renderXpPath, renderError, boxArt, el } from "../ui/render.js";
import { getItemPresentation } from "../ui/presentation.js";
import { state, currentId, currentState, isAdventure } from "./state.js";
import { $, numberField, positiveInteger, vaultValue } from "./dom.js";
import { contextMatches, invalidateChest, replayRoute, commitOpenings, syncSearchControls, SETTINGS_CHANGED } from "./routes.js";
import { predictAction, refresh } from "./predict.js";
import { invalidateFind } from "./find.js";

export function xpOptions() {
  const boxState = currentState();
  return {
    openings: numberField("#xp-openings", positiveInteger, 4),
    maxLevel: numberField("#xp-maxlevel", validateLevel, boxState.level ?? 1),
    vaultPercentage: numberField("#xp-vault", validateVaultPercentage, 0),
    maxOpens: numberField("#xp-maxopens", positiveInteger, Infinity)
  };
}

export function syncXpControls() {
  $("#xp-search").disabled = !!state.xpRun || !isAdventure(currentId());
  $("#xp-stop").classList.toggle("is-hidden", !state.xpRun);
}

export function invalidateXp() {
  state.xpRun = null;
  state.xpView = null;
  $("#xp-out").textContent = "";
  $("#xp-actions").textContent = "";
  setStatus("");
  syncSearchControls();
}

function setStatus(text, busy = false) {
  const status = $("#xp-status");
  status.textContent = text;
  status.dataset.busy = busy ? "yes" : "no";
}

// The heading shows the adventure's own icon and the stepper its vault key.
function syncXpArt(cardId) {
  $("#xp-icon").replaceChildren(boxArt(cardId));
  $("#xp-key-art").src = getItemPresentation(cardId === "adventure_Pirate" ? "PirateKeyIcon" : "ZeusKeyIcon").image;
}

// "Stopped." with no plan gets a Try again button outside #xp-out.
function syncRetry(show) {
  const actions = $("#xp-actions");
  actions.textContent = "";
  if (!show) return;
  const retry = el("button", "btn btn--primary btn--lg", "Try again");
  retry.id = "xp-retry";
  retry.type = "button";
  retry.addEventListener("click", runXpSearch);
  actions.append(retry);
}

// What you would bank by just replaying the highest level every time. Spends
// openings under the same rules as the search, including key refunds,
// so the comparison is like for like.
function naiveXp(seed, cardId, eventType, level, vaultPercentage, openings, maxOpens) {
  let current = seed;
  let openingsLeft = openings;
  let xp = 0;
  let opens = 0;

  while (openingsLeft > 0 && opens < maxOpens) {
    const result = simulateAdventureChestOpening(current, level, eventType, vaultPercentage, cardId);
    xp += result.items.reduce((sum, item) => sum + getItemXp(item), 0);
    openingsLeft += result.items.filter((i) => i.baseName.endsWith("KeyIcon")).length - 1;
    current = result.nextSeed;
    opens++;
  }

  return { xp, opens };
}

// The search branches once per candidate level, so cost is levels^openings.
function branchCount(maxLevel) {
  const levels = DOMINANT_ADVENTURE_LEVELS.filter((level) => level <= maxLevel);
  if (!levels.includes(maxLevel)) levels.push(maxLevel);
  return levels.length;
}

function syncXpEstimate() {
  const label = $("#xp-estimate");
  let options;
  try {
    options = xpOptions();
  } catch (err) {
    label.textContent = err.message;
    label.dataset.heavy = "no";
    return;
  }
  const paths = Math.pow(branchCount(options.maxLevel), options.openings);
  // ~200k paths/second measured in browser; rough, but the order of
  // magnitude is what matters when deciding whether to hit the button.
  const seconds = paths / 200000;
  const cost =
    seconds < 1 ? "Instant"
      : seconds < 60 ? `About ${Math.round(seconds)} seconds`
      : seconds < 3600 ? `About ${Math.round(seconds / 60)} minutes`
      : `About ${(seconds / 3600).toFixed(1)} hours`;
  const heavy = seconds > 20;
  label.textContent = heavy ? `${cost} · may be slow` : cost;
  label.dataset.heavy = heavy ? "yes" : "no";
}

export function syncSmartXp() {
  const cardId = currentId();
  const adventure = isAdventure(cardId);
  $("#smart-xp").classList.toggle("is-hidden", !adventure);
  $("#xp-settings").classList.toggle("is-hidden", !adventure);

  syncSearchControls();
  const previousChestId = state.xpLevelChestId;
  state.xpLevelChestId = cardId;
  if (!adventure) return;

  if (previousChestId !== cardId) {
    $("#xp-maxlevel").value = state.live[cardId].level ?? 1;
    syncXpArt(cardId);
  }
  // One vault rate for the whole app; this field is a hidden mirror of #vault.
  $("#xp-vault").value = $("#vault").value;
  syncXpEstimate();
}

// Commit route steps to the live seed. Each step replays at the level the
// route chose, not the box's current level, or the chain would diverge.
function drawXpPath() {
  const view = state.xpView;
  const { solution, baseline, openings, done } = view;
  renderXpPath($("#xp-out"), solution, baseline, openings,
    (steps) => { if (view.done === done) openXpRoute(view, steps); }, done, view.cardId);
}

// The path stays on screen with the opened steps marked: every later step
// was solved from the seed those opens produce, so it is still valid.
function openXpRoute(view, steps) {
  if (state.xpView !== view || steps.length === 0) return;
  try {
    if (!contextMatches(view, "xp") || steps.some((step, i) => step !== view.solution.path[view.done + i])) {
      throw new Error(SETTINGS_CHANGED);
    }
    const openings = replayRoute(view, steps);
    invalidateChest(view.cardId, true);
    commitOpenings(view.state, openings);
    view.done += steps.length;
    view.seed = view.state.seed;
    refresh();
    drawXpPath();
  } catch (err) {
    invalidateXp();
    renderError($("#xp-out"), err.message);
  }
}

async function runXpSearch() {
  if (state.xpRun) return;
  let run;
  try {
    const cardId = currentId();
    const boxState = currentState();
    if (!isAdventure(cardId)) throw new Error("Choose an adventure chest to plan for more XP.");
    const options = xpOptions();
    const { openings, maxLevel, vaultPercentage, maxOpens } = options;
    if (vaultPercentage !== vaultValue()) throw new Error("Key drop chance must match your preview settings.");
    run = { cardId, state: boxState, seed: boxState.seed, vaultPercentage, optionsKey: JSON.stringify(options), stopped: false };
    invalidateXp();
    state.xpRun = run;
    syncSearchControls();
    setStatus("Planning…", true);
    const started = Date.now();
    const eventType = cardId.slice("adventure_".length);
    const solution = await findOptimalXpPath({
      startSeed: run.seed,
      eventType,
      cardId,
      maxLevel,
      vaultPercentage,
      openings,
      maxOpens,
      onProgress: (depth) => {
        if (state.xpRun === run && contextMatches(run, "xp")) setStatus(`Planning… · ${depth} opens deep`, true);
      },
      shouldStop: () => run.stopped || state.xpRun !== run || !contextMatches(run, "xp")
    });
    if (state.xpRun !== run || !contextMatches(run, "xp")) return;

    // Bound the baseline by the path the solver actually found, so an
    // uncapped run cannot spin here forever on refunded keys.
    const baseline = naiveXp(
      run.seed, cardId, eventType, maxLevel, vaultPercentage, openings,
      Math.min(maxOpens, solution.path.length)
    );
    // A Stop that lands after the last node still counts as stopped early.
    const result = run.stopped && !solution.stopped ? { ...solution, stopped: true } : solution;
    state.xpView = { ...run, solution: result, baseline, openings, done: 0 };
    drawXpPath();
    syncRetry(result.stopped && result.path.length === 0);
    const checked = `${solution.nodesVisited.toLocaleString("en-US")} routes checked in ${((Date.now() - started) / 1000).toFixed(1)}s`;
    setStatus(result.stopped ? `Stopped early · ${checked}` : checked);
  } catch (err) {
    if (run && (state.xpRun !== run || !contextMatches(run, "xp"))) return;
    state.xpView = null;
    renderError($("#xp-out"), err.message);
    syncRetry(false);
    setStatus("");
  } finally {
    if (state.xpRun === run) state.xpRun = null;
    syncSearchControls();
  }
}

export function initXpPlanner() {
  // Write back to #vault so the preview and the search never disagree about
  // the vault rate; refresh() mirrors it back and persists.
  $("#xp-vault").addEventListener("change", () => {
    invalidateXp();
    invalidateFind();
    predictAction(() => {
      $("#vault").value = String(numberField("#xp-vault", validateVaultPercentage, 0));
      refresh();
    });
  });
  for (const id of ["#xp-openings", "#xp-maxlevel", "#xp-maxopens"]) {
    const change = () => { invalidateXp(); syncXpEstimate(); };
    $(id).addEventListener("input", change);
    $(id).addEventListener("change", change);
  }
  $("#xp-search").addEventListener("click", runXpSearch);
  $("#xp-stop").addEventListener("click", () => {
    if (!state.xpRun) return;
    state.xpRun.stopped = true;
    setStatus("Stopping…", true);
  });
}

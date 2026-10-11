// Box picker, box header, tabs and the phone Boxes/Box screens.
import { getChestPresentation } from "../ui/presentation.js";
import { renderChestList, boxGroup, boxArt } from "../ui/render.js";
import { state, currentId, isAdventure } from "./state.js";
import { $, $$ } from "./dom.js";
import { refresh } from "./predict.js";
import { persist } from "./session.js";
import { invalidateXp } from "./xp-planner.js";
import { invalidateFind, resetItemFilters, syncFindPanel } from "./find.js";

export const TABS = ["predict", "find", "xp"];

function visibleTabs() {
  return TABS.filter((tab) => !$("#nav-" + tab).classList.contains("is-hidden"));
}

/** Shows a tab. XP only exists for adventure boxes; it falls back to Next. */
export function showTab(requested) {
  const adventure = isAdventure(currentId());
  $("#nav-xp").classList.toggle("is-hidden", !adventure);
  let tab = TABS.includes(requested) ? requested : "predict";
  if (tab === "xp" && !adventure) tab = "predict";
  state.activeTab = tab;
  for (const name of TABS) {
    const selected = name === tab;
    $("#panel-" + name).classList.toggle("is-hidden", !selected);
    const button = $("#nav-" + name);
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  // Find and XP bring their own level fields, so the header slims down.
  $("#box-header").classList.toggle("is-compact", tab !== "predict");
  syncChestHeading();
}

export function syncChestHeading() {
  const cardId = currentId();
  if (!cardId) return;
  $("#current-chest-name").textContent = getChestPresentation(cardId).name;
  const art = boxArt(cardId);
  const holder = $("#current-chest-art");
  holder.dataset.box = art.dataset.box;
  holder.replaceChildren(art);
}

/** Redraws every rail group; empty groups are hidden. */
export function renderRail() {
  for (const grid of $$("[data-box-group]")) {
    const group = grid.dataset.boxGroup;
    const states = Object.fromEntries(
      Object.entries(state.live).filter(([id]) => boxGroup(id) === group)
    );
    renderChestList(grid, states, currentId(), selectChest);
    grid.closest(".box-group").classList.toggle("is-hidden", grid.childElementCount === 0);
  }
}

export function setScreen(screen) {
  $("#workspace").dataset.screen = screen;
  document.body.dataset.screen = screen;
  // On the phone Boxes screen the box name is hidden, so "Pick a box" is the page heading.
  $(".rail-title").setAttribute("aria-level", screen === "boxes" ? "1" : "2");
}

/**
 * After a load: Box screen, with a #boxes entry behind it for browser Back.
 * A reload that is already on #box keeps its history as it is.
 */
export function enterBoxScreen() {
  if (location.hash !== "#box") {
    history.replaceState(null, "", "#boxes");
    history.pushState(null, "", "#box");
  }
  setScreen("box");
}

function scrollToTop() {
  document.documentElement.scrollTop = 0;
}

/** Opens the Box screen. Coming from the phone Boxes screen, it starts at the top on the box name. */
function goToBox() {
  const fromBoxes = $("#workspace").dataset.screen === "boxes";
  if (location.hash !== "#box") history.pushState(null, "", "#box");
  setScreen("box");
  if (!fromBoxes) return;
  scrollToTop();
  $("#current-chest-name").focus({ preventScroll: true });
}

function goToBoxes() {
  history.replaceState(null, "", "#boxes");
  setScreen("boxes");
  scrollToTop();
}

export function selectChest(id) {
  if (state.cardId !== id) {
    invalidateXp();
    invalidateFind();
    resetItemFilters();
  }
  state.cardId = id;
  showTab(state.activeTab);
  refresh();
  syncFindPanel();
  goToBox();
}

function initTabs() {
  const activate = (tab) => {
    showTab(tab);
    if (state.live[currentId()]) persist();
  };
  for (const tab of TABS) {
    const button = $("#nav-" + tab);
    button.addEventListener("click", () => activate(tab));
    button.addEventListener("keydown", (event) => {
      const tabs = visibleTabs();
      const index = tabs.indexOf(tab);
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next]);
      $("#nav-" + tabs[next]).focus();
    });
  }
}

export function initNavigation() {
  initTabs();
  $("#back-to-boxes").addEventListener("click", goToBoxes);
  $("#switch-box").addEventListener("click", goToBoxes);
  window.addEventListener("popstate", () => setScreen(location.hash === "#boxes" ? "boxes" : "box"));
}

// Settings sheet: key drop chance, seed, preview count and seed details.
import { validateSeed, validateVaultPercentage } from "../validation.js";
import { toggleSheet } from "../ui/components/sheet.js";
import { renderError } from "../ui/render.js";
import { currentId, currentState, isAdventure } from "./state.js";
import { $, numberField } from "./dom.js";
import { invalidateChest } from "./routes.js";
import { refresh } from "./predict.js";
import { invalidateXp } from "./xp-planner.js";
import { invalidateFind } from "./find.js";

// The key drop row only matters for adventures, and shows the key that the
// current adventure drops.
export function syncVaultKeyArt() {
  const cardId = currentId();
  $(".setting-row--vault").classList.toggle("is-hidden", !isAdventure(cardId));
  const art = $("#vault-key-art");
  const key = cardId === "adventure_Zeus" ? "ZeusKeyIcon" : "PirateKeyIcon";
  art.setAttribute("src", art.getAttribute("src").replace(/\w+KeyIcon\.webp$/, `${key}.webp`));
}

/**
 * Runs a change made inside the sheet. Errors stay in the sheet, next to the
 * field that caused them, instead of behind it.
 */
export function settingsAction(field, action) {
  const box = $("#settings-error");
  try {
    action();
    box.textContent = "";
    $(field).removeAttribute("aria-invalid");
  } catch (err) {
    renderError(box, err.message);
    $(field).setAttribute("aria-invalid", "true");
  }
}

export function initSettings() {
  const trigger = $("#settings-trigger");
  // The sheet focuses its close button: focusing a number field here would
  // pop up the phone keyboard over half the sheet.
  trigger.addEventListener("click", () => {
    syncVaultKeyArt();
    toggleSheet("settings-sheet", trigger);
  });

  $("#vault").addEventListener("change", () => {
    invalidateXp();
    invalidateFind();
    settingsAction("#vault", () => {
      $("#xp-vault").value = String(numberField("#vault", validateVaultPercentage, 0));
      refresh();
    });
  });

  // Editing the seed by hand replaces the live seed but keeps the history,
  // so you can jump to any seed without reloading a save.
  $("#seed").addEventListener("change", () => {
    settingsAction("#seed", () => {
      const boxState = currentState();
      let value;
      try { value = numberField("#seed", validateSeed); }
      catch (err) { $("#seed").value = boxState.seed; throw err; }
      invalidateChest(currentId());
      boxState.seed = value;
      refresh();
    });
  });

  $("#show-details").addEventListener("change", (event) => {
    document.body.dataset.details = event.target.checked ? "on" : "off";
  });
}

// Settings sheet: vault chance, seed, preview count and seed details.
import { validateSeed, validateVaultPercentage } from "../validation.js";
import { isSheetOpen, toggleSheet } from "../ui/components/sheet.js";
import { currentId, currentState } from "./state.js";
import { $, numberField } from "./dom.js";
import { invalidateChest } from "./routes.js";
import { predictAction, refresh } from "./predict.js";
import { invalidateXp } from "./xp-planner.js";
import { invalidateFind } from "./find.js";

// The vault row shows the key that the current adventure drops.
export function syncVaultKeyArt() {
  const art = $("#vault-key-art");
  const key = currentId() === "adventure_Zeus" ? "ZeusKeyIcon" : "PirateKeyIcon";
  art.setAttribute("src", art.getAttribute("src").replace(/\w+KeyIcon\.webp$/, `${key}.webp`));
}

export function initSettings() {
  const trigger = $("#settings-trigger");
  trigger.addEventListener("click", () => {
    syncVaultKeyArt();
    toggleSheet("settings-sheet", trigger);
    // Start on the first real setting rather than the close button.
    if (isSheetOpen("settings-sheet")) $("#vault").focus();
  });

  $("#vault").addEventListener("change", () => {
    invalidateXp();
    invalidateFind();
    predictAction(() => {
      $("#xp-vault").value = String(numberField("#vault", validateVaultPercentage, 0));
      refresh();
    });
  });

  // Editing the seed by hand replaces the live seed but keeps the history,
  // so you can jump to any seed without reloading a save.
  $("#seed").addEventListener("change", () => {
    predictAction(() => {
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

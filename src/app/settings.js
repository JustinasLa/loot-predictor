// Settings sheet: vault chance, seed, preview count and seed details.
import { validateSeed, validateVaultPercentage } from "../validation.js";
import { toggleSheet } from "../ui/components/sheet.js";
import { currentId, currentState } from "./state.js";
import { $, numberField } from "./dom.js";
import { invalidateChest } from "./routes.js";
import { predictAction, refresh } from "./predict.js";
import { invalidateXp } from "./xp-planner.js";
import { invalidateFind } from "./find.js";

export function initSettings() {
  const trigger = $("#settings-trigger");
  trigger.addEventListener("click", () => toggleSheet("settings-sheet", trigger));

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

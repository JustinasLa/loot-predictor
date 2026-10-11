// Help sheet ("How it works").
import { toggleSheet } from "../ui/components/sheet.js";
import { $ } from "./dom.js";

export function initHelp() {
  const trigger = $("#help-trigger");
  trigger.addEventListener("click", () => toggleSheet("help-sheet", trigger));
}

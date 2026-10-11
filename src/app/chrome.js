// App frame behaviour shared by every screen: sheets and steppers.
import { initSheets } from "../ui/components/sheet.js";
import { initSteppers } from "../ui/components/stepper.js";

export function initChrome(doc = document) {
  initSheets(doc);
  initSteppers(doc);
  doc.body.dataset.details = "off";
}

// DOM lookups and validated number fields. Frozen after the foundation.
import { validateInteger, validateVaultPercentage } from "../validation.js";

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

/** Reads a numeric input through its real <label>, validating the value. */
export function numberField(selector, validate, fallback) {
  const field = $(selector);
  const label = field.labels[0].textContent.trim();
  if (field.validity.badInput) throw new Error("Enter a valid number for " + label + ".");
  const value = field.value.trim();
  if (value === "" && fallback !== undefined) return fallback;
  if (value === "") throw new Error("Enter a value for " + label + ".");
  return validate(Number(value));
}

export const positiveInteger = (value) => validateInteger(value, "openings", 1);
export const vaultValue = () => numberField("#vault", validateVaultPercentage, 0);

/**
 * Scrolls a fresh result into view under the HUD and sticky tabs (html sets
 * scroll-padding-top), so a phone never hides it below the fold.
 */
export function reveal(node) {
  if (typeof node.scrollIntoView !== "function") return;
  const view = node.ownerDocument.defaultView;
  const still = typeof view.matchMedia === "function" && view.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
}

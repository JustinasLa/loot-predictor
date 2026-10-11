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

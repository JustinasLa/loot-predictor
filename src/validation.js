import { CHEST_ID_MAP, EGG_RARITY_MAP } from "./loot/tables.js";

const supportedCardIds = new Set([
  ...Object.values(CHEST_ID_MAP), ...Object.values(EGG_RARITY_MAP)
]);

export function validateInteger(value, label = "value", min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}

export function validateSeed(value, label = "seed") {
  return validateInteger(value, label, -2147483648, 2147483647);
}

export function validateLevel(value, label = "level") {
  return validateInteger(value, label, 1, 100);
}

export function validateVaultPercentage(value, label = "vault percentage") {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${label} must be a number from 0 to 100`);
  }
  return value;
}

export function validateCardId(value) {
  if (!supportedCardIds.has(value)) throw new Error(`unknown chest type: ${String(value)}`);
  return value;
}

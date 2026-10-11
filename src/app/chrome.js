// App frame behaviour shared by every screen: sheets, steppers, the browser
// theme colour and the HUD shadow once the page scrolls.
import { initSheets } from "../ui/components/sheet.js";
import { initSteppers } from "../ui/components/stepper.js";

export const THEME_COLOR = "#14181f";

/** Keeps a single <meta name=theme-color> matching the HUD. */
export function syncThemeColor(doc = document) {
  let meta = doc.head.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.name = "theme-color";
    doc.head.append(meta);
  }
  meta.content = THEME_COLOR;
  return meta;
}

/**
 * Adds body.is-scrolled while the top-of-page sentinel is out of view, so the
 * HUD can cast its shadow. Browsers without IntersectionObserver keep a flat
 * HUD. Returns the observer, or null when nothing was observed.
 */
export function watchScroll(doc = document, Observer = globalThis.IntersectionObserver) {
  const sentinel = doc.querySelector(".scroll-sentinel");
  if (!sentinel || typeof Observer !== "function") return null;
  const observer = new Observer((entries) => {
    for (const entry of entries) doc.body.classList.toggle("is-scrolled", !entry.isIntersecting);
  });
  observer.observe(sentinel);
  return observer;
}

export function initChrome(doc = document) {
  initSheets(doc);
  initSteppers(doc);
  doc.body.dataset.details = "off";
  syncThemeColor(doc);
  watchScroll(doc);
}

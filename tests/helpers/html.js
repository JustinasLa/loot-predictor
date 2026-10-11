// Builds the real document: index.html with the assembled shell mounted.
import indexHtml from "../../index.html?raw";
import { shellMarkup } from "../../src/ui/shell.js";

const ROOT = '<div id="app-root"></div>';

/** Full <html> inner markup with the shell already mounted in #app-root. */
export function documentHtml() {
  return indexHtml
    .replace(/<!doctype html>/i, "")
    .replace(ROOT, `<div id="app-root">${shellMarkup()}</div>`);
}

/** Body markup only (skip link + mounted shell), for body.innerHTML. */
export function bodyHtml() {
  return documentHtml().match(/<body>([\s\S]*)<\/body>/)[1];
}

/** Replaces the whole jsdom document with the app markup. */
export function mountDocument() {
  document.documentElement.innerHTML = documentHtml();
}

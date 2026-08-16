// DOM rendering helpers. Keep all element construction here so app.js
// stays prediction logic + wiring.

export function renderResults(container, results) {
  // TODO: render a proper list instead of a text dump
  container.textContent = results.join("\n");
}

export function renderError(container, message) {
  container.textContent = `Error: ${message}`;
}

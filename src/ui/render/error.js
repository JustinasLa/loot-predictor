// Friendly, one-line error boxes. Messages are always rendered as text.
import { el } from "./dom.js";

export function renderError(container, message) {
  container.textContent = "";
  const error = el("p", "error-box");
  error.setAttribute("role", "alert");
  error.append(el("strong", "error-lead", "Oops! That didn't work."), " ", el("span", "error-reason", message));
  container.append(error);
}

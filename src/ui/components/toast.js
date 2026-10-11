// One-line confirmation toasts in the #toast-region live region. A toast can
// carry a small picture and one action button (e.g. Undo), and then stays up
// a little longer so the button can be reached.
export const TOAST_MS = 2500;
export const ACTION_TOAST_MS = 5000;
let timer = null;

/**
 * Shows `text` as a toast, replacing any current one. Returns the toast element.
 * `options.art` is an image URL; `options.action` is `{ label, onClick }`.
 */
export function showToast(text, doc = document, options = {}) {
  const region = doc.getElementById("toast-region");
  if (!region) return null;
  clearTimeout(timer);
  const { art, action } = options;
  const ms = action ? ACTION_TOAST_MS : TOAST_MS;
  const toast = doc.createElement("div");
  toast.className = "toast";
  toast.style.setProperty("--toast-ms", `${ms}ms`);
  const lead = doc.createElement(art ? "img" : "span");
  if (art) {
    lead.className = "toast-art";
    lead.src = art;
    lead.alt = "";
  } else {
    lead.className = "toast-check";
  }
  lead.setAttribute("aria-hidden", "true");
  const label = doc.createElement("span");
  label.textContent = text;
  toast.append(lead, label);
  const hide = () => {
    toast.remove();
    timer = null;
  };
  if (action) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "toast-undo";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      clearTimeout(timer);
      hide();
      action.onClick();
    });
    toast.append(button);
  }
  region.replaceChildren(toast);
  timer = setTimeout(hide, ms);
  return toast;
}

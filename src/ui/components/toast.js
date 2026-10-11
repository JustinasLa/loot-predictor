// One-line confirmation toasts in the #toast-region live region.
export const TOAST_MS = 2500;
let timer = null;

/** Shows `text` as a toast, replacing any current one. Returns the toast element. */
export function showToast(text, doc = document) {
  const region = doc.getElementById("toast-region");
  if (!region) return null;
  clearTimeout(timer);
  const toast = doc.createElement("div");
  toast.className = "toast";
  const check = doc.createElement("span");
  check.className = "toast-check";
  check.setAttribute("aria-hidden", "true");
  const label = doc.createElement("span");
  label.textContent = text;
  toast.append(check, label);
  region.replaceChildren(toast);
  timer = setTimeout(() => {
    toast.remove();
    timer = null;
  }, TOAST_MS);
  return toast;
}

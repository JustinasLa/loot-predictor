// Bottom sheets (phone) / right drawers (wide screens) for Settings, Save
// menu and Help. Plain divs with role=dialog; `is-hidden` shows and hides.
const FOCUSABLE = [
  "button:not([disabled])", "a[href]", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", "summary", '[tabindex]:not([tabindex="-1"])',
].join(",");

// Open sheets, newest last. Holds elements, not ids, so a replaced document
// never acts on another instance's markup.
const stack = [];

function focusables(layer) {
  return [...layer.querySelectorAll(FOCUSABLE)]
    .filter((node) => !node.closest(".is-hidden") && node.type !== "hidden");
}

export function isSheetOpen(id, doc = document) {
  return stack.some((entry) => entry.layer === doc.getElementById(id));
}

/** Opens a sheet, focuses its first control and remembers the trigger. */
export function openSheet(id, trigger = null, doc = document) {
  const layer = doc.getElementById(id);
  if (!layer.classList.contains("is-hidden")) return;
  layer.classList.remove("is-hidden");
  stack.push({ layer, trigger });
  trigger?.setAttribute("aria-expanded", "true");
  focusables(layer)[0]?.focus();
}

/** Closes a sheet and returns focus to the control that opened it. */
export function closeSheet(id, doc = document) {
  const layer = doc.getElementById(id);
  const index = stack.findIndex((entry) => entry.layer === layer);
  if (index < 0) return;
  const [{ trigger }] = stack.splice(index, 1);
  layer.classList.add("is-hidden");
  if (trigger) {
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus();
  }
}

export function toggleSheet(id, trigger, doc = document) {
  if (isSheetOpen(id, doc)) closeSheet(id, doc);
  else openSheet(id, trigger, doc);
}

function trapTab(event, layer) {
  const items = focusables(layer);
  const first = items[0];
  const last = items.at(-1);
  const active = layer.ownerDocument.activeElement;
  if (!layer.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Wires close buttons, backdrops, Escape and the Tab trap for every sheet. */
export function initSheets(doc = document) {
  for (const layer of doc.querySelectorAll(".sheet-layer")) {
    layer.addEventListener("click", (event) => {
      if (event.target.closest("[data-sheet-close], [data-sheet-action]")) closeSheet(layer.id, doc);
    });
  }
  doc.addEventListener("keydown", (event) => {
    const top = stack.at(-1);
    if (!top || !top.layer.isConnected) return;
    if (event.key === "Escape") closeSheet(top.layer.id, doc);
    else if (event.key === "Tab") trapTab(event, top.layer);
  });
}

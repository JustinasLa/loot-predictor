// [-] [ 25 ] [+] steppers around a real number input. Buttons carry
// data-step-for="<inputId>" and data-step="-1|1".
function nextValue(input, step) {
  const current = input.value.trim() === "" ? NaN : Number(input.value);
  let next = Number.isFinite(current) ? current + step : Number(input.min || 0);
  if (input.min !== "") next = Math.max(next, Number(input.min));
  if (input.max !== "") next = Math.min(next, Number(input.max));
  return next;
}

export function initSteppers(root = document) {
  const doc = root.ownerDocument ?? root;
  for (const button of root.querySelectorAll("[data-step-for]")) {
    const input = doc.getElementById(button.dataset.stepFor);
    const step = Number(button.dataset.step);
    if (!button.hasAttribute("aria-label")) {
      // "Decrease How many", "Increase Keys I have": the field's own label,
      // without its trailing question mark or colon.
      const label = (input.labels[0]?.textContent.trim() ?? "").replace(/[?:]$/, "");
      button.setAttribute("aria-label", `${step < 0 ? "Decrease" : "Increase"} ${label}`.trim());
    }
    button.addEventListener("click", () => {
      input.value = String(nextValue(input, step));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
}

// Keeps a row of .chip[data-value] buttons in sync with a (visually hidden)
// <select>, which stays the source of truth for app code and tests.
export function bindChipsToSelect(group, select) {
  const chips = [...group.querySelectorAll(".chip[data-value]")];
  const sync = () => {
    for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.value === select.value));
  };
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      if (select.value !== chip.dataset.value) {
        select.value = chip.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      sync();
    });
  }
  select.addEventListener("change", sync);
  sync();
  return sync;
}

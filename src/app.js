import { UnityRandom } from "./rng/unity-random.js";
import { TABLES } from "./loot/tables.js";
import { renderResults, renderError } from "./ui/render.js";

// Walk a loot table with the same draw order the game uses.
export function predict(seed, tableKey, count) {
  const rng = new UnityRandom(seed);
  const table = TABLES[tableKey];
  const out = [];
  for (let i = 0; i < count; i++) {
    // TODO: weighted category pick, then item pick
    out.push("?");
  }
  return out;
}

function init() {
  const out = document.querySelector("#out");
  document.querySelector("#run").addEventListener("click", () => {
    const seed = Number(document.querySelector("#seed").value) || 0;
    const count = Number(document.querySelector("#count").value) || 10;
    try {
      renderResults(out, predict(seed, "common_chest", count));
    } catch (err) {
      renderError(out, err.message);
    }
  });
}

init();

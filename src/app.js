import { parseSavegame } from "./save/parse.js";
import { predictChain } from "./loot/simulate.js";
import { renderChests, renderResults, renderError } from "./ui/render.js";

let cardStates = {};

function runPrediction() {
  const out = document.querySelector("#out");
  const cardId = document.querySelector("#chest").value;
  const count = Number(document.querySelector("#count").value) || 5;

  try {
    const state = cardStates[cardId];
    if (!state) throw new Error("load a savegame first");
    renderResults(
      out,
      cardId,
      predictChain(state.initialSeed, cardId, count, {
        level: state.level,
        vaultPercentage: Number(document.querySelector("#vault").value) || 0
      })
    );
  } catch (err) {
    renderError(out, err.message);
  }
}

function init() {
  const out = document.querySelector("#out");

  document.querySelector("#save").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        cardStates = parseSavegame(ev.target.result);
        renderChests(document.querySelector("#chest"), cardStates);
        runPrediction();
      } catch (err) {
        renderError(out, err.message);
      }
    };
    reader.readAsText(file);
  });

  document.querySelector("#run").addEventListener("click", runPrediction);
}

init();

import { parseSavegame } from "./save/parse.js";
import { predictChain } from "./loot/simulate.js";
import { verifyAll } from "./verify.js";
import {
  renderChests, renderResults, renderVerification, renderError
} from "./ui/render.js";

let cardStates = {};
const compare = { before: null, after: null };

function readSave(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { resolve(parseSavegame(e.target.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("could not read file"));
    reader.readAsText(file);
  });
}

function runPrediction() {
  const out = document.querySelector("#out");
  try {
    const cardId = document.querySelector("#chest").value;
    const state = cardStates[cardId];
    if (!state) throw new Error("load a savegame first");

    renderResults(out, cardId, predictChain(
      state.initialSeed,
      cardId,
      Number(document.querySelector("#count").value) || 5,
      {
        level: state.level,
        vaultPercentage: Number(document.querySelector("#vault").value) || 0
      }
    ));
  } catch (err) {
    renderError(out, err.message);
  }
}

function runVerification() {
  const out = document.querySelector("#out-verify");
  try {
    if (!compare.before || !compare.after) throw new Error("load both savegames");
    renderVerification(out, verifyAll(compare.before, compare.after));
  } catch (err) {
    renderError(out, err.message);
  }
}

function initTabs() {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".tab")) {
        other.classList.toggle("is-active", other === tab);
      }
      for (const panel of document.querySelectorAll(".panel")) {
        panel.classList.toggle("is-hidden", panel.id !== `panel-${tab.dataset.tab}`);
      }
    });
  }
}

function init() {
  initTabs();

  document.querySelector("#save").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const out = document.querySelector("#out");
    try {
      cardStates = await readSave(file);
      renderChests(document.querySelector("#chest"), cardStates);
      document.querySelector("#run").disabled = false;
      runPrediction();
    } catch (err) {
      renderError(out, err.message);
    }
  });

  document.querySelector("#run").addEventListener("click", runPrediction);
  document.querySelector("#chest").addEventListener("change", runPrediction);

  for (const which of ["before", "after"]) {
    document.querySelector(`#save-${which}`).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        compare[which] = await readSave(file);
        document.querySelector("#run-verify").disabled = !(compare.before && compare.after);
        if (compare.before && compare.after) runVerification();
      } catch (err) {
        renderError(document.querySelector("#out-verify"), err.message);
      }
    });
  }

  document.querySelector("#run-verify").addEventListener("click", runVerification);
}

init();

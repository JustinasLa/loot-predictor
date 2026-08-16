// Predict upcoming chest contents from a savegame export.
//
//   node tools/predict.mjs <savegame.json> [cardId] [count]
//
// With no cardId, lists every chest/egg found in the save.

import { readFileSync } from "node:fs";
import { parseSavegame } from "../src/save/parse.js";
import { predictChain } from "../src/loot/simulate.js";

const [file, cardId, countArg] = process.argv.slice(2);
if (!file) {
  console.error("usage: node tools/predict.mjs <savegame.json> [cardId] [count]");
  process.exit(1);
}

const states = parseSavegame(readFileSync(file, "utf8"));

if (!cardId) {
  console.log("chests found in save:\n");
  for (const [id, st] of Object.entries(states)) {
    const lvl = st.level ? `  level=${st.level}` : "";
    const opened = st.openedCount != null ? `  opened=${st.openedCount}` : "";
    console.log(`  ${id.padEnd(20)} seed=${String(st.initialSeed).padStart(11)}${opened}${lvl}`);
  }
  console.log("\nrerun with a cardId to predict, e.g.:");
  console.log(`  node tools/predict.mjs "${file}" big 5`);
  process.exit(0);
}

const state = states[cardId];
if (!state) {
  console.error(`no such chest in save: ${cardId}`);
  console.error(`available: ${Object.keys(states).join(", ")}`);
  process.exit(1);
}

const count = Number(countArg) || 5;
const chain = predictChain(state.initialSeed, cardId, count, {
  level: state.level,
  vaultPercentage: 0
});

console.log(`${cardId}  seed=${state.initialSeed}  next ${count} opens\n`);
for (const open of chain) {
  console.log(`open #${open.open}  (seed ${open.seed})`);
  for (const item of open.items) console.log(`    ${item.name}`);
  if (open.keyRoll !== undefined) console.log(`    [keyRoll ${open.keyRoll}]`);
  console.log(`    -> nextSeed ${open.nextSeed}`);
}

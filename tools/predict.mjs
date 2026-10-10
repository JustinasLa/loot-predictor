// Predict upcoming chest contents from a savegame export.
//
//   node tools/predict.mjs <savegame.json> [cardId] [count]
//
// With no cardId, lists every chest/egg found in the save.

import { readFileSync } from "node:fs";
import { parseSavegame } from "../src/save/parse.js";
import { predictChain } from "../src/loot/simulate.js";
import { validateInteger } from "../src/validation.js";

function main() {
  const [file, cardId, countArg] = process.argv.slice(2);
  if (!file) {
    console.error("usage: node tools/predict.mjs <savegame.json> [cardId] [count]");
    return 1;
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
    return 0;
  }

  if (!Object.hasOwn(states, cardId)) {
    console.error(`no such chest in save: ${cardId}`);
    console.error(`available: ${Object.keys(states).join(", ")}`);
    return 1;
  }
  const state = states[cardId];

  const count = countArg === undefined ? 5 : validateInteger(Number(countArg), "count", 1, 10000);
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
}

let exitCode;
try {
  exitCode = main();
} catch (error) {
  console.error(error.message);
  exitCode = 1;
}
if (exitCode !== undefined) process.exit(exitCode);

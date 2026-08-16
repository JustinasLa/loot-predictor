# Loot Predictor

Deterministic loot prediction for RNG-driven chests. Reimplements the game
engine PRNG in JavaScript, then walks the loot tables with the same draw
order the game uses.

Status: skeleton only. Nothing is implemented yet.

## Run

    npm install
    npm run dev

## Layout

- `src/rng/unity-random.js` — PRNG reimplementation
- `src/loot/tables.js` — loot table data, mapped empirically
- `src/ui/render.js` — DOM rendering helpers
- `src/app.js` — prediction logic + UI wiring
- `public/` — static assets

## TODO

- [ ] Confirm the PRNG algorithm against known seed/output pairs
- [ ] Confirm the two-draws-per-roll assumption
- [ ] Fill in loot tables from logged openings
- [ ] Solver (`src/solver/`) for cheapest-path and max-XP search

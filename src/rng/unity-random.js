// Reimplementation of the game engine's PRNG.
// Confirm which algorithm the target build uses (xorshift128 vs LCG) by
// matching known seed -> output pairs before trusting any prediction.

export class UnityRandom {
  constructor(seed) {
    // TODO: seed the internal state
    this.seed = seed >>> 0;
  }

  // Raw 32-bit draw.
  nextUint() {
    // TODO: implement the state transition
    throw new Error("not implemented");
  }

  // [0, 1)
  nextFloat() {
    // TODO: derive from nextUint()
    throw new Error("not implemented");
  }

  // [min, max)
  range(min, max) {
    // TODO: derive from nextFloat()
    throw new Error("not implemented");
  }
}

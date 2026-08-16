// Reimplementation of the game engine's PRNG.
// Confirm which algorithm the target build uses (xorshift128 vs LCG) by
// matching known seed -> output pairs before trusting any prediction.
//
// Current implementation: 32-bit linear congruential generator,
//   state = (state * MULTIPLIER + INCREMENT) mod 2^32
// with the Numerical Recipes constants. Stock Unity's UnityEngine.Random is
// xorshift128, so these constants are a starting point, not a confirmed
// match — override them via the `opts` argument once real pairs are logged.

export const LCG_MULTIPLIER = 1664525;
export const LCG_INCREMENT = 1013904223;

export class UnityRandom {
  constructor(seed, opts = {}) {
    this.multiplier = (opts.multiplier ?? LCG_MULTIPLIER) >>> 0;
    this.increment = (opts.increment ?? LCG_INCREMENT) >>> 0;
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  // Restart the sequence from the original (or a new) seed.
  reset(seed = this.seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
    return this;
  }

  // Raw 32-bit draw.
  nextUint() {
    // Math.imul keeps the multiply in 32-bit space; >>> 0 forces unsigned.
    this.state = (Math.imul(this.state, this.multiplier) + this.increment) >>> 0;
    return this.state;
  }

  // [0, 1)
  nextFloat() {
    // Take the top 24 bits: the low bits of an LCG have short periods and
    // 24 bits is the mantissa width of the float32 the engine would produce.
    return (this.nextUint() >>> 8) / 0x1000000;
  }

  // [min, max)
  range(min, max) {
    return min + this.nextFloat() * (max - min);
  }

  // [min, max) over integers. Returns min when the span is empty.
  rangeInt(min, max) {
    const lo = Math.ceil(min);
    const span = Math.floor(max) - lo;
    if (span <= 0) return lo;
    return lo + Math.floor(this.nextFloat() * span);
  }
}

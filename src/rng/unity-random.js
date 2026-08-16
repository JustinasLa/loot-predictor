// Reimplementation of the game engine's PRNG.
//
// The engine does NOT use an LCG. It uses C#'s System.Random — Knuth's
// subtractive (lagged Fibonacci) generator — which is what Mono ships and
// what a persisted int32 `Seed` per chest is fed into. Ported to match the
// reference implementation (github.com/1vcian/ev) draw for draw.

export class UnityRandom {
  #MBIG = 2147483647;
  #MSEED = 161803398;
  #SeedArray = new Array(56);
  #inext;
  #inextp;

  constructor(seed) {
    this.initState(seed);
  }

  initState(seed) {
    let ii, mj, mk;

    mj = (this.#MSEED - Math.abs(seed)) | 0;
    this.#SeedArray[55] = mj;
    mk = 1;

    for (let i = 1; i < 55; i++) {
      ii = (21 * i) % 55;
      this.#SeedArray[ii] = mk;
      mk = (mj - mk) | 0;
      if (mk < 0) mk = (mk + this.#MBIG) | 0;
      mj = this.#SeedArray[ii];
    }

    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        this.#SeedArray[i] =
          (this.#SeedArray[i] - this.#SeedArray[1 + ((i + 30) % 55)]) | 0;
        if (this.#SeedArray[i] < 0) {
          this.#SeedArray[i] = (this.#SeedArray[i] + this.#MBIG) | 0;
        }
      }
    }

    this.#inext = 0;
    this.#inextp = 21;
  }

  // [0, 1)
  sample() {
    this.#inext = (this.#inext + 1) % 56;
    this.#inextp = (this.#inextp + 1) % 56;

    let retVal = (this.#SeedArray[this.#inext] - this.#SeedArray[this.#inextp]) | 0;
    if (retVal < 0) retVal = (retVal + this.#MBIG) | 0;

    return retVal * (1 / this.#MBIG);
  }

  // Integer in [min, max). Note this floors — it is not a float range.
  range(min, max) {
    if (min >= max) {
      console.error("min is greater than or equal to max, returning min");
      return min;
    }
    const span = max - min;
    return min + Math.floor(this.sample() * span);
  }
}

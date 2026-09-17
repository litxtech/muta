/**
 * NOX REELS — seeded RNG (client + sim).
 */

export type SeededRng = {
  next(): number;
  nextInt(maxExclusive: number): number;
};

export function createSeededRng(seed: string): SeededRng {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  if (state === 0) state = 0x9e3779b9;

  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
    nextInt(maxExclusive: number) {
      if (maxExclusive <= 0) return 0;
      return Math.floor(this.next() * maxExclusive);
    },
  };
}

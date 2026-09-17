/**
 * Deterministik seeded RNG — production sonucu için Math.random kullanılmaz.
 */

export type SeededRng = {
  next(): number;
  nextInt(maxExclusive: number): number;
  pickWeighted<T>(items: ReadonlyArray<{ item: T; weight: number }>): T;
  chance(probability: number): boolean;
  getState(): number;
};

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function createSeededRng(seed: string | number): SeededRng {
  const seedStr = typeof seed === 'number' ? String(seed) : seed;
  const seedFn = xmur3(seedStr);
  let state = seedFn();

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt(maxExclusive: number) {
      if (maxExclusive <= 0) return 0;
      return Math.floor(next() * maxExclusive);
    },
    pickWeighted<T>(items: ReadonlyArray<{ item: T; weight: number }>) {
      if (items.length === 0) throw new Error('pickWeighted: empty');
      let total = 0;
      for (const entry of items) total += Math.max(0, entry.weight);
      if (total <= 0) return items[0]!.item;
      let r = next() * total;
      for (const entry of items) {
        r -= Math.max(0, entry.weight);
        if (r <= 0) return entry.item;
      }
      return items[items.length - 1]!.item;
    },
    chance(probability: number) {
      return next() < probability;
    },
    getState: () => state,
  };
}

export function cryptoSeedHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i += 1) {
      arr[i] = (Date.now() + i * 997) % 256;
    }
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministik PRNG — mulberry32.
 * Math.random() kullanılmaz.
 */

import type { SeededRandom } from '../tipler/KristalTipleri';

/** mulberry32: seed → [0, 1) üreten fonksiyon */
export function mulberry32(seed: number): SeededRandom {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed: number): SeededRandom {
  return mulberry32(seed >>> 0);
}

/** [0, max) tam sayı */
export function seededInt(rng: SeededRandom, max: number): number {
  if (max <= 0) return 0;
  return Math.floor(rng() * max);
}

export function seedFromString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

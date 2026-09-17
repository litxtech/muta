/**
 * Realm of Storms — kazanc SFX (jeton yagmuru + cha-ching).
 * Yalnizca win / count-up dosyalarini yazar; diger SFX'e dokunmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../assets/realm-of-storms/audio');
const SR = 44100;

fs.mkdirSync(OUT, { recursive: true });

function clamp(v, lo = -1, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function writeWav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE((clamp(samples[i]) * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('wrote', name, (n / SR).toFixed(2) + 's');
}

function env(t, a, d, s, r, dur) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / r);
  return 0;
}

function tone(freq, t) {
  return Math.sin(2 * Math.PI * freq * t);
}

function render(seconds, fn) {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i, n);
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.94 / peak;
  for (let i = 0; i < n; i++) out[i] *= g;
  return out;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function brass(freq, t) {
  let s = 0;
  for (let h = 1; h <= 8; h++) {
    const w = h % 2 === 1 ? 1 : 0.42;
    s += Math.sin(2 * Math.PI * freq * h * t) * (w / h);
  }
  return s * 0.28;
}

function coinPing(t, freq, rng) {
  if (t < 0 || t > 0.22) return 0;
  const modes = [1, 2.76, 5.404, 8.933];
  let s = 0;
  for (let i = 0; i < modes.length; i++) {
    const d = 22 + i * 18;
    s += Math.sin(2 * Math.PI * freq * modes[i] * t) * Math.exp(-t * d) * (1 / (i + 1.15));
  }
  const click = (rng() * 2 - 1) * Math.exp(-t * 90) * 0.45;
  const body = Math.sin(2 * Math.PI * (freq * 0.22) * t) * Math.exp(-t * 16) * 0.22;
  return s * 0.85 + click + body;
}

function coinRain(t, rng, density, baseFreq) {
  const period = 1 / density;
  const idx = Math.floor(t / period);
  const local = t - idx * period;
  const jitter = ((idx * 17 + 11) % 10) / 10;
  const freq = baseFreq * (0.86 + jitter * 0.42);
  rng();
  return coinPing(local, freq, rng);
}

function winFanfare(tier) {
  const dur = tier === 'legendary' ? 3.6 : tier === 'mega' ? 3.0 : tier === 'big' ? 2.4 : 1.65;
  const roots =
    tier === 'legendary'
      ? [130.81, 164.81, 196.0, 261.63, 329.63, 392.0]
      : tier === 'mega'
        ? [146.83, 185.0, 220.0, 293.66, 369.99]
        : tier === 'big'
          ? [164.81, 196.0, 246.94, 329.63]
          : [196.0, 246.94, 293.66, 392.0];
  const rainDensity = tier === 'legendary' ? 22 : tier === 'mega' ? 18 : tier === 'big' ? 14 : 11;
  const rng = mulberry32(tier === 'legendary' ? 91 : tier === 'mega' ? 73 : tier === 'big' ? 52 : 31);
  return render(dur, (t) => {
    const e = env(t, 0.012, 0.16, 0.72, dur * 0.28, dur);
    let s = 0;
    for (let i = 0; i < roots.length; i++) {
      const start = i * 0.055;
      if (t >= start) {
        const lt = t - start;
        const noteE = Math.exp(-lt * 1.35);
        s += brass(roots[i], lt) * noteE * 0.9;
        s += tone(roots[i] * 2, lt) * noteE * 0.16;
        s += tone(roots[i] * 3, lt) * Math.exp(-lt * 2.4) * 0.08;
      }
    }
    const thump = tone(62, t) * Math.exp(-t * 7) * 0.55 + tone(92, t) * Math.exp(-t * 9) * 0.28;
    const sparkle = tone(1760 + Math.sin(t * 18) * 90, t) * Math.exp(-t * 1.1) * 0.07;
    const rain = coinRain(t, rng, rainDensity, 2100) * (0.55 + 0.45 * e);
    const whoosh = (rng() * 2 - 1) * Math.exp(-t * 3.2) * 0.12 * env(t, 0.01, 0.08, 0.35, 0.4, Math.min(0.7, dur));
    return Math.tanh((s * e + thump + sparkle + rain + whoosh) * 1.15);
  });
}

function countUpTick() {
  const dur = 1.0;
  const rng = mulberry32(404);
  return render(dur, (t) => {
    const rain = coinRain(t, rng, 16, 1880);
    const shimmer = tone(1480, t) * 0.035;
    const edge = env(t, 0.006, 0.02, 1, 0.006, dur);
    return Math.tanh((rain * 1.4 + shimmer) * 1.15) * edge;
  });
}

function countUpEnd() {
  const dur = 1.15;
  const rng = mulberry32(777);
  return render(dur, (t) => {
    const drawer = tone(98, t) * Math.exp(-t * 8) * 0.5 + tone(62, t) * Math.exp(-t * 6) * 0.35;
    const ching1 = coinPing(t, 2480, rng);
    const ching2 = t >= 0.07 ? coinPing(t - 0.07, 3120, rng) * 0.9 : 0;
    const chordT = Math.max(0, t - 0.04);
    const chord =
      (brass(523.25, chordT) + brass(659.25, chordT) * 0.85 + brass(783.99, chordT) * 0.7) *
      env(chordT, 0.008, 0.12, 0.45, 0.7, 1.05) *
      0.55;
    const pile = coinRain(t, rng, 16, 2400) * Math.exp(-t * 1.8) * 0.7;
    const sparkle = tone(2093, t) * Math.exp(-t * 4.5) * 0.12;
    return Math.tanh((drawer + ching1 + ching2 + chord + pile + sparkle) * 1.1);
  });
}

const files = {
  'normal_win.wav': winFanfare('normal'),
  'big_win.wav': winFanfare('big'),
  'mega_win.wav': winFanfare('mega'),
  'legendary_win.wav': winFanfare('legendary'),
  'count_up.wav': countUpTick(),
  'count_up_end.wav': countUpEnd(),
};

for (const [name, samples] of Object.entries(files)) {
  writeWav(name, samples);
}

console.log('done', Object.keys(files).length, 'win sfx ->', OUT);

/**
 * Realm of Storms — özgün prosedürel SFX/müzik üretici (WAV PCM 16-bit mono).
 * Telifsiz; Match-3 remap yerine fırtına/kristal/şimşek hissi.
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
  const dest = path.join(OUT, name);
  fs.writeFileSync(dest, buf);
  console.log('wrote', name, `${(n / SR).toFixed(2)}s`);
}

function env(t, a, d, s, r, dur) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / r);
  return 0;
}

function noise() {
  return Math.random() * 2 - 1;
}

function lowpass(prev, x, alpha) {
  return prev + alpha * (x - prev);
}

function tone(freq, t, detune = 0) {
  return Math.sin(2 * Math.PI * (freq + detune) * t);
}

function render(seconds, fn) {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i, n);
  return out;
}

function mix(...parts) {
  const len = Math.max(...parts.map((p) => p.length));
  const out = new Float32Array(len);
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) out[i] += p[i];
  }
  let peak = 1e-6;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.92 / peak;
  for (let i = 0; i < len; i++) out[i] *= g;
  return out;
}

/** Kristal çarpışma / land */
function crystalLand() {
  return render(0.28, (t) => {
    const e = env(t, 0.002, 0.04, 0.25, 0.2, 0.28);
    const body =
      tone(920, t) * 0.35 +
      tone(1380, t) * 0.25 +
      tone(2100, t) * 0.15 +
      tone(460, t) * 0.2;
    const tick = noise() * Math.exp(-t * 40) * 0.35;
    return (body + tick) * e;
  });
}

/** Düşüş whoosh */
function symbolsFalling() {
  return render(0.55, (t) => {
    const e = env(t, 0.05, 0.15, 0.7, 0.25, 0.55);
    let n = noise();
    n = lowpass(0, n, 0.08 + t * 0.25);
    const sweep = tone(180 + t * 420, t) * 0.15;
    return (n * 0.55 + sweep) * e * (0.4 + t);
  });
}

/** Match sparkle chord */
function symbolMatch() {
  return render(0.42, (t) => {
    const e = env(t, 0.005, 0.08, 0.4, 0.28, 0.42);
    const chord =
      tone(523.25, t) * 0.28 +
      tone(659.25, t) * 0.28 +
      tone(783.99, t) * 0.22 +
      tone(1046.5, t) * 0.18;
    const shimmer = tone(2100 + Math.sin(t * 40) * 80, t) * 0.12 * Math.exp(-t * 6);
    return (chord + shimmer) * e;
  });
}

/** Kristal kırılma */
function symbolDestroy() {
  return render(0.38, (t) => {
    const e = env(t, 0.001, 0.03, 0.2, 0.3, 0.38);
    const crack = noise() * Math.exp(-t * 18);
    const glass =
      tone(2400, t) * Math.exp(-t * 22) * 0.4 +
      tone(3600, t) * Math.exp(-t * 28) * 0.25;
    const low = tone(90, t) * Math.exp(-t * 10) * 0.35;
    return (crack * 0.55 + glass + low) * e;
  });
}

/** Cascade combo swell */
function cascadeStart() {
  return render(0.5, (t) => {
    const e = env(t, 0.02, 0.12, 0.55, 0.28, 0.5);
    const rise =
      tone(220 + t * 480, t) * 0.35 +
      tone(330 + t * 520, t) * 0.25 +
      tone(440 + t * 200, t) * 0.2;
    const spark = noise() * Math.exp(-t * 8) * 0.2;
    return (rise + spark) * e;
  });
}

/** Multiplier orb spawn */
function multiplierSpawn() {
  return render(0.55, (t) => {
    const e = env(t, 0.01, 0.1, 0.5, 0.3, 0.55);
    const whoosh = noise() * Math.exp(-t * 5) * 0.3;
    const power =
      tone(110, t) * 0.4 +
      tone(220, t) * 0.25 +
      tone(880 * (1 + t * 0.4), t) * 0.3;
    return (whoosh + power) * e;
  });
}

function multiplierTone(base) {
  return render(0.45, (t) => {
    const e = env(t, 0.008, 0.08, 0.45, 0.28, 0.45);
    return (
      (tone(base, t) * 0.35 +
        tone(base * 1.5, t) * 0.28 +
        tone(base * 2, t) * 0.2 +
        noise() * Math.exp(-t * 20) * 0.15) *
      e
    );
  });
}

/** Şimşek */
function lightning() {
  return render(0.7, (t) => {
    const crack = Math.exp(-t * 35) * (noise() * 0.9);
    const rumble =
      tone(55 + noise() * 8, t) * Math.exp(-t * 3.5) * 0.55 +
      tone(90, t) * Math.exp(-t * 4) * 0.25;
    const echo = t > 0.08 ? noise() * Math.exp(-(t - 0.08) * 12) * 0.35 : 0;
    return crack + rumble + echo;
  });
}

/** Character cast */
function characterCast() {
  return render(0.6, (t) => {
    const e = env(t, 0.02, 0.12, 0.5, 0.35, 0.6);
    const sweep = tone(160 + t * 900, t) * 0.4;
    const spark = noise() * Math.exp(-t * 7) * 0.35;
    const hum = tone(70, t) * 0.3;
    return (sweep + spark + hum) * e;
  });
}

/** Scatter portal */
function scatterLand() {
  return render(0.65, (t) => {
    const e = env(t, 0.02, 0.15, 0.55, 0.35, 0.65);
    const portal =
      tone(180, t) * 0.25 +
      tone(270, t) * 0.2 +
      tone(540 + Math.sin(t * 12) * 40, t) * 0.3;
    const swirl = noise() * (0.2 + 0.3 * Math.sin(t * 20)) * Math.exp(-t * 2);
    return (portal + swirl) * e;
  });
}

/** Anticipation tension */
function anticipation() {
  return render(1.2, (t) => {
    const e = env(t, 0.05, 0.2, 0.8, 0.2, 1.2);
    const pulse = 0.6 + 0.4 * Math.sin(t * 14);
    const drone = tone(98, t) * 0.35 + tone(147, t) * 0.25;
    const tick = Math.sin(t * 28 * Math.PI) > 0.92 ? noise() * 0.4 : 0;
    return (drone * pulse + tick) * e * 0.85;
  });
}

/** Bonus trigger fanfare */
function bonusTrigger() {
  return render(1.4, (t) => {
    const e = env(t, 0.02, 0.2, 0.65, 0.5, 1.4);
    const notes = [196, 247, 294, 392, 494];
    let s = 0;
    for (let i = 0; i < notes.length; i++) {
      const start = i * 0.12;
      if (t >= start) {
        const lt = t - start;
        s += tone(notes[i], lt) * Math.exp(-lt * 2.2) * 0.28;
      }
    }
    s += noise() * Math.exp(-t * 4) * 0.2;
    return s * e;
  });
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


/** UI click */
function uiClick() {
  return render(0.12, (t) => {
    const e = env(t, 0.001, 0.02, 0.3, 0.08, 0.12);
    return (tone(880, t) * 0.4 + tone(1320, t) * 0.25 + noise() * 0.1 * Math.exp(-t * 50)) * e;
  });
}

function spinPress() {
  return render(0.22, (t) => {
    const e = env(t, 0.002, 0.04, 0.35, 0.14, 0.22);
    return (
      (tone(140, t) * 0.4 +
        tone(280, t) * 0.25 +
        noise() * Math.exp(-t * 25) * 0.35) *
      e
    );
  });
}

function errorBlip() {
  return render(0.25, (t) => {
    const e = env(t, 0.002, 0.05, 0.3, 0.15, 0.25);
    return (tone(180 - t * 80, t) * 0.5 + noise() * 0.15 * Math.exp(-t * 20)) * e;
  });
}



function ambientWind() {
  return render(8, (t) => {
    let n = noise();
    n = lowpass(0, n, 0.02);
    const gust = 0.55 + 0.45 * Math.sin(t * 0.7) * Math.sin(t * 0.23);
    const toneLayer = tone(70 + Math.sin(t * 0.4) * 8, t) * 0.08;
    return (n * 0.55 + toneLayer) * gust * 0.35;
  });
}

/** Looping base music bed */
function backgroundMusic() {
  return render(16, (t) => {
    const bar = Math.floor(t / 2) % 4;
    const roots = [110, 98, 82.4, 92.5];
    const root = roots[bar];
    const pad =
      tone(root, t) * 0.22 +
      tone(root * 1.5, t) * 0.14 +
      tone(root * 2, t) * 0.1 +
      tone(root * 3, t) * 0.06;
    const pulse = 0.7 + 0.3 * Math.sin(t * Math.PI);
    let n = noise();
    n = lowpass(0, n, 0.015);
    const shimmer = tone(880 + Math.sin(t * 0.5) * 40, t) * 0.04 * (0.5 + 0.5 * Math.sin(t * 2));
    return (pad * pulse + n * 0.12 + shimmer) * 0.55;
  });
}

function bonusMusic() {
  return render(16, (t) => {
    const roots = [130.8, 146.8, 164.8, 174.6];
    const root = roots[Math.floor(t / 1.5) % 4];
    const pad =
      tone(root, t) * 0.25 +
      tone(root * 1.25, t) * 0.16 +
      tone(root * 2, t) * 0.12;
    const arpeggioFreq = [root * 2, root * 2.5, root * 3, root * 4][Math.floor(t * 4) % 4];
    const arp = tone(arpeggioFreq, t) * 0.08 * Math.exp(-(t % 0.25) * 8);
    let n = noise();
    n = lowpass(0, n, 0.02);
    return (pad + arp + n * 0.1) * 0.6;
  });
}

function gameOpen() {
  return render(1.1, (t) => {
    const e = env(t, 0.05, 0.25, 0.55, 0.4, 1.1);
    const rise = tone(80 + t * 200, t) * 0.4;
    const sparkle =
      tone(660, t) * Math.exp(-t * 2) * 0.2 +
      tone(990, t) * Math.exp(-t * 2.5) * 0.15;
    return (rise + sparkle + noise() * Math.exp(-t * 3) * 0.15) * e;
  });
}

function gameExit() {
  return render(0.7, (t) => {
    const e = env(t, 0.02, 0.15, 0.4, 0.4, 0.7);
    return (tone(220 - t * 120, t) * 0.4 + tone(110 - t * 40, t) * 0.3) * e;
  });
}

const files = {
  'crystal_land.wav': crystalLand(),
  'symbols_falling.wav': symbolsFalling(),
  'symbol_match.wav': symbolMatch(),
  'symbol_destroy.wav': symbolDestroy(),
  'cascade_start.wav': cascadeStart(),
  'multiplier_spawn.wav': multiplierSpawn(),
  'multiplier_small.wav': multiplierTone(440),
  'multiplier_medium.wav': multiplierTone(330),
  'multiplier_large.wav': multiplierTone(220),
  'multiplier_collect.wav': multiplierTone(392),
  'lightning.wav': lightning(),
  'character_cast.wav': characterCast(),
  'scatter_land.wav': scatterLand(),
  'scatter_anticipation.wav': anticipation(),
  'bonus_trigger.wav': bonusTrigger(),
  'bonus_intro.wav': bonusTrigger(),
  'retrigger.wav': winFanfare('big'),
  'normal_win.wav': winFanfare('normal'),
  'big_win.wav': winFanfare('big'),
  'mega_win.wav': winFanfare('mega'),
  'legendary_win.wav': winFanfare('legendary'),
  'ui_click.wav': uiClick(),
  'spin_press.wav': spinPress(),
  'error.wav': errorBlip(),
  'count_up.wav': countUpTick(),
  'count_up_end.wav': countUpEnd(),
  'ambient_wind.wav': ambientWind(),
  'background_music.wav': backgroundMusic(),
  'bonus_music.wav': bonusMusic(),
  'game_open.wav': gameOpen(),
  'game_exit.wav': gameExit(),
  'free_spin_start.wav': cascadeStart(),
};

for (const [name, samples] of Object.entries(files)) {
  writeWav(name, samples);
}

console.log('done', Object.keys(files).length, 'files →', OUT);

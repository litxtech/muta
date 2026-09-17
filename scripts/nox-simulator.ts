/**
 * NOX REELS matematik simülasyonu.
 * Kullanım: npx tsx scripts/nox-simulator.ts [spins]
 */

import { runBatchSimulation } from '../src/moduller/oyunlar/slot/motor/SlotMotoru';
import { DEFAULT_MATH_CONFIG } from '../src/moduller/oyunlar/slot/sabitler/SlotAyarlari';

const spins = Math.max(1, Number(process.argv[2] ?? 100_000));
const bet = DEFAULT_MATH_CONFIG.betPresets[1] ?? 20;

console.log(`NOX REELS sim — ${spins.toLocaleString()} spin @ bet ${bet}`);
const t0 = Date.now();
const r = runBatchSimulation({
  spins,
  betAmount: bet,
  seedPrefix: 'nox-sim',
});
const ms = Date.now() - t0;

console.log(
  JSON.stringify(
    {
      spins,
      bet,
      totalBet: r.totalBet,
      totalPayout: r.totalPayout,
      rtp: Number(r.rtp.toFixed(4)),
      hitFrequency: Number(r.hitFrequency.toFixed(4)),
      avgWin: Number(r.avgWin.toFixed(2)),
      maxWin: r.maxWin,
      bonusFrequency: Number(r.bonusFrequency.toFixed(5)),
      symbolHits: r.symbolHits,
      elapsedMs: ms,
    },
    null,
    2,
  ),
);

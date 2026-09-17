/**
 * RTP profil kalibrasyonu — paytable lineer ölçeklenir, simülasyonla doğrulanır.
 * Çalıştır: npx --yes tsx scripts/kaskad-calibrate.ts <scale> [rounds]
 * Çıktı: ölçeklenmiş paytable JSON + simüle RTP.
 */

import { DEFAULT_MATH_CONFIG } from '../src/moduller/oyunlar/kaskad/sabitler/KaskadSabitleri';
import { runBatchSimulation } from '../src/moduller/oyunlar/kaskad/motor/SpinSimulator';
import type { KaskadMathConfig, SymbolPaytable } from '../src/moduller/oyunlar/kaskad/tipler/KaskadTipleri';

const scale = Number(process.argv[2] ?? 1);
const rounds = Number(process.argv[3] ?? 300_000);

function scalePaytable(base: SymbolPaytable, k: number): SymbolPaytable {
  const out: SymbolPaytable = {};
  for (const [sym, band] of Object.entries(base)) {
    if (!band) continue;
    out[sym as keyof SymbolPaytable] = {
      8: Math.round(band[8] * k * 100) / 100,
      10: Math.round(band[10] * k * 100) / 100,
      12: Math.round(band[12] * k * 100) / 100,
    };
  }
  return out;
}

const paytable = scalePaytable(DEFAULT_MATH_CONFIG.paytable, scale);
const config: KaskadMathConfig = { ...DEFAULT_MATH_CONFIG, paytable };

console.log(`scale=${scale} rounds=${rounds.toLocaleString()}`);
console.log('paytable:', JSON.stringify(paytable));

const report = runBatchSimulation(config, rounds, 100, 'calib');
console.log(`observedRtp=${(report.observedRtp * 100).toFixed(2)}%`);
console.log(`hitRate=${(report.hitRate * 100).toFixed(2)}%`);
console.log(`bonusRtp=${(report.bonusRtp * 100).toFixed(2)}%`);
console.log(`maxWinMultiple=${report.maxWinMultiple.toFixed(0)}x`);

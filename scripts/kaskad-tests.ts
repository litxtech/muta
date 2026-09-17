/**
 * Realm of Storms — unit test paketi (bölüm 71).
 * Çalıştır: npm run test:kaskad  (tsx scripts/kaskad-tests.ts)
 * Jest bağımlılığı yoktur; assert tabanlı, exit code ile CI uyumlu.
 */

import {
  DEFAULT_MATH_CONFIG,
  LOW_SYMBOLS,
  clampAutoplayTours,
  maxAffordableAutoplayTours,
} from '../src/moduller/oyunlar/kaskad/sabitler/KaskadSabitleri';
import { createSeededRng } from '../src/moduller/oyunlar/kaskad/rng/SeededRng';
import {
  createEmptyGrid,
  generateCell,
  generateGrid,
  nextInstanceId,
  resetInstanceCounter,
} from '../src/moduller/oyunlar/kaskad/grid/GridGenerator';
import {
  applyGravityAndFill,
  removeCellsByInstanceIds,
} from '../src/moduller/oyunlar/kaskad/grid/GridCascadeEngine';
import { detectMatches, totalMatchWin } from '../src/moduller/oyunlar/kaskad/matches/MatchDetector';
import {
  calcClusterWin,
  clampBet,
  resolvePayBand,
  resolveWinTier,
  symbolPayoutMult,
  validatePaytable,
} from '../src/moduller/oyunlar/kaskad/paytable/PaytableEngine';
import {
  applyMultiplierToWin,
  applyStepMultiplier,
  extractActiveMultipliers,
  sumMultipliers,
} from '../src/moduller/oyunlar/kaskad/multipliers/MultiplierEngine';
import {
  evaluateRetrigger,
  resolveBonusAward,
} from '../src/moduller/oyunlar/kaskad/scatter/ScatterEngine';
import { simulateSpin } from '../src/moduller/oyunlar/kaskad/motor/SpinSimulator';
import { EMPTY_INSTANCE_ID, isMultiplier, isPaySymbol, isScatter } from '../src/moduller/oyunlar/kaskad/symbols/SymbolRules';
import type {
  GridCell,
  GridMatrix,
  KaskadSymbolType,
} from '../src/moduller/oyunlar/kaskad/tipler/KaskadTipleri';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${name}: ${msg}`);
    console.error(`  ✗ ${name} — ${msg}`);
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg} (beklenen ${String(expected)}, gelen ${String(actual)})`);
  }
}

const CFG = DEFAULT_MATH_CONFIG;

/** Test grid'i: verilen sembol yerleşimi ile 6x5 matris üret */
function buildGrid(
  place: Array<{ symbol: KaskadSymbolType; count: number; mult?: number }>,
): GridMatrix {
  resetInstanceCounter(0);
  const grid = createEmptyGrid(CFG.columns, CFG.rows);
  const flat: GridCell[] = [];
  for (const row of grid) for (const cell of row) flat.push(cell);
  let i = 0;
  for (const p of place) {
    for (let k = 0; k < p.count; k += 1) {
      const cell = flat[i];
      if (!cell) throw new Error('grid kapasitesi aşıldı');
      cell.symbolType = p.symbol;
      cell.instanceId = nextInstanceId('t');
      cell.multiplierValue = p.mult ?? null;
      i += 1;
    }
  }
  // Kalan hücreler: eşleşmeyecek karışık dolgu (7'şerden az)
  const fillers: KaskadSymbolType[] = [
    'purpleCrystal', 'redCrystal', 'goldCrystal', 'stormRing', 'celestialCup',
  ];
  let f = 0;
  while (i < flat.length) {
    const cell = flat[i]!;
    cell.symbolType = fillers[f % fillers.length]!;
    cell.instanceId = nextInstanceId('f');
    cell.multiplierValue = null;
    i += 1;
    if ((i - place.reduce((a, p) => a + p.count, 0)) % 6 === 0) f += 1;
    f += 1;
  }
  return grid;
}

console.log('— Sembol üretimi / weighted selection —');

test('generateGrid 6x5 = 30 hücre üretir, hepsi geçerli sembol', () => {
  const rng = createSeededRng('gen-1');
  const grid = generateGrid(CFG, rng);
  assertEq(grid.length, CFG.rows, 'satır sayısı');
  for (const row of grid) {
    assertEq(row.length, CFG.columns, 'kolon sayısı');
    for (const cell of row) {
      assert(
        isPaySymbol(cell.symbolType) || isScatter(cell.symbolType) || isMultiplier(cell.symbolType),
        `geçersiz sembol: ${cell.symbolType}`,
      );
      assert(cell.instanceId.length > 0, 'instanceId boş');
    }
  }
});

test('aynı seed aynı grid üretir (deterministik RNG)', () => {
  resetInstanceCounter(0);
  const g1 = generateGrid(CFG, createSeededRng('det-42'));
  resetInstanceCounter(0);
  const g2 = generateGrid(CFG, createSeededRng('det-42'));
  for (let r = 0; r < CFG.rows; r += 1) {
    for (let c = 0; c < CFG.columns; c += 1) {
      assertEq(g1[r]![c]!.symbolType, g2[r]![c]!.symbolType, `hücre ${r},${c}`);
      assertEq(g1[r]![c]!.multiplierValue, g2[r]![c]!.multiplierValue, `mult ${r},${c}`);
    }
  }
});

test('weighted selection dağılımı ağırlıklarla orantılı (±%25 tolerans)', () => {
  const rng = createSeededRng('weights-1');
  const counts = new Map<KaskadSymbolType, number>();
  const n = 60_000;
  for (let i = 0; i < n; i += 1) {
    const cell = generateCell(CFG, rng, 0, 0);
    counts.set(cell.symbolType, (counts.get(cell.symbolType) ?? 0) + 1);
  }
  const totalWeight = Object.values(CFG.symbolWeights).reduce((a, b) => a + b, 0);
  // Özel semboller şanslarıyla düşer; sadece iki büyük pay sembolünü kontrol et
  const expectBlue = (CFG.symbolWeights.blueCrystal! / totalWeight);
  const gotBlue = (counts.get('blueCrystal') ?? 0) / n;
  assert(
    Math.abs(gotBlue - expectBlue) / expectBlue < 0.25,
    `blueCrystal oranı sapmış: beklenen ~${expectBlue.toFixed(3)}, gelen ${gotBlue.toFixed(3)}`,
  );
  const crown = (counts.get('energyCrown') ?? 0) / n;
  assert(crown < gotBlue, 'energyCrown, blueCrystal\'dan sık çıkamaz');
});

test('multiplier spawn: multiplierValue sadece stormMultiplier hücresinde', () => {
  const rng = createSeededRng('mult-spawn');
  for (let i = 0; i < 5_000; i += 1) {
    const cell = generateCell(CFG, rng, 0, 0);
    if (cell.symbolType === 'stormMultiplier') {
      assert((cell.multiplierValue ?? 0) >= 2, 'multiplier değeri eksik');
    } else {
      assertEq(cell.multiplierValue, null, 'pay sembolünde multiplier değeri olamaz');
    }
  }
});

console.log('— Pay anywhere / paytable —');

test('resolvePayBand eşikleri: 7→null, 8→8, 10→10, 12+→12', () => {
  assertEq(resolvePayBand(7), null, '7 sembol ödemez');
  assertEq(resolvePayBand(8), 8, '8 bandı');
  assertEq(resolvePayBand(9), 8, '9 → 8 bandı');
  assertEq(resolvePayBand(10), 10, '10 bandı');
  assertEq(resolvePayBand(11), 10, '11 → 10 bandı');
  assertEq(resolvePayBand(12), 12, '12 bandı');
  assertEq(resolvePayBand(30), 12, '30 → 12 bandı');
});

test('paytable config geçerli (validatePaytable hata yok)', () => {
  assertEq(validatePaytable(CFG).length, 0, 'paytable hatalı');
});

test('calcClusterWin = bet × paytable çarpanı', () => {
  const win = calcClusterWin(CFG, 'energyCrown', 12, 100);
  assertEq(win, 100 * CFG.paytable.energyCrown![12], 'energyCrown 12+');
  assertEq(calcClusterWin(CFG, 'blueCrystal', 7, 100), 0, '7 sembol ödemez');
});

test('8+ pay anywhere: 8 aynı sembol kazanır, konum önemsiz', () => {
  const grid = buildGrid([{ symbol: 'blueCrystal', count: 8 }]);
  const matches = detectMatches(grid, CFG, 100);
  assertEq(matches.length, 1, 'tek küme');
  assertEq(matches[0]!.symbolType, 'blueCrystal', 'sembol');
  assertEq(matches[0]!.count, 8, 'sayı');
  assertEq(matches[0]!.winAmount, calcClusterWin(CFG, 'blueCrystal', 8, 100), 'ödeme');
});

test('scatter ve multiplier pay-anywhere eşleşmesine katılmaz', () => {
  const grid = buildGrid([
    { symbol: 'portalScatter', count: 8 },
    { symbol: 'stormMultiplier', count: 8, mult: 5 },
  ]);
  assertEq(detectMatches(grid, CFG, 100).length, 0, 'özel semboller eşleşemez');
});

test('aynı anda birden fazla sembol kazanabilir', () => {
  const grid = buildGrid([
    { symbol: 'blueCrystal', count: 9 },
    { symbol: 'greenCrystal', count: 10 },
  ]);
  const matches = detectMatches(grid, CFG, 50);
  assertEq(matches.length, 2, 'iki küme');
  const total = totalMatchWin(matches);
  assertEq(
    total,
    calcClusterWin(CFG, 'blueCrystal', 9, 50) + calcClusterWin(CFG, 'greenCrystal', 10, 50),
    'toplam kazanç',
  );
});

console.log('— Remove / collapse / cascade —');

test('removeCellsByInstanceIds hücreleri EMPTY yapar', () => {
  const grid = buildGrid([{ symbol: 'blueCrystal', count: 8 }]);
  const ids = new Set(detectMatches(grid, CFG, 100)[0]!.cellIds);
  const removed = removeCellsByInstanceIds(grid, ids);
  let empties = 0;
  for (const row of removed) {
    for (const cell of row) {
      if (cell.instanceId === EMPTY_INSTANCE_ID) empties += 1;
    }
  }
  assertEq(empties, 8, 'boşalan hücre sayısı');
});

test('kolon collapse: kalan semboller düşer, yeni semboller üstten gelir', () => {
  const grid = buildGrid([{ symbol: 'blueCrystal', count: 8 }]);
  // İlk satırın tamamını sil → her kolonda 1 boşluk
  const ids = new Set(grid[0]!.map((c) => c.instanceId));
  const removed = removeCellsByInstanceIds(grid, ids);
  const rng = createSeededRng('collapse-1');
  const { grid: filled, newSymbols } = applyGravityAndFill(removed, CFG, rng);
  assertEq(newSymbols.length, CFG.columns, 'her kolon 1 yeni sembol almalı');
  for (const row of filled) {
    for (const cell of row) {
      assert(cell.instanceId !== EMPTY_INSTANCE_ID, 'boş hücre kalamaz');
    }
  }
  // Yeni semboller en üst satırda olmalı
  for (const s of newSymbols) assertEq(s.row, 0, 'yeni sembol üst satırda');
  // Alt satırlardaki eski semboller korunur (2. satır 1. satıra düşmez çünkü boşluk üstte)
  for (let r = 1; r < CFG.rows; r += 1) {
    for (let c = 0; c < CFG.columns; c += 1) {
      assertEq(
        filled[r]![c]!.instanceId,
        grid[r]![c]!.instanceId,
        `hücre ${r},${c} yer değiştirmemeli`,
      );
    }
  }
});

test('gravity: ortadan silinen hücrenin üstü aşağı kayar', () => {
  const grid = buildGrid([{ symbol: 'blueCrystal', count: 8 }]);
  const target = grid[2]![3]!; // orta hücre
  const above = grid[1]![3]!;
  const removed = removeCellsByInstanceIds(grid, new Set([target.instanceId]));
  const { grid: filled } = applyGravityAndFill(removed, CFG, createSeededRng('g2'));
  assertEq(filled[2]![3]!.instanceId, above.instanceId, 'üstteki hücre boşluğa düşmeli');
});

console.log('— Multiplier motoru —');

test('sumMultipliers: boş → 1, değerler toplanır', () => {
  assertEq(sumMultipliers([]), 1, 'boş liste');
  assertEq(sumMultipliers([5, 10, 25]), 40, 'toplama');
});

test('applyStepMultiplier: orb yok + persistent 0 → çarpan 1', () => {
  assertEq(applyStepMultiplier(100, []), 100, 'çarpansız');
  assertEq(applyStepMultiplier(100, [5, 10]), 1500, 'orb toplamı 15');
  assertEq(applyStepMultiplier(100, [5], 10), 1500, 'orb 5 + persistent 10');
  assertEq(applyStepMultiplier(0, [50]), 0, 'kazanç yoksa çarpan uygulanmaz');
});

test('applyMultiplierToWin min 1 çarpan garantisi', () => {
  assertEq(applyMultiplierToWin(100, 0), 100, '0 çarpan → 1 say');
  assertEq(applyMultiplierToWin(100, 25), 2500, '25×');
});

test('extractActiveMultipliers sadece değerli stormMultiplier döner', () => {
  const grid = buildGrid([
    { symbol: 'stormMultiplier', count: 2, mult: 10 },
    { symbol: 'blueCrystal', count: 5 },
  ]);
  const mults = extractActiveMultipliers(grid);
  assertEq(mults.length, 2, 'iki orb');
  assertEq(mults[0]! + mults[1]!, 20, 'değerler');
});

console.log('— Scatter / bonus / retrigger —');

test('resolveBonusAward: 3 scatter → null, 4/5/6 → config spinleri', () => {
  assertEq(resolveBonusAward(CFG, 3), null, '3 scatter bonus vermez');
  assertEq(resolveBonusAward(CFG, 4)!.freeSpins, CFG.scatterBonus[4], '4 scatter');
  assertEq(resolveBonusAward(CFG, 5)!.freeSpins, CFG.scatterBonus[5], '5 scatter');
  assertEq(resolveBonusAward(CFG, 6)!.freeSpins, CFG.scatterBonus[6], '6 scatter');
  assertEq(resolveBonusAward(CFG, 8)!.freeSpins, CFG.scatterBonus[6], '6+ scatter üst bant');
});

test('evaluateRetrigger config eşiğine göre ek spin verir', () => {
  const min = CFG.bonus.retrigger.minScatters;
  assertEq(evaluateRetrigger(CFG, min - 1), 0, 'eşik altı');
  assertEq(evaluateRetrigger(CFG, min), CFG.bonus.retrigger.extraSpins, 'eşik');
});

console.log('— simulateSpin (tam tur) —');

test('deterministik: aynı seed aynı sonucu üretir', () => {
  const a = simulateSpin({
    config: CFG, seed: 'spin-1', betAmount: 100,
    roundId: 'r1', sessionId: 's1', balanceBefore: 10_000,
  });
  const b = simulateSpin({
    config: CFG, seed: 'spin-1', betAmount: 100,
    roundId: 'r1', sessionId: 's1', balanceBefore: 10_000,
  });
  assertEq(a.totalWin, b.totalWin, 'totalWin');
  assertEq(a.cascades.length, b.cascades.length, 'cascade sayısı');
  assertEq(a.totalMultiplier, b.totalMultiplier, 'çarpan');
  assertEq(a.scatterCount, b.scatterCount, 'scatter');
});

test('settlement tutarlılığı: balanceAfter = before − bet + win', () => {
  for (let i = 0; i < 200; i += 1) {
    const r = simulateSpin({
      config: CFG, seed: `settle-${i}`, betAmount: 50,
      roundId: `r${i}`, sessionId: 's', balanceBefore: 100_000,
    });
    assertEq(r.balanceAfter, 100_000 - 50 + r.totalWin, `round ${i}`);
  }
});

test('bonus spin bahis çekmez: balanceAfter = before + win', () => {
  const r = simulateSpin({
    config: CFG, seed: 'bonus-settle', betAmount: 100,
    roundId: 'rb', sessionId: 's', balanceBefore: 5_000,
    isBonusSpin: true, remainingBonusSpins: 5,
  });
  assertEq(r.balanceAfter, 5_000 + r.totalWin, 'bonus spin debit olmamalı');
  assert(r.remainingBonusSpins >= 4, 'kalan spin en az 4 (retrigger hariç düşer)');
});

test('persistent multiplier bonus boyunca artar, base oyunda 0 kalır', () => {
  const base = simulateSpin({
    config: CFG, seed: 'pm-base', betAmount: 100,
    roundId: 'r', sessionId: 's', balanceBefore: 10_000,
    persistentMultiplier: 50,
  });
  assertEq(base.persistentMultiplierBefore, 0, 'base oyunda persistent yok');
  let found = false;
  for (let i = 0; i < 400 && !found; i += 1) {
    const r = simulateSpin({
      config: CFG, seed: `pm-${i}`, betAmount: 100,
      roundId: 'r', sessionId: 's', balanceBefore: 10_000,
      isBonusSpin: true, remainingBonusSpins: 3, persistentMultiplier: 10,
    });
    assertEq(r.persistentMultiplierBefore, 10, 'girişteki persistent korunur');
    assert(r.persistentMultiplierAfter >= 10, 'persistent azalamaz');
    if (r.persistentMultiplierAfter > 10) found = true;
  }
  assert(found, '400 bonus spinde en az bir persistent artışı beklenirdi');
});

test('max payout guard: totalWin ≤ bet × maxPayoutMult', () => {
  for (let i = 0; i < 500; i += 1) {
    const r = simulateSpin({
      config: CFG, seed: `guard-${i}`, betAmount: 10,
      roundId: 'r', sessionId: 's', balanceBefore: 1_000_000,
    });
    assert(r.totalWin <= 10 * CFG.maxPayoutMult, `guard aşıldı: ${r.totalWin}`);
    assert(r.cascades.length <= CFG.maxCascades, 'maxCascades aşıldı');
  }
});

test('win tier eşikleri config ile uyumlu', () => {
  assertEq(resolveWinTier(CFG, 0, 100), 'NONE', 'kazanç yok');
  assertEq(resolveWinTier(CFG, 100 * CFG.winTiers.storm, 100), 'STORM', 'storm');
  assertEq(resolveWinTier(CFG, 100 * CFG.winTiers.thunder, 100), 'THUNDER', 'thunder');
  assertEq(resolveWinTier(CFG, 100 * CFG.winTiers.cosmic, 100), 'COSMIC', 'cosmic');
  assertEq(resolveWinTier(CFG, 100 * CFG.winTiers.divine, 100), 'DIVINE', 'divine');
});

test('clampBet min/max sınırlarını uygular', () => {
  assertEq(clampBet(CFG, 1), CFG.minBet, 'min altı');
  assertEq(clampBet(CFG, 999_999), CFG.maxBet, 'max üstü');
  assertEq(clampBet(CFG, 100), 100, 'aralık içi');
});

test('oto tur bakiyenin yettiği kadar kısalır', () => {
  assertEq(maxAffordableAutoplayTours(150, 10), 15, '150/10');
  assertEq(maxAffordableAutoplayTours(9, 10), 0, 'yetersiz');
  assertEq(clampAutoplayTours(500, 15), 15, '500 -> 15');
  assertEq(clampAutoplayTours(10, 15), 10, 'karşılanabilir');
  assertEq(clampAutoplayTours(500, 0), 0, 'coin yok');
});

test('bonus tetiklenirse remainingBonusSpins = freeSpins', () => {
  let seen = false;
  for (let i = 0; i < 3_000 && !seen; i += 1) {
    const r = simulateSpin({
      config: CFG, seed: `bt-${i}`, betAmount: 20,
      roundId: 'r', sessionId: 's', balanceBefore: 100_000,
    });
    if (r.bonusTriggered) {
      seen = true;
      assert(r.bonus !== null, 'bonus payload');
      assertEq(r.remainingBonusSpins, r.bonus!.freeSpins, 'free spin sayısı');
      assert(r.scatterCount >= 4, 'en az 4 scatter');
    }
  }
  assert(seen, '3000 spinde hiç bonus çıkmadı — scatter şansı bozuk olabilir');
});

test('idempotency/replay: aynı girdiler bayt-aynı settlement payload üretir', () => {
  // Server settle RPC idempotency_key unique kısıtına dayanır; burada replay
  // güvenliğini doğruluyoruz: aynı seed + round aynı JSON'u üretmeli ki
  // tekrar denemede farklı ödeme oluşmasın.
  const input = {
    config: CFG, seed: 'idem-1', betAmount: 100,
    roundId: 'round-x', sessionId: 'sess-x', balanceBefore: 10_000,
  } as const;
  const p1 = JSON.stringify(simulateSpin({ ...input }));
  const p2 = JSON.stringify(simulateSpin({ ...input }));
  assertEq(p1, p2, 'replay payload birebir aynı olmalı');
});

console.log('');
console.log(`Sonuç: ${passed} geçti, ${failed} kaldı`);
if (failed > 0) {
  console.error('Kalanlar:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

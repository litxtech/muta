/**
 * Developer simülatör — 100k / 1M round rapor.
 * Çalıştır: npx --yes tsx scripts/kaskad-simulator.ts [rounds]
 */

import {
  DEFAULT_MATH_CONFIG,
} from '../src/moduller/oyunlar/kaskad/sabitler/KaskadSabitleri';
import { runBatchSimulation } from '../src/moduller/oyunlar/kaskad/motor/SpinSimulator';
import { detectMatches } from '../src/moduller/oyunlar/kaskad/matches/MatchDetector';
import { createSeededRng } from '../src/moduller/oyunlar/kaskad/rng/SeededRng';
import { generateGrid } from '../src/moduller/oyunlar/kaskad/grid/GridGenerator';
import { evaluateScatterBonus } from '../src/moduller/oyunlar/kaskad/scatter/ScatterEngine';
import { sumMultipliers } from '../src/moduller/oyunlar/kaskad/multipliers/MultiplierEngine';

const rounds = Number(process.argv[2] ?? 100_000);
const bet = 100;

console.log(`Kozmik Kaskad sim — ${rounds.toLocaleString()} round @ ${bet}`);

// Unit smoke
const rng = createSeededRng('unit-seed');
const grid = generateGrid(DEFAULT_MATH_CONFIG, rng);
const matches = detectMatches(grid, DEFAULT_MATH_CONFIG, bet);
console.log('smoke.gridCells', grid.length * (grid[0]?.length ?? 0));
console.log('smoke.matches', matches.length);
console.log('smoke.scatter', evaluateScatterBonus(grid, DEFAULT_MATH_CONFIG));
console.log('smoke.multSum', sumMultipliers([5, 10, 25]));

const report = runBatchSimulation(DEFAULT_MATH_CONFIG, rounds, bet, 'batch');
console.log(JSON.stringify(report, null, 2));

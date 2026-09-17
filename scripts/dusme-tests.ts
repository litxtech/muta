/**
 * Cascade dusme istif testleri.
 * Calistir: npx --yes tsx scripts/dusme-tests.ts
 */

import { dropDistancesBetween } from '../src/moduller/oyunlar/ortak/grid/DusmeMesafeleri';

let failed = 0;
function assertEq(actual: unknown, expected: unknown, msg: string): void {
  if (actual !== expected) {
    failed += 1;
    console.error(`  x ${msg} (beklenen ${String(expected)}, gelen ${String(actual)})`);
  } else {
    console.log(`  ok ${msg}`);
  }
}

const bos = (id: string) => id.startsWith('__empty');
type Mini = { instanceId: string; row: number; column: number };
const cell = (id: string, row: number): Mini => ({ instanceId: id, row, column: 0 });
const empty = (row: number): Mini => ({
  instanceId: `__empty_r${row}c0`,
  row,
  column: 0,
});
const col = (cells: Mini[]): Mini[][] => cells.map((c) => [c]);

console.log('-- Cascade dusme istif --');

{
  const before = col([
    cell('A', 0),
    cell('B', 1),
    empty(2),
    cell('D', 3),
    cell('E', 4),
  ]);
  const after = col([
    cell('N', 0),
    cell('A', 1),
    cell('B', 2),
    cell('D', 3),
    cell('E', 4),
  ]);
  const d = dropDistancesBetween(before, after, bos);
  assertEq(d.A, 1, 'orta patlama: A 1 duser');
  assertEq(d.B, 1, 'orta patlama: B 1 duser');
  assertEq(d.N, 1, 'orta patlama: yeni tas ayni mesafede yapisik');
  assertEq(d.D, undefined, 'orta patlama: D yerinde');
}

{
  const before = col([
    empty(0),
    cell('B', 1),
    empty(2),
    cell('D', 3),
    cell('E', 4),
  ]);
  const after = col([
    cell('N0', 0),
    cell('N1', 1),
    cell('B', 2),
    cell('D', 3),
    cell('E', 4),
  ]);
  const d = dropDistancesBetween(before, after, bos);
  assertEq(d.B, 1, 'ust+orta: B 1 duser');
  assertEq(d.N0, 1, 'ust+orta: N0 B ile ayni mesafe');
  assertEq(d.N1, 1, 'ust+orta: N1 B ile ayni mesafe');
}

{
  const before = col([empty(0), empty(1), empty(2), empty(3), empty(4)]);
  const after = col([
    cell('N0', 0),
    cell('N1', 1),
    cell('N2', 2),
    cell('N3', 3),
    cell('N4', 4),
  ]);
  const d = dropDistancesBetween(before, after, bos);
  assertEq(d.N0, 5, 'tam sutun: N0 5');
  assertEq(d.N4, 5, 'tam sutun: N4 ayni istif');
}

{
  const before = col([
    empty(0),
    empty(1),
    cell('C', 2),
    cell('D', 3),
    cell('E', 4),
  ]);
  const after = col([
    cell('N0', 0),
    cell('N1', 1),
    cell('C', 2),
    cell('D', 3),
    cell('E', 4),
  ]);
  const d = dropDistancesBetween(before, after, bos);
  assertEq(d.C, undefined, 'ust patlama: C yerinde');
  assertEq(d.N0, 2, 'ust patlama: yeni taslar tunelden 2');
  assertEq(d.N1, 2, 'ust patlama: N1 ayni');
}

if (failed > 0) {
  console.error(`Kalan: ${failed}`);
  process.exit(1);
}
console.log('Tumu gecti');

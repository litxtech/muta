import type { TakipIliskiDurumu } from './TakipTipleri';

/** Mesaj servisi follow mantigini kopyalamasin; bu tek kaynak. */
export function TakipIliskiMesajIzinVerirMi(
  state: TakipIliskiDurumu,
  kural: 'herkes' | 'takipcilerim' | 'karsilikli' | 'hickimse',
): boolean {
  if (kural === 'hickimse') return false;
  if (kural === 'herkes') {
    return state !== 'BLOCKED' && state !== 'BLOCKED_BY_USER';
  }
  if (kural === 'takipcilerim') {
    return (
      state === 'FOLLOWS_YOU' ||
      state === 'MUTUAL' ||
      state === 'FOLLOWING' ||
      state === 'SELF'
    );
  }
  return state === 'MUTUAL' || state === 'SELF';
}

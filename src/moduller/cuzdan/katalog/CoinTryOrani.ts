/**
 * Coin / elmas katalog oranı.
 * Canlı değer: `platform_economy_config` (EkonomiOranlariniGetir).
 * Fallback: 0,10 ₺ — ağ yokken / ilk render.
 */
import { EkonomiOranCacheOku } from './EkonomiOranlariniGetir';

/** @deprecated Canlı oran için EkonomiOranCacheOku().coin_try kullan */
export const COIN_TRY_ORANI = 0.1;

export function CoinTryOraniCanli(): number {
  return EkonomiOranCacheOku().coin_try;
}

export function DiamondTryOraniCanli(): number {
  return EkonomiOranCacheOku().diamond_try;
}

export function CoinTryKarsiligi(coins: number): number {
  const n = Number(coins);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * CoinTryOraniCanli() * 100) / 100;
}

export function ElmasTryKarsiligi(diamonds: number): number {
  const n = Number(diamonds);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * DiamondTryOraniCanli() * 100) / 100;
}

export function TryYazi(tutar: number): string {
  return `${tutar.toLocaleString('tr-TR', {
    minimumFractionDigits: tutar % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

/**
 * Coin paket TL fiyatı — UI bileşeninden ayrı (hook'lar React modülü import etmesin).
 */
import type { CoinPackage } from '../../../types/models';

export function PaketFiyatTry(pkg: CoinPackage): number {
  if (pkg.price_try != null && Number(pkg.price_try) > 0) {
    return Number(pkg.price_try);
  }
  return Math.round(Number(pkg.price_usd) * 35);
}

import type { CoinPackage } from '../../../types/models';
import { TumPaketHesaplari } from './CoinPaketHesap';

/**
 * Offline / migration öncesi — yalnızca aktif varsayılan pack 1–4.
 * Product ID = sku = tamuso_coin_pack_N
 */
export const COIN_PAKET_FALLBACK: CoinPackage[] = TumPaketHesaplari().map(
  (p, i) => ({
    id: String(i + 1),
    sku: p.sku,
    title: p.title,
    coins: p.coins,
    bonus_coins: p.bonusCoins,
    price_usd: p.priceUsd,
    price_try: p.priceTry,
    badge: p.badge,
    apple_product_id: p.sku,
    google_product_id: p.sku,
  }),
);

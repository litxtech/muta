import type { CoinPackage } from '../../../types/models';
import { TumPaketHesaplari } from './CoinPaketHesap';

/**
 * Offline / migration oncesi — CoinPaketHesap modeli ile üretilir.
 * 1 coin = 0,10 ₺ + kademeli bonus.
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
    apple_product_id: `com.litxtech.muta.${p.sku}`,
    google_product_id: `com.litxtech.muta.${p.sku}`,
  }),
);

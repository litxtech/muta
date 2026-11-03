import { supabase } from '../../../lib/supabase';
import type { CoinPackage } from '../../../types/models';
import { KatalogCache } from '../../../ortak/onbellek/KatalogCache';
import {
  CoinPaketKatalogunuHazirla,
  CoinPaketKatalogunuKaydet,
} from '../katalog/CoinPaketOnbellegi';

const COIN_PAKET_SELECT = [
  'id',
  'sku',
  'title',
  'coins',
  'bonus_coins',
  'price_usd',
  'price_try',
  'badge',
  'campaign_text',
  'sort_order',
  'apple_product_id',
  'google_product_id',
  'stripe_price_id',
].join(', ');

const ANAHTAR = 'coin_packages:active';

/** Tek uçuş: aynı anda birden çok arka plan tazeleme başlamasın. */
let arkaPlanTazeleme: Promise<void> | null = null;

async function sunucudanGetir(): Promise<CoinPackage[]> {
  const { data, error } = await supabase
    .from('coin_packages')
    .select(COIN_PAKET_SELECT)
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data as unknown as CoinPackage[]) ?? [];
}

/**
 * Katalog: bellek (2 dk) → disk (7 gün) → sunucu.
 * Disk verisi varsa beklemeden döner, ağ tazelemesi arka planda yapılır.
 */
export async function CoinPaketleriniGetir(): Promise<CoinPackage[]> {
  const bellekte = KatalogCache.get<CoinPackage[]>(ANAHTAR);
  if (bellekte && bellekte.length > 0) return bellekte;

  const diskten = await CoinPaketKatalogunuHazirla();
  if (disktonVarMi(diskten)) {
    KatalogCache.set(ANAHTAR, diskten);
    if (!arkaPlanTazeleme) {
      arkaPlanTazeleme = (async () => {
        try {
          const taze = await sunucudanGetir();
          if (!taze.length) return;
          KatalogCache.set(ANAHTAR, taze);
          CoinPaketKatalogunuKaydet(taze);
        } catch {
          /* disk verisi yeterli */
        } finally {
          arkaPlanTazeleme = null;
        }
      })();
    }
    return diskten;
  }

  return KatalogCache.getOrFetch(ANAHTAR, async () => {
    const taze = await sunucudanGetir();
    if (taze.length) CoinPaketKatalogunuKaydet(taze);
    return taze;
  });
}

function disktonVarMi(
  liste: CoinPackage[] | null,
): liste is CoinPackage[] {
  return Array.isArray(liste) && liste.length > 0;
}

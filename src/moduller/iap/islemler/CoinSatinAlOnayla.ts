import { supabase } from '../../../lib/supabase';
import { FinansIdempotencyAnahtariOlustur } from '../../cuzdan/islemler/FinansIdempotencyAnahtariOlustur';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import type { IapMagaza } from '../dogrulama/IapReceiptDogrulamaIstegiHazirla';
import { IapReceiptEdgeIleDogrula } from '../dogrulama/IapReceiptEdgeIleDogrula';

export type CoinSatinAlSonuc =
  | { ok: true; coinsAdded: number }
  | { ok: false; hata: string; kod?: 'kill_switch' | 'rpc' | 'edge' };

/**
 * Sunucu onayı.
 * - `manual` (yalnızca __DEV__ fallback): Edge'e GİTMEZ — mağaza makbuzu yok.
 *   Doğrudan `coin_satin_al_onayla` RPC'si kullanılır (guest/kill-switch kontrolleri RPC'de).
 *   Önceden Edge'e `store: "manual"` gönderiliyordu; Edge ürünü google_product_id
 *   ile aradığı için her denemede 404 "Package not found" dönüyordu.
 * - Apple/Google: makbuz Edge Function'da doğrulanır.
 */
export async function CoinSatinAlOnayla(input: {
  packageId: string;
  providerTxId?: string;
  store?: IapMagaza | 'manual';
  amountUsd?: number;
  idempotencyKey?: string;
  receiptData?: string;
}): Promise<CoinSatinAlSonuc> {
  if (await KillSwitchAktifMiSunucu('kill_coin_purchase')) {
    return {
      ok: false,
      hata: 'Coin satin alma gecici olarak kapali.',
      kod: 'kill_switch',
    };
  }

  const key =
    input.idempotencyKey ?? FinansIdempotencyAnahtariOlustur('coin_purchase');
  const store = input.store ?? 'manual';

  if (store !== 'manual' && process.env.EXPO_PUBLIC_IAP_VERIFY_URL) {
    const edge = await IapReceiptEdgeIleDogrula({
      store,
      productId: input.packageId,
      packageId: input.packageId,
      transactionId: input.providerTxId ?? `${store}_${key}`,
      receiptData: input.receiptData ?? `${store}_dev`,
      idempotencyKey: key,
      amountUsd: input.amountUsd,
      sandbox: true,
      edgeStore: store,
    });
    if (edge) {
      if (!edge.ok) return { ok: false, hata: edge.hata, kod: 'edge' };
      return { ok: true, coinsAdded: edge.coinsAdded };
    }
  }

  const { data, error } = await supabase.rpc('coin_satin_al_onayla', {
    p_package_id: input.packageId,
    p_idempotency_key: key,
    p_provider: store,
    p_provider_tx_id: input.providerTxId ?? `manual_${key}`,
    p_store: store,
    p_amount_usd: input.amountUsd ?? null,
    p_receipt: { source: 'client_dev', note: 'Development manual credit' },
  });

  if (error) return { ok: false, hata: error.message, kod: 'rpc' };
  const coins = (data as { coins_added?: number } | null)?.coins_added ?? 0;
  return { ok: true, coinsAdded: coins };
}

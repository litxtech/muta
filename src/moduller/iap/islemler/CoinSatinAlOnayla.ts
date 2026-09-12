import { supabase } from '../../../lib/supabase';
import { FinansIdempotencyAnahtariOlustur } from '../../cuzdan/islemler/FinansIdempotencyAnahtariOlustur';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import type { IapMagaza } from '../dogrulama/IapReceiptDogrulamaIstegiHazirla';

export type CoinSatinAlSonuc =
  | { ok: true; coinsAdded: number }
  | { ok: false; hata: string; kod?: 'kill_switch' | 'rpc' };

/**
 * Gelistirme / sandbox: paket ID ile coin yukleme (idempotent).
 * Production: once Edge Function receipt verify, sonra bu RPC.
 */
export async function CoinSatinAlOnayla(input: {
  packageId: string;
  providerTxId?: string;
  store?: IapMagaza | 'manual';
  amountUsd?: number;
  idempotencyKey?: string;
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

  const { data, error } = await supabase.rpc('coin_satin_al_onayla', {
    p_package_id: input.packageId,
    p_idempotency_key: key,
    p_provider: input.store ?? 'manual',
    p_provider_tx_id: input.providerTxId ?? `manual_${key}`,
    p_store: input.store ?? 'manual',
    p_amount_usd: input.amountUsd ?? null,
    p_receipt: { source: 'client_dev', note: 'Replace with Edge Function verify' },
  });

  if (error) return { ok: false, hata: error.message, kod: 'rpc' };
  const coins = (data as { coins_added?: number } | null)?.coins_added ?? 0;
  return { ok: true, coinsAdded: coins };
}

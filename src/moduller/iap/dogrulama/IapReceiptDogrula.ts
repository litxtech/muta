import { supabase } from '../../../lib/supabase';
import type { IapMagaza } from './IapReceiptDogrulamaIstegiHazirla';

/**
 * Edge Function: iap-receipt-verify
 * Mobilde Apple/Google secret yok.
 */
export async function IapReceiptDogrula(input: {
  packageId: string;
  store: IapMagaza;
  productId: string;
  transactionId?: string;
  purchaseToken?: string;
  idempotencyKey: string;
}): Promise<{ ok: true; coinsAdded: number } | { ok: false; hata: string }> {
  const base =
    process.env.EXPO_PUBLIC_IAP_VERIFY_URL ??
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/iap-receipt-verify`;

  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) return { ok: false, hata: 'Oturum gerekli' };

  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        packageId: input.packageId,
        store: input.store,
        productId: input.productId,
        transactionId: input.transactionId,
        purchaseToken: input.purchaseToken,
        idempotencyKey: input.idempotencyKey,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      coinsAdded?: number;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return { ok: false, hata: json.error ?? `Verify ${res.status}` };
    }
    return { ok: true, coinsAdded: json.coinsAdded ?? 0 };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : 'Verify network error' };
  }
}

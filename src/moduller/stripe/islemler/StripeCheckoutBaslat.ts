import { supabase } from '../../../lib/supabase';
import { FinansIdempotencyAnahtariOlustur } from '../../cuzdan/islemler/FinansIdempotencyAnahtariOlustur';

/**
 * Stripe Checkout oturumu (web / izinli kanallar).
 * iOS App Store dijital coin satisi icin KULLANILMAZ.
 */
export async function StripeCheckoutBaslat(input: {
  packageId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ ok: true; url: string; sessionId: string } | { ok: false; hata: string }> {
  const base =
    process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_URL ??
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-checkout`;

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
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        idempotencyKey: FinansIdempotencyAnahtariOlustur('coin_purchase'),
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      url?: string;
      sessionId?: string;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.url || !json.sessionId) {
      return { ok: false, hata: json.error ?? `Stripe ${res.status}` };
    }
    return { ok: true, url: json.url, sessionId: json.sessionId };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : 'Stripe network error' };
  }
}

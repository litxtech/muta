/**
 * Stripe modülü — Checkout + uygulama içi PaymentSheet.
 * Secret key ASLA istemcide tutulmaz; yalnız Edge Function env.
 */

export type StripePublicSozlesmesi = {
  checkoutBaslat: (input: {
    packageId?: string;
    productId?: string;
    catalog?: 'coin' | 'ai_music';
  }) => Promise<{ ok: boolean; url?: string; hata?: string }>;
  paymentSheetBaslat: (input: {
    packageId?: string;
    productId?: string;
    catalog?: 'coin' | 'ai_music';
  }) => Promise<{ ok: boolean; hata?: string }>;
};

export const STRIPE_MODUL_ADI = 'stripe' as const;

/** İstemci publishable key (pk_…). */
export function StripePublishableKey(): string | null {
  const k = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return k && k.startsWith('pk_') ? k : null;
}

export function StripeOdemeSheetHazirMi(): boolean {
  return !!StripePublishableKey();
}

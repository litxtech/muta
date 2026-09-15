export type StripePublicSozlesmesi = {
  checkoutBaslat: (packageId: string) => Promise<{ ok: boolean; url?: string; hata?: string }>;
};

export const STRIPE_MODUL_ADI = 'stripe' as const;

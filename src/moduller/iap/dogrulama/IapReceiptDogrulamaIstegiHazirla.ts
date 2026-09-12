/**
 * StoreKit / Play Billing receipt dogrulama sozlesmesi.
 * Gercek verify Edge Function'da (service_role + Apple/Google API).
 * Mobil receipt'i sunucuya gonderir; fiyati client belirlemez.
 */
export type IapMagaza = 'apple' | 'google';

export type IapReceiptDogrulamaIstek = {
  store: IapMagaza;
  productId: string;
  packageId: string;
  transactionId: string;
  receiptData: string;
  idempotencyKey: string;
};

export type IapReceiptDogrulamaSonuc =
  | { ok: true; coinsAdded: number }
  | { ok: false; hata: string };

/**
 * FAZ 3: Edge Function yokken gelistirme yolu — dogrudan RPC (manual).
 * Production'da bu dosya sadece Edge Function URL cagirir.
 */
export async function IapReceiptDogrulamaIstegiHazirla(
  input: IapReceiptDogrulamaIstek,
): Promise<IapReceiptDogrulamaIstek> {
  return input;
}

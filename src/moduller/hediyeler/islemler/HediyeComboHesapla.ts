/** Combo secenekleri — timeout admin/config (gift.combo_timeout_ms) */
export const HEDIYE_COMBO_SECENEKLERI = [1, 2, 5, 10, 50, 99, 999] as const;

export function HediyeComboToplamMaliyet(birimFiyat: number, adet: number): number {
  return birimFiyat * adet;
}

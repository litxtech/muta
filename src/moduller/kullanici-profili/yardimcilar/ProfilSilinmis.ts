/** Silinmiş hesap görünen adı (platform tombstone). */
export const HESAP_SILINDI_ADI = 'Hesap silindi';

export function ProfilSilinmisMi(p: {
  deleted_at?: string | null;
  display_name?: string | null;
} | null | undefined): boolean {
  if (!p) return false;
  if (p.deleted_at) return true;
  const ad = p.display_name?.trim().toLocaleLowerCase('tr-TR') ?? '';
  return ad === 'hesap silindi' || ad === 'silinmiş hesap' || ad === 'silinmis hesap';
}

export function ProfilGorunenAd(
  p: {
    deleted_at?: string | null;
    display_name?: string | null;
    username?: string | null;
  } | null | undefined,
  yedek = 'Kullanıcı',
): string {
  if (ProfilSilinmisMi(p)) return HESAP_SILINDI_ADI;
  return p?.display_name?.trim() || p?.username?.trim() || yedek;
}

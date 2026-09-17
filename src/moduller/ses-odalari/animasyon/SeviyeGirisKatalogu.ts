/**
 * Seviyeye göre odaya giriş animasyon eşikleri.
 * 10+ kullanıcı odaya girince herkese gösterilir.
 */

export type SeviyeGirisKademe = 'bronz' | 'gumus' | 'altin' | 'efsane';

export type SeviyeGirisOgesi = {
  userId: string;
  ad: string;
  avatarUrl?: string | null;
  level: number;
  kademe: SeviyeGirisKademe;
};

/** Giriş animasyonu için minimum seviye */
export const SEVIYE_GIRIS_ESIGI = 10;

export function SeviyeGirisKademesiniCoz(level: number): SeviyeGirisKademe | null {
  if (!level || level < SEVIYE_GIRIS_ESIGI) return null;
  if (level >= 50) return 'efsane';
  if (level >= 30) return 'altin';
  if (level >= 20) return 'gumus';
  return 'bronz';
}

export function SeviyeGirisEtiketi(kademe: SeviyeGirisKademe): string {
  switch (kademe) {
    case 'efsane':
      return 'EFSANE GİRİŞ';
    case 'altin':
      return 'ALTIN GİRİŞ';
    case 'gumus':
      return 'GÜMÜŞ GİRİŞ';
    default:
      return 'ÖZEL GİRİŞ';
  }
}

export function SeviyeGirisSuresiMs(kademe: SeviyeGirisKademe): number {
  switch (kademe) {
    case 'efsane':
      return 4200;
    case 'altin':
      return 3600;
    case 'gumus':
      return 3000;
    default:
      return 2600;
  }
}

export const SEVIYE_GIRIS_RENKLERI: Record<
  SeviyeGirisKademe,
  readonly [string, string, string]
> = {
  bronz: ['#D4A574', '#A67C52', '#7A5235'],
  gumus: ['#E8EEF8', '#A8B4C8', '#6E7A90'],
  altin: ['#FFE08A', '#F0B429', '#C99214'],
  efsane: ['#FFD76A', '#FF6B9A', '#9B5CFF'],
};

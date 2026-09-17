export type KayitAlanModu = 'required' | 'optional' | 'hidden';

export type YerlesikKayitAlani =
  | 'phone'
  | 'gender'
  | 'birth_date'
  | 'email'
  | 'avatar';

export type KayitOzelAlanTuru = 'text' | 'select' | 'number';

export type KayitOzelAlan = {
  id: string;
  anahtar: string;
  etiket: string;
  alan_turu: KayitOzelAlanTuru;
  secenekler: string[];
  mod: 'required' | 'optional';
  sira: number;
  aktif?: boolean;
  created_at?: string;
};

export type KayitAlanAyarlari = {
  alanlar: Record<YerlesikKayitAlani, KayitAlanModu>;
  ozel_alanlar: KayitOzelAlan[];
  updated_at?: string;
};

export const YERLESIK_KAYIT_ALAN_ETIKETLERI: Record<
  YerlesikKayitAlani,
  string
> = {
  phone: 'Telefon',
  gender: 'Cinsiyet',
  birth_date: 'Doğum tarihi',
  email: 'E-posta',
  avatar: 'Profil fotoğrafı',
};

export const VARSAYILAN_KAYIT_ALANLARI: Record<
  YerlesikKayitAlani,
  KayitAlanModu
> = {
  phone: 'optional',
  gender: 'optional',
  birth_date: 'optional',
  email: 'optional',
  avatar: 'optional',
};

export const VARSAYILAN_KAYIT_ALAN_AYARLARI: KayitAlanAyarlari = {
  alanlar: { ...VARSAYILAN_KAYIT_ALANLARI },
  ozel_alanlar: [],
};

export function KayitAlanModuEtiketi(mod: KayitAlanModu): string {
  if (mod === 'required') return 'Zorunlu';
  if (mod === 'hidden') return 'Gizli';
  return 'İsteğe bağlı';
}

export function AlanGorunurMu(mod: KayitAlanModu): boolean {
  return mod !== 'hidden';
}

export function AlanZorunluMu(mod: KayitAlanModu): boolean {
  return mod === 'required';
}

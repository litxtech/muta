export type GirisLobisiMedyaTur = 'video' | 'image';

export type GirisLobisiMedya = {
  id: string;
  tur: GirisLobisiMedyaTur;
  public_url: string;
  storage_path?: string | null;
  mime_type?: string | null;
  aktif?: boolean;
  sira?: number;
  created_at?: string;
};

export type GirisLobisiAyar = {
  logo_goster: boolean;
  logo_url: string | null;
  logo_harf: string;
  marka_goster: boolean;
  marka_adi: string | null;
  slogan_goster: boolean;
  slogan: string | null;
  form_baslik: string;
  form_alt: string | null;
  ust_metin: string | null;
  updated_at?: string;
};

export type GirisLobisiPublic = {
  ayar: GirisLobisiAyar;
  medya: GirisLobisiMedya[];
};

export const GIRIS_LOBISI_BUCKET = 'giris-lobisi-media';

export const VARSAYILAN_GIRIS_LOBISI_AYAR: GirisLobisiAyar = {
  logo_goster: false,
  logo_url: null,
  logo_harf: 'M',
  marka_goster: false,
  marka_adi: null,
  slogan_goster: false,
  slogan: null,
  form_baslik: 'Giriş',
  form_alt: null,
  ust_metin: null,
};

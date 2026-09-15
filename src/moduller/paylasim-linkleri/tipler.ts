export type PaylasimPlatform =
  | 'ios'
  | 'android'
  | 'web'
  | 'universal'
  | 'other';

export type AppPaylasimLinki = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  platform: PaylasimPlatform;
  url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type KullaniciDavetKodu = {
  user_id: string;
  code: string;
  click_count: number;
  install_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaylasimLinkGirdi = {
  code: string;
  title: string;
  description?: string | null;
  platform: PaylasimPlatform;
  url: string;
  is_active?: boolean;
  sort_order?: number;
};

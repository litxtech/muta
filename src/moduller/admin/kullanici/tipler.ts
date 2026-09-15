export type AdminKullaniciOzet = {
  id: string;
  username: string | null;
  display_name: string | null;
  public_user_id: string | null;
  phone_e164: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_guest: boolean;
  is_host: boolean;
  is_sample?: boolean;
  banned_at: string | null;
  deleted_at: string | null;
  created_at: string;
  coins: number;
  diamonds: number;
  warning_count: number;
  platform: string | null;
};

export type AdminKullaniciDosyasi = {
  ok: boolean;
  hata?: string;
  profil: {
    id: string;
    username: string | null;
    display_name: string | null;
    public_user_id: string | null;
    phone_e164: string | null;
    avatar_url: string | null;
    bio: string | null;
    country: string | null;
    language: string | null;
    is_admin: boolean;
    is_guest: boolean;
    is_host: boolean;
    is_verified: boolean;
    level: number;
    xp: number;
    created_at: string;
    banned_at: string | null;
    ban_reason: string | null;
    deleted_at: string | null;
  };
  cuzdan: { coins: number; diamonds: number };
  yukleme: {
    toplam_coin: number;
    adet: number;
    ilk: {
      id: string;
      tarih: string;
      coin: number;
      tutar_usd: number | null;
      provider: string | null;
      store: string | null;
      kaynak: string;
    } | null;
  };
  hediye: {
    gonderilen_adet: number;
    gonderilen_coin: number;
    alinan_adet: number;
    alinan_elmas: number;
  };
  oturum: {
    tahmini_aktif_saniye: number;
    tahmini_aktif_metin: string;
    platformlar: string;
    cihazlar: {
      device_id: string;
      platform: string | null;
      model: string | null;
      app_version: string | null;
      olusturma: string;
      son_gorulme: string;
      iptal: boolean;
      sure_metin: string;
    }[];
  };
  ihtar: {
    aktif_adet: number;
    liste: {
      id: string;
      reason: string;
      severity: string;
      notes: string | null;
      is_active: boolean;
      created_at: string;
      issued_by: string | null;
    }[];
  };
  risk: {
    skor: number;
    seviye: string;
    iade_riski_var: boolean;
    notlar: string[];
    acik_rapor: number;
    iade_adet: number;
    bekleyen_cekim_elmas: number;
  };
  hareketler: {
    id: string;
    currency: string;
    delta: number;
    balance_after: number;
    reason: string;
    ref_type: string | null;
    created_at: string;
  }[];
  hediye_akis: {
    id: string;
    yon: 'gonderilen' | 'alinan';
    karsi_id: string;
    karsi_ad: string;
    coins_spent: number;
    diamonds_earned: number;
    quantity: number;
    created_at: string;
  }[];
  guvenlik_olaylari: {
    id: string;
    event_type: string;
    severity: string;
    risk_score: number;
    status: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }[];
  admin_loglari: {
    id: string;
    action: string;
    summary: string;
    details: Record<string, unknown>;
    admin_id: string | null;
    created_at: string;
  }[];
  yuklemeler: {
    id: string;
    tarih: string;
    coin: number;
    tutar_usd: number | null;
    store: string | null;
    provider: string | null;
    status: string | null;
  }[];
};

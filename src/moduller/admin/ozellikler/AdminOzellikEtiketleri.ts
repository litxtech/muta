/** Admin özellikler ekranı: anahtar → Türkçe başlık + kısa açıklama */

export type AdminOzellikMetni = {
  baslik: string;
  aciklama: string;
};

const OZELLIK_METINLERI: Record<string, AdminOzellikMetni> = {
  voice_rooms_enabled: {
    baslik: 'Ses odaları',
    aciklama: 'Kullanıcıların sesli sohbet odalarına girip çıkmasını açar veya kapatır.',
  },
  live_enabled: {
    baslik: 'Canlı yayın',
    aciklama: 'Canlı yayın başlatma ve izleme özelliklerini kontrol eder.',
  },
  video_enabled: {
    baslik: 'Video',
    aciklama: 'Görüntülü yayın / video özelliklerini açar veya kapatır.',
  },
  gifts_enabled: {
    baslik: 'Hediyeler',
    aciklama: 'Oda ve yayında hediye gönderme özelliğini kontrol eder.',
  },
  pk_enabled: {
    baslik: 'PK / düello',
    aciklama: 'Canlı yayın PK (karşılaşma) özelliklerini açar veya kapatır.',
  },
  agency_enabled: {
    baslik: 'Ajanslar',
    aciklama: 'Ajans ve host yönetimi özelliklerini kontrol eder.',
  },
  withdrawals_enabled: {
    baslik: 'Para çekimi',
    aciklama: 'Elmas / kazanç çekim taleplerini açar veya kapatır.',
  },
  city_league_enabled: {
    baslik: 'Şehir ligi',
    aciklama: 'Şehir ligi ve sıralama özelliklerini kontrol eder.',
  },
  city_battles_enabled: {
    baslik: 'Şehir savaşları',
    aciklama: 'Şehirler arası savaş / skor yarışını açar veya kapatır.',
  },
  city_elections_enabled: {
    baslik: 'Şehir seçimleri',
    aciklama: 'Şehir temsilcisi seçim özelliklerini kontrol eder.',
  },
  messages_enabled: {
    baslik: 'Mesajlaşma',
    aciklama: 'Özel mesaj gönderme ve sohbet özelliklerini açar veya kapatır.',
  },
  events_enabled: {
    baslik: 'Etkinlikler',
    aciklama: 'Platform etkinliklerini kullanıcılara gösterir veya gizler.',
  },
  missions_enabled: {
    baslik: 'Görevler',
    aciklama: 'Günlük / dönemsel görev sistemini açar veya kapatır.',
  },
  announcements_enabled: {
    baslik: 'Duyurular',
    aciklama: 'Uygulama içi duyuru gösterimini kontrol eder.',
  },
  auto_promo_banners_enabled: {
    baslik: 'Otomatik promo bannerlar',
    aciklama:
      'Admin kampanyası yokken feed’de otomatik oda, canlı ve oyun tanıtım şeritlerini gösterir.',
  },
  auto_event_banners_enabled: {
    baslik: 'Olay otomatik bannerlar',
    aciklama:
      'Coin eşiği, koltuk dolu ve oyun harcamasında oluşan bannerlar. Admin panelinden eşikler ve TTL yönetilir.',
  },
  policies_enabled: {
    baslik: 'Politikalar',
    aciklama: 'Kullanım şartları ve onay (consent) ekranlarını kontrol eder.',
  },
  moderation_enabled: {
    baslik: 'Moderasyon',
    aciklama: 'Oda / içerik moderasyon araçlarını açar veya kapatır.',
  },
  analytics_enabled: {
    baslik: 'Analitik',
    aciklama: 'Kullanım istatistiklerinin kaydını açar veya kapatır.',
  },
  certification_hub_enabled: {
    baslik: 'Sertifikasyon merkezi',
    aciklama: 'Mağaza sertifikasyon / sağlık kontrol ekranını gösterir.',
  },
  low_end_mode_enabled: {
    baslik: 'Düşük cihaz modu',
    aciklama: 'Zayıf telefonlarda performans için sadeleştirilmiş modu açar.',
  },
  graceful_degradation_enabled: {
    baslik: 'Yumuşak düşüş',
    aciklama: 'Ağ zayıfken bazı özellikleri otomatik sadeleştirir.',
  },
  stress_tools_enabled: {
    baslik: 'Stres test araçları',
    aciklama: 'Geliştirici / test için canlı ve hediye yük araçlarını açar.',
  },
  iap_enabled: {
    baslik: 'Uygulama içi satın alma',
    aciklama: 'App Store / Play Store üzerinden coin paket satışını kontrol eder.',
  },
  stripe_enabled: {
    baslik: 'Stripe ödemesi',
    aciklama: 'Web / izinli kanallarda Stripe ile ödeme almayı açar veya kapatır.',
  },
  games_enabled: {
    baslik: 'Oyunlar',
    aciklama: 'Tüm oyun platformunu (katalog ve giriş) açar veya kapatır.',
  },
  kozmik_kaskad_enabled: {
    baslik: 'Kozmik Kaskad',
    aciklama: 'Kozmik Kaskad cascade oyununu açar veya kapatır.',
  },
  zeus_enabled: {
    baslik: 'ZEUS',
    aciklama: 'ZEUS Olympus cascade oyununu açar veya kapatır.',
  },
};

const KILL_METINLERI: Record<string, AdminOzellikMetni> = {
  kill_coin_purchase: {
    baslik: 'Coin satın almayı durdur',
    aciklama: 'Acil durumda tüm coin satın alma işlemlerini anında keser.',
  },
  kill_gift_send: {
    baslik: 'Hediye göndermeyi durdur',
    aciklama: 'Acil durumda hediye gönderimini anında keser.',
  },
  kill_withdrawal: {
    baslik: 'Çekim taleplerini durdur',
    aciklama: 'Acil durumda yeni para çekim taleplerini engeller.',
  },
  kill_agency_coin_transfer: {
    baslik: 'Ajans coin transferini durdur',
    aciklama: 'Ajanslar arası / ajans coin aktarımlarını anında keser.',
  },
  kill_live: {
    baslik: 'Canlı yayını durdur',
    aciklama: 'Acil durumda canlı yayınları kapatır / yeni yayını engeller.',
  },
  kill_pk: {
    baslik: 'PK’yi durdur',
    aciklama: 'Acil durumda PK / düello özelliklerini keser.',
  },
  kill_moderation: {
    baslik: 'Moderasyonu durdur',
    aciklama: 'Acil durumda otomatik / oda moderasyon akışını keser.',
  },
  kill_heavy_animations: {
    baslik: 'Ağır animasyonları durdur',
    aciklama: 'Hediye ve ağır görsel efektleri kapatarak cihaz yükünü azaltır.',
  },
  kill_livekit_reconnect: {
    baslik: 'LiveKit yeniden bağlanmayı durdur',
    aciklama: 'Ses / yayın bağlantısının otomatik yeniden denemesini keser.',
  },
  kill_games: {
    baslik: 'Oyunları durdur',
    aciklama: 'Acil durumda tüm oyun girişlerini kapatır.',
  },
  kill_game_coin: {
    baslik: 'Oyun coin harcamasını durdur',
    aciklama: 'Oyunlarda coin giriş / ödül harcamasını anında keser.',
  },
};

const DUYURU_ONCELIK: Record<string, string> = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
  urgent: 'Acil',
};

export function OzellikBayragiMetni(
  key: string,
  dbDescription?: string | null,
): AdminOzellikMetni {
  const sabit = OZELLIK_METINLERI[key];
  if (sabit) return sabit;
  return {
    baslik: key.replace(/_enabled$/i, '').replace(/_/g, ' '),
    aciklama: dbDescription?.trim() || 'Bu özelliğin açılıp kapanmasını kontrol eder.',
  };
}

export function KillSwitchMetni(key: string): AdminOzellikMetni {
  const sabit = KILL_METINLERI[key];
  if (sabit) return sabit;
  return {
    baslik: key.replace(/^kill_/i, '').replace(/_/g, ' '),
    aciklama: 'Acil durumda bu işlemi anında durdurur.',
  };
}

export function DuyuruOncelikEtiketi(priority: string): string {
  return DUYURU_ONCELIK[priority] ?? priority;
}

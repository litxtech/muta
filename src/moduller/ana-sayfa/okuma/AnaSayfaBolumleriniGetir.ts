import { OzellikBayragiAktifMi } from '../../ozellik-bayraklari/OzellikBayragiAktifMi';

export type AnaSayfaBolumKodu =
  | 'live_now'
  | 'voice_rooms'
  | 'trending'
  | 'official_city_rooms'
  | 'city_league'
  | 'events'
  | 'pk_now'
  | 'popular_agencies'
  | 'creators_for_you';

export type AnaSayfaBolum = {
  kod: AnaSayfaBolumKodu;
  baslik: string;
  alt: string;
  aktif: boolean;
};

/** Home dating kartlarindan olusmaz — bolum listesi */
export function AnaSayfaBolumleriniGetir(): AnaSayfaBolum[] {
  return [
    {
      kod: 'live_now',
      baslik: 'Canlı Şimdi',
      alt: 'Şu an yayında',
      aktif: OzellikBayragiAktifMi('live_enabled'),
    },
    {
      kod: 'voice_rooms',
      baslik: 'Ses Odaları',
      alt: 'Mikrofonlu sohbet',
      aktif: OzellikBayragiAktifMi('voice_rooms_enabled'),
    },
    { kod: 'trending', baslik: 'Trend', alt: 'Yükselen odalar', aktif: true },
    {
      kod: 'official_city_rooms',
      baslik: 'Resmi Şehir',
      alt: 'Şehir odaları & destek',
      aktif: OzellikBayragiAktifMi('city_league_enabled'),
    },
    {
      kod: 'city_league',
      baslik: 'Şehir Ligi',
      alt: 'Sezon sıralaması',
      aktif: OzellikBayragiAktifMi('city_league_enabled'),
    },
    {
      kod: 'events',
      baslik: 'Etkinlikler',
      alt: 'Platform etkinlikleri',
      aktif: OzellikBayragiAktifMi('events_enabled'),
    },
    {
      kod: 'pk_now',
      baslik: 'PK arenası',
      alt: 'Canlı düellolar',
      aktif: OzellikBayragiAktifMi('pk_enabled'),
    },
    {
      kod: 'popular_agencies',
      baslik: 'Ajanslar',
      alt: 'Popüler ajanslar',
      aktif: OzellikBayragiAktifMi('agency_enabled'),
    },
    {
      kod: 'creators_for_you',
      baslik: 'Senin İçin',
      alt: 'Önerilen yaratıcılar',
      aktif: true,
    },
  ];
}

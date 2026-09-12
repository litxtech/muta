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
  aktif: boolean;
};

/** Home dating kartlarindan olusmaz — bolum listesi */
export function AnaSayfaBolumleriniGetir(): AnaSayfaBolum[] {
  return [
    { kod: 'live_now', baslik: 'Live Now', aktif: OzellikBayragiAktifMi('live_enabled') },
    { kod: 'voice_rooms', baslik: 'Voice Rooms', aktif: OzellikBayragiAktifMi('voice_rooms_enabled') },
    { kod: 'trending', baslik: 'Trending', aktif: true },
    {
      kod: 'official_city_rooms',
      baslik: 'Official City Rooms',
      aktif: OzellikBayragiAktifMi('city_league_enabled'),
    },
    {
      kod: 'city_league',
      baslik: 'City League',
      aktif: OzellikBayragiAktifMi('city_league_enabled'),
    },
    { kod: 'events', baslik: 'Events', aktif: OzellikBayragiAktifMi('events_enabled') },
    { kod: 'pk_now', baslik: 'PK Now', aktif: OzellikBayragiAktifMi('pk_enabled') },
    {
      kod: 'popular_agencies',
      baslik: 'Popular Agencies',
      aktif: OzellikBayragiAktifMi('agency_enabled'),
    },
    { kod: 'creators_for_you', baslik: 'Creators For You', aktif: true },
  ];
}

export type PushTercihleri = {
  user_id: string;
  all_enabled: boolean;
  messages: boolean;
  gifts: boolean;
  live: boolean;
  rooms: boolean;
  social: boolean;
  wallet: boolean;
  system: boolean;
  updated_at: string;
};

export type PushTercihAnahtari =
  | 'all_enabled'
  | 'messages'
  | 'gifts'
  | 'live'
  | 'rooms'
  | 'social'
  | 'wallet'
  | 'system';

export const PUSH_TERCIH_KATALOGU: {
  key: PushTercihAnahtari;
  baslik: string;
  alt: string;
}[] = [
  {
    key: 'all_enabled',
    baslik: 'Tüm bildirimler',
    alt: 'Kapalıysa hiçbir push gitmez',
  },
  {
    key: 'messages',
    baslik: 'Mesajlar',
    alt: 'Özel mesaj geldiğinde',
  },
  {
    key: 'gifts',
    baslik: 'Hediyeler',
    alt: 'Sana hediye gönderildiğinde',
  },
  {
    key: 'live',
    baslik: 'Canlı yayınlar',
    alt: 'Takip ettiğin biri canlıya geçince',
  },
  {
    key: 'rooms',
    baslik: 'Odalar',
    alt: 'Oda daveti ve oda güncellemeleri',
  },
  {
    key: 'social',
    baslik: 'Sosyal',
    alt: 'Yeni takipçi ve sosyal olaylar',
  },
  {
    key: 'wallet',
    baslik: 'Cüzdan',
    alt: 'Yükleme, çekim ve bakiye',
  },
  {
    key: 'system',
    baslik: 'Sistem',
    alt: 'Duyuru ve önemli sistem mesajları',
  },
];

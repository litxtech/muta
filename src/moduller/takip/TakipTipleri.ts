export type TakipIliskiDurumu =
  | 'SELF'
  | 'NOT_FOLLOWING'
  | 'FOLLOWING'
  | 'FOLLOWS_YOU'
  | 'MUTUAL'
  | 'REQUEST_PENDING'
  | 'INCOMING_REQUEST'
  | 'BLOCKED'
  | 'BLOCKED_BY_USER';

export type TakipIslemKodu =
  | 'followed'
  | 'requested'
  | 'already_following'
  | 'already_requested'
  | 'unfollowed'
  | 'cancelled'
  | 'accepted'
  | 'rejected'
  | 'removed'
  | 'noop'
  | 'rate_limited'
  | 'blocked'
  | 'self'
  | 'guest'
  | 'not_found'
  | 'forbidden'
  | 'unauthenticated'
  | 'network'
  | 'timeout'
  | 'server';

export type TakipSayaclari = {
  followers_count: number;
  following_count: number;
  posts_count: number;
  pending_follow_requests_count: number;
};

export type TakipDurumu = TakipSayaclari & {
  ok: boolean;
  target_id: string;
  state: TakipIliskiDurumu;
  is_private: boolean;
  request_id?: string | null;
  code?: TakipIslemKodu;
};

export type TakipIslemSonucu = Partial<TakipSayaclari> & {
  ok: boolean;
  code: TakipIslemKodu;
  state?: TakipIliskiDurumu;
  request_id?: string | null;
  hata?: string;
};

export type TakipKullaniciKarti = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  level: number;
  is_private?: boolean;
  followed_at?: string | null;
  i_follow: boolean;
  they_follow_me: boolean;
  is_mutual: boolean;
  follows_you: boolean;
  state: TakipIliskiDurumu;
  request_id?: string | null;
};

export type TakipListeSayfasi = {
  items: TakipKullaniciKarti[];
  next_cursor: { created_at: string; id: string } | null;
};

export type TakipListeImleci = {
  created_at: string;
  id: string;
};

export type OrtakTakipciOzeti = {
  count: number;
  previews: {
    user_id: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  }[];
};

export type TakipOnerisi = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  level: number;
  is_private: boolean;
  score: number;
  state: TakipIliskiDurumu;
};

export type AdminTakipIstatistikleri = {
  ok: boolean;
  followers_count: number;
  following_count: number;
  pending_requests: number;
  is_private: boolean;
  follow_last_hour: number;
  unfollow_last_hour: number;
  request_last_hour: number;
  suspicious: boolean;
};

export type TakipListeTuru = 'followers' | 'following';

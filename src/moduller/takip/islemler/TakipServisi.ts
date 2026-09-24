import { supabase } from '../../../lib/supabase';
import i18n from '../../../i18n';
import { TakipHatadanKod, TakipHataMesaji } from '../TakipHataMesajlari';
import { TakipCache } from '../onbellek/TakipCache';
import type {
  AdminTakipIstatistikleri,
  OrtakTakipciOzeti,
  TakipDurumu,
  TakipIliskiDurumu,
  TakipIslemKodu,
  TakipIslemSonucu,
  TakipKullaniciKarti,
  TakipListeImleci,
  TakipListeSayfasi,
  TakipOnerisi,
} from '../TakipTipleri';

function sayi(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function kartNormalize(raw: unknown): TakipKullaniciKarti | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const userId = String(r.user_id ?? '');
  if (!userId) return null;
  return {
    user_id: userId,
    display_name: String(r.display_name ?? i18n.t('ortak.kullanici')),
    username: (r.username as string | null) ?? null,
    avatar_url: (r.avatar_url as string | null) ?? null,
    is_verified: !!r.is_verified,
    level: sayi(r.level) || 1,
    is_private: !!r.is_private,
    followed_at: (r.followed_at as string | null) ?? null,
    i_follow: !!r.i_follow,
    they_follow_me: !!r.they_follow_me,
    is_mutual: !!r.is_mutual,
    follows_you: !!r.follows_you,
    state: (r.state as TakipIliskiDurumu) || 'NOT_FOLLOWING',
    request_id: (r.request_id as string | null) ?? null,
  };
}

function islemNormalize(raw: unknown, fallback: TakipIslemKodu): TakipIslemSonucu {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ok = r.ok !== false;
  const code = (r.code as TakipIslemKodu) || (ok ? fallback : 'server');
  return {
    ok,
    code,
    state: r.state as TakipIliskiDurumu | undefined,
    request_id: (r.request_id as string | null) ?? null,
    followers_count: r.followers_count != null ? sayi(r.followers_count) : undefined,
    following_count: r.following_count != null ? sayi(r.following_count) : undefined,
    posts_count: r.posts_count != null ? sayi(r.posts_count) : undefined,
    pending_follow_requests_count:
      r.pending_follow_requests_count != null
        ? sayi(r.pending_follow_requests_count)
        : undefined,
    hata: ok ? undefined : TakipHataMesaji(code),
  };
}

function rpcHata(error: { message?: string; code?: string; status?: number } | null): TakipIslemSonucu {
  const code = TakipHatadanKod(error);
  return { ok: false, code, hata: TakipHataMesaji(code, error?.message) };
}

export const TakipServisi = {
  async durumGetir(targetUserId: string, viewerId?: string | null): Promise<TakipDurumu | null> {
    if (viewerId) {
      const cached = TakipCache.durumAl(viewerId, targetUserId);
      if (cached) return cached;
    }
    const { data, error } = await supabase.rpc('takip_durumu_getir', {
      p_target_id: targetUserId,
    });
    if (error) throw error;
    const r = (data ?? {}) as Record<string, unknown>;
    if (r.ok === false) return null;
    const row: TakipDurumu = {
      ok: true,
      target_id: String(r.target_id ?? targetUserId),
      state: (r.state as TakipIliskiDurumu) || 'NOT_FOLLOWING',
      is_private: !!r.is_private,
      request_id: (r.request_id as string | null) ?? null,
      followers_count: sayi(r.followers_count),
      following_count: sayi(r.following_count),
      posts_count: sayi(r.posts_count),
      pending_follow_requests_count: sayi(r.pending_follow_requests_count),
    };
    if (viewerId) TakipCache.durumYaz(viewerId, targetUserId, row);
    return row;
  },

  async takipEt(targetUserId: string): Promise<TakipIslemSonucu> {
    const { data, error } = await supabase.rpc('takip_et', {
      p_target_id: targetUserId,
    });
    if (error) return rpcHata(error);
    return islemNormalize(data, 'followed');
  },

  async takiptenCik(targetUserId: string): Promise<TakipIslemSonucu> {
    const { data, error } = await supabase.rpc('takibi_birak', {
      p_target_id: targetUserId,
    });
    if (error) return rpcHata(error);
    return islemNormalize(data, 'unfollowed');
  },

  async istekIptal(targetUserId: string): Promise<TakipIslemSonucu> {
    const { data, error } = await supabase.rpc('takip_istegini_iptal_et', {
      p_target_id: targetUserId,
    });
    if (error) return rpcHata(error);
    return islemNormalize(data, 'cancelled');
  },

  async istekKabul(requestId: string): Promise<TakipIslemSonucu> {
    const { data, error } = await supabase.rpc('takip_istegini_kabul_et', {
      p_request_id: requestId,
    });
    if (error) return rpcHata(error);
    return islemNormalize(data, 'accepted');
  },

  async istekReddet(requestId: string): Promise<TakipIslemSonucu> {
    const { data, error } = await supabase.rpc('takip_istegini_reddet', {
      p_request_id: requestId,
    });
    if (error) return rpcHata(error);
    return islemNormalize(data, 'rejected');
  },

  async takipciKaldir(followerId: string): Promise<TakipIslemSonucu> {
    const { data, error } = await supabase.rpc('takipci_kaldir', {
      p_follower_id: followerId,
    });
    if (error) return rpcHata(error);
    return islemNormalize(data, 'removed');
  },

  async gizliHesapAyarla(isPrivate: boolean): Promise<{ ok: boolean; hata?: string }> {
    const { data, error } = await supabase.rpc('gizli_hesap_ayarla', {
      p_is_private: isPrivate,
    });
    if (error) return { ok: false, hata: TakipHataMesaji(TakipHatadanKod(error), error.message) };
    const row = data as { ok?: boolean } | null;
    return { ok: row?.ok !== false };
  },

  async takipciler(input: {
    userId: string;
    cursor?: TakipListeImleci | null;
    query?: string;
    limit?: number;
  }): Promise<TakipListeSayfasi> {
    const { data, error } = await supabase.rpc('takipcileri_listele', {
      p_user_id: input.userId,
      p_limit: input.limit ?? 24,
      p_cursor_created_at: input.cursor?.created_at ?? null,
      p_cursor_id: input.cursor?.id ?? null,
      p_q: input.query?.trim() || null,
    });
    if (error) throw error;
    return listeParse(data);
  },

  async takipEdilenler(input: {
    userId: string;
    cursor?: TakipListeImleci | null;
    query?: string;
    limit?: number;
  }): Promise<TakipListeSayfasi> {
    const { data, error } = await supabase.rpc('takip_edilenleri_listele', {
      p_user_id: input.userId,
      p_limit: input.limit ?? 24,
      p_cursor_created_at: input.cursor?.created_at ?? null,
      p_cursor_id: input.cursor?.id ?? null,
      p_q: input.query?.trim() || null,
    });
    if (error) throw error;
    return listeParse(data);
  },

  async istekler(input?: {
    cursor?: TakipListeImleci | null;
    limit?: number;
  }): Promise<TakipListeSayfasi> {
    const { data, error } = await supabase.rpc('takip_isteklerini_listele', {
      p_limit: input?.limit ?? 24,
      p_cursor_created_at: input?.cursor?.created_at ?? null,
      p_cursor_id: input?.cursor?.id ?? null,
    });
    if (error) throw error;
    return listeParse(data);
  },

  async ortakOzet(
    targetUserId: string,
    viewerId?: string | null,
  ): Promise<OrtakTakipciOzeti> {
    if (viewerId) {
      const cached = TakipCache.ortakAl(viewerId, targetUserId);
      if (cached) return cached;
    }
    const { data, error } = await supabase.rpc('ortak_takipcileri_ozet', {
      p_target_id: targetUserId,
      p_limit: 3,
    });
    if (error) throw error;
    const r = (data ?? {}) as Record<string, unknown>;
    const row: OrtakTakipciOzeti = {
      count: sayi(r.count),
      previews: Array.isArray(r.previews)
        ? (r.previews as OrtakTakipciOzeti['previews'])
        : [],
    };
    if (viewerId) TakipCache.ortakYaz(viewerId, targetUserId, row);
    return row;
  },

  async ortakListe(input: {
    targetUserId: string;
    cursor?: TakipListeImleci | null;
    limit?: number;
  }): Promise<TakipListeSayfasi> {
    const { data, error } = await supabase.rpc('ortak_takipcileri_listele', {
      p_target_id: input.targetUserId,
      p_limit: input.limit ?? 24,
      p_cursor_created_at: input.cursor?.created_at ?? null,
      p_cursor_id: input.cursor?.id ?? null,
    });
    if (error) throw error;
    return listeParse(data);
  },

  async oneriler(limit = 12): Promise<TakipOnerisi[]> {
    const { data, error } = await supabase.rpc('takip_onerileri_getir', {
      p_limit: limit,
    });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const out: TakipOnerisi[] = [];
    for (const x of rows) {
      const k = kartNormalize(x);
      if (!k) continue;
      const r = x as Record<string, unknown>;
      out.push({
        user_id: k.user_id,
        display_name: k.display_name,
        username: k.username,
        avatar_url: k.avatar_url,
        is_verified: k.is_verified,
        level: k.level,
        is_private: !!r.is_private,
        score: sayi(r.score),
        state: k.state,
      });
    }
    return out;
  },

  async takipCanliYayinlari(limit = 40): Promise<unknown[]> {
    const { data, error } = await supabase.rpc('takip_canli_yayinlari', {
      p_limit: limit,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async adminIstatistik(userId: string): Promise<AdminTakipIstatistikleri | null> {
    const { data, error } = await supabase.rpc('admin_takip_istatistikleri', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data as AdminTakipIstatistikleri;
  },

  cacheInvalidatePair(actorId: string, targetId: string) {
    TakipCache.invalidatePair(actorId, targetId);
  },
};

function listeParse(data: unknown): TakipListeSayfasi {
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const items = Array.isArray(r.items)
    ? r.items.map(kartNormalize).filter((x): x is TakipKullaniciKarti => !!x)
    : [];
  const c = r.next_cursor as { created_at?: string; id?: string } | null;
  return {
    items,
    next_cursor:
      c?.created_at && c?.id ? { created_at: String(c.created_at), id: String(c.id) } : null,
  };
}

/** Mesaj / canli / hikaye modulleri icin tek iliski kaynagi. */
export async function TakipIliskiOku(
  targetUserId: string,
): Promise<TakipIliskiDurumu> {
  const d = await TakipServisi.durumGetir(targetUserId);
  return d?.state ?? 'NOT_FOLLOWING';
}

export { TakipIliskiMesajIzinVerirMi } from '../TakipIliski';

import { supabase } from '../../../lib/supabase';

export type OdaDinleyici = {
  user_id: string;
  role: 'host' | 'cohost' | 'speaker' | 'listener';
  joined_at: string | null;
  profile: {
    id?: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    level: number | null;
    is_verified: boolean | null;
  } | null;
};

type ProfilHam = {
  id?: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  level?: number | null;
  is_verified?: boolean | null;
  deleted_at?: string | null;
  banned_at?: string | null;
};

function profilAktifMi(p: ProfilHam | null | undefined): boolean {
  if (!p) return false;
  if (p.deleted_at) return false;
  if (p.banned_at) return false;
  return true;
}

function profilNormalize(p: unknown): OdaDinleyici['profile'] {
  if (!p) return null;
  const row = Array.isArray(p) ? p[0] : p;
  if (!row || typeof row !== 'object') return null;
  const r = row as ProfilHam;
  if (!profilAktifMi(r)) return null;
  return {
    id: typeof r.id === 'string' ? r.id : undefined,
    display_name: r.display_name ?? null,
    username: r.username ?? null,
    avatar_url: r.avatar_url ?? null,
    level: typeof r.level === 'number' ? r.level : null,
    is_verified: typeof r.is_verified === 'boolean' ? r.is_verified : null,
  };
}

function uyeleriDoldur(data: unknown[] | null): OdaDinleyici[] {
  return (data ?? [])
    .map((row) => {
      const r = row as OdaDinleyici & { profile?: unknown };
      const profile = profilNormalize(r.profile);
      // Join’de silinmiş/banlı profil → listeye alma
      if (r.profile != null && profile == null) return null;
      return {
        user_id: r.user_id,
        role: r.role,
        joined_at: r.joined_at ?? null,
        profile,
      } satisfies OdaDinleyici;
    })
    .filter((u): u is OdaDinleyici => !!u?.user_id);
}

async function eksikProfilleriDoldur(
  liste: OdaDinleyici[],
): Promise<OdaDinleyici[]> {
  const eksikIds = [
    ...new Set(
      liste.filter((s) => s.user_id && !s.profile).map((s) => s.user_id),
    ),
  ];
  if (eksikIds.length === 0) return liste;

  const { data: profiller } = await supabase
    .from('profiles')
    .select(
      'id, display_name, username, avatar_url, level, is_verified, deleted_at, banned_at',
    )
    .in('id', eksikIds);

  const pMap = new Map<string, OdaDinleyici['profile']>();
  const pasif = new Set<string>();
  for (const p of profiller ?? []) {
    const ham = p as ProfilHam;
    if (!profilAktifMi(ham)) {
      pasif.add(p.id as string);
      continue;
    }
    pMap.set(p.id as string, {
      id: p.id as string,
      display_name: (p.display_name as string | null) ?? null,
      username: (p.username as string | null) ?? null,
      avatar_url: (p.avatar_url as string | null) ?? null,
      level: typeof p.level === 'number' ? p.level : null,
      is_verified: typeof p.is_verified === 'boolean' ? p.is_verified : null,
    });
  }

  return liste
    .filter((s) => !pasif.has(s.user_id))
    .map((s) => (s.profile ? s : { ...s, profile: pMap.get(s.user_id) ?? null }))
    .filter((s) => !!s.profile);
}

/** Silinmiş / banlı üyelik satırlarını odadan temizle (hayalet dinleyici). */
async function hayaletUyeleriTemizle(odaId: string): Promise<void> {
  try {
    await supabase.rpc('oda_hayalet_uyeleri_temizle', { p_room_id: odaId });
  } catch {
    /* RPC yoksa sessiz — client filtre yeterli */
  }
}

/** Odadaki aktif üyeler (koltuk + dinleyen). Silinmiş/banlı yok. */
export async function OdaUyeleriniGetir(odaId: string): Promise<OdaDinleyici[]> {
  void hayaletUyeleriTemizle(odaId);

  const { data, error } = await supabase
    .from('room_members')
    .select(
      'user_id, role, joined_at, profile:profiles(id, display_name, username, avatar_url, level, is_verified, deleted_at, banned_at)',
    )
    .eq('room_id', odaId)
    .order('joined_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const liste = await eksikProfilleriDoldur(
    uyeleriDoldur(data as unknown[] | null),
  );
  // Profili olmayan / pasif hesaplar dinleyici sayılmaz
  return liste.filter((u) => !!u.profile);
}

/** Koltukta oturmayan üyeler — odayı dinleyen profiller. */
export function OdaDinleyicileriniAyikla(
  uyeler: OdaDinleyici[],
  koltukUserIds: Iterable<string>,
): OdaDinleyici[] {
  const koltukta = new Set(koltukUserIds);
  return uyeler.filter(
    (u) => !!u.user_id && !!u.profile && !koltukta.has(u.user_id),
  );
}

/**
 * Odada koltuğa oturmayan üyeler — dinleyen profiller.
 */
export async function OdaDinleyicileriniGetir(
  odaId: string,
  koltukUserIds?: string[],
): Promise<OdaDinleyici[]> {
  const uyeler = await OdaUyeleriniGetir(odaId);
  let koltukIds = koltukUserIds;
  if (!koltukIds) {
    const koltukRes = await supabase
      .from('room_seats')
      .select('user_id')
      .eq('room_id', odaId)
      .not('user_id', 'is', null);
    if (koltukRes.error) throw koltukRes.error;
    koltukIds = (koltukRes.data ?? [])
      .map((s) => s.user_id as string | null)
      .filter((id): id is string => !!id);
  }
  return OdaDinleyicileriniAyikla(uyeler, koltukIds);
}

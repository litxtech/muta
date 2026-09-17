import { supabase } from '../../../../lib/supabase';
import { AdminKullaniciAra } from './AdminKullaniciOkuma';

export type AdminKullaniciOneriSatiri = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function kucuk(s: string) {
  return s.trim().toLocaleLowerCase('tr-TR');
}

export function OneriAdi(k: {
  display_name: string | null;
  username: string | null;
}) {
  return k.display_name?.trim() || k.username?.trim() || 'Kullanıcı';
}

function harfleBaslar(metin: string | null, q: string): boolean {
  if (!metin) return false;
  const t = kucuk(metin);
  if (t.startsWith(q)) return true;
  return t.split(/\s+/).some((kelime) => kelime.startsWith(q));
}

export function OnerileriSirala(
  rows: AdminKullaniciOneriSatiri[],
  q: string,
  limit = 8,
): AdminKullaniciOneriSatiri[] {
  const s = kucuk(q);
  if (!s) return [];
  return rows
    .filter(
      (k) => harfleBaslar(k.display_name, s) || harfleBaslar(k.username, s),
    )
    .sort((a, b) => {
      const adA = kucuk(OneriAdi(a));
      const adB = kucuk(OneriAdi(b));
      const prefixA = adA.startsWith(s) ? 0 : 1;
      const prefixB = adB.startsWith(s) ? 0 : 1;
      if (prefixA !== prefixB) return prefixA - prefixB;
      return adA.localeCompare(adB, 'tr');
    })
    .slice(0, limit);
}

/** Yazılan harfle başlayan isim önerileri — avatar + ad. */
export async function AdminKullaniciOneri(
  q: string,
  limit = 8,
): Promise<AdminKullaniciOneriSatiri[]> {
  const sorgu = q.trim().replace(/[%_,]/g, '').slice(0, 40);
  if (sorgu.length < 1) return [];

  const { data, error } = await supabase.rpc('admin_kullanici_oneri', {
    p_q: sorgu,
    p_limit: Math.min(Math.max(limit, 1), 24),
  });

  if (!error) {
    return OnerileriSirala(
      (data ?? []) as AdminKullaniciOneriSatiri[],
      sorgu,
      limit,
    );
  }

  const rows = await AdminKullaniciAra(sorgu, 80);
  return OnerileriSirala(
    rows.map((k) => ({
      id: k.id,
      username: k.username,
      display_name: k.display_name,
      avatar_url: k.avatar_url,
    })),
    sorgu,
    limit,
  );
}

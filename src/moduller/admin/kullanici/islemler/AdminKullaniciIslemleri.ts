import { supabase } from '../../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../../yapilandirma/OrtamDegiskenleri';

export type AdminIslemSonucu =
  | { ok: true; veri?: Record<string, unknown> }
  | { ok: false; hata: string };

export async function AdminKullaniciBanla(
  userId: string,
  reason: string,
): Promise<AdminIslemSonucu> {
  const { data, error } = await supabase.rpc('admin_kullanici_banla', {
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, veri: data as Record<string, unknown> };
}

/** Geçici askıya alma — banned_until */
export async function AdminKullaniciAskiyaAl(
  userId: string,
  hours = 24,
  reason?: string,
): Promise<AdminIslemSonucu> {
  const { error } = await supabase.rpc('admin_kullanici_askiya_al', {
    p_user_id: userId,
    p_hours: hours,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AdminKullaniciBanKaldir(
  userId: string,
): Promise<AdminIslemSonucu> {
  const { data, error } = await supabase.rpc('admin_kullanici_ban_kaldir', {
    p_user_id: userId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, veri: data as Record<string, unknown> };
}

export async function AdminKullaniciSil(
  userId: string,
  reason: string,
): Promise<AdminIslemSonucu> {
  const { data, error } = await supabase.rpc('admin_kullanici_sil', {
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, veri: data as Record<string, unknown> };
}

export async function AdminIhtarVer(input: {
  userId: string;
  reason: string;
  severity?: string;
  notes?: string;
}): Promise<AdminIslemSonucu> {
  const { data, error } = await supabase.rpc('admin_ihtar_ver', {
    p_user_id: input.userId,
    p_reason: input.reason,
    p_severity: input.severity ?? 'medium',
    p_notes: input.notes ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, veri: data as Record<string, unknown> };
}

export async function AdminIhtarKaldir(
  warningId: string,
): Promise<AdminIslemSonucu> {
  const { data, error } = await supabase.rpc('admin_ihtar_kaldir', {
    p_warning_id: warningId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, veri: data as Record<string, unknown> };
}

/** Tam platform admin yetkisi ver / kaldir (is_admin). */
export async function AdminKullaniciAdminYetkiAyarla(
  userId: string,
  isAdmin: boolean,
): Promise<AdminIslemSonucu> {
  const { data, error } = await supabase.rpc(
    'admin_kullanici_admin_yetki_ayarla',
    {
      p_user_id: userId,
      p_is_admin: isAdmin,
    },
  );
  if (error) return { ok: false, hata: error.message };
  return { ok: true, veri: data as Record<string, unknown> };
}

export async function AdminKullaniciOlustur(input: {
  email: string;
  password: string;
  display_name?: string;
  username?: string;
  phone_e164?: string;
}): Promise<AdminIslemSonucu> {
  const url = `${OrtamDegiskenleri.supabaseUrl.replace(/\/$/, '')}/functions/v1/admin-kullanici-olustur`;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, hata: 'Oturum yok' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: OrtamDegiskenleri.supabaseAnonAnahtari,
      },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      user_id?: string;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return { ok: false, hata: json.error ?? 'Kullanıcı oluşturulamadı' };
    }
    return { ok: true, veri: json as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'Oluşturma başarısız',
    };
  }
}

/** Admin: hedef kullanıcının şifresini değiştir. */
export async function AdminKullaniciSifreDegistir(input: {
  userId: string;
  password: string;
}): Promise<AdminIslemSonucu> {
  const url = `${OrtamDegiskenleri.supabaseUrl.replace(/\/$/, '')}/functions/v1/admin-kullanici-sifre-degistir`;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, hata: 'Oturum yok' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: OrtamDegiskenleri.supabaseAnonAnahtari,
      },
      body: JSON.stringify({
        user_id: input.userId,
        password: input.password,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      user_id?: string;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return { ok: false, hata: json.error ?? 'Şifre değiştirilemedi' };
    }
    return { ok: true, veri: json as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'Şifre değiştirme başarısız',
    };
  }
}

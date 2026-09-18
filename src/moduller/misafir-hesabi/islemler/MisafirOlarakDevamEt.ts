import { supabase } from '../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';
import { CihazKimliginiGetir } from '../../kimlik-dogrulama/oturum/CihazKimliginiGetir';
import {
  MisafirCihazOturumuKaydet,
  MisafirCihazOturumuOku,
  MisafirCihazOturumuTemizle,
} from './MisafirCihazOturumDepolama';

type CihazDurum = {
  action?: string;
  reason?: string;
  user_id?: string;
};

async function oturumuKaydet(deviceId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s?.access_token || !s.refresh_token || !s.user?.id) return;
  await MisafirCihazOturumuKaydet({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    user_id: s.user.id,
    device_id: deviceId,
  });
}

async function yerelOturumuAc(
  deviceId: string,
  beklenenUserId?: string,
): Promise<boolean> {
  const kayit = await MisafirCihazOturumuOku();
  if (!kayit) return false;
  if (kayit.device_id && kayit.device_id !== deviceId) return false;
  if (beklenenUserId && kayit.user_id !== beklenenUserId) return false;

  const { data, error } = await supabase.auth.setSession({
    access_token: kayit.access_token,
    refresh_token: kayit.refresh_token,
  });
  if (error || !data.session) {
    // Refresh dene
    const yenile = await supabase.auth.refreshSession({
      refresh_token: kayit.refresh_token,
    });
    if (yenile.error || !yenile.data.session) return false;
  }
  await oturumuKaydet(deviceId);
  return true;
}

async function edgeOturumuAc(
  deviceId: string,
  userId: string,
): Promise<boolean> {
  try {
    const base = OrtamDegiskenleri.supabaseUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/functions/v1/misafir-cihaz-oturum`, {
      method: 'POST',
      headers: {
        apikey: OrtamDegiskenleri.supabaseAnonAnahtari,
        Authorization: `Bearer ${OrtamDegiskenleri.supabaseAnonAnahtari}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_id: deviceId, user_id: userId }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!json.access_token || !json.refresh_token) return false;
    const { error } = await supabase.auth.setSession({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    });
    if (error) return false;
    await oturumuKaydet(deviceId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Misafir girişi — cihaz başına tek misafir.
 * reuse: mevcut misafir oturumu; create: yeni anonymous; block: ban.
 */
export async function MisafirOlarakDevamEt(): Promise<{
  ok: boolean;
  hata?: string;
}> {
  const deviceId = await CihazKimliginiGetir();

  const { data: durumHam, error: durumErr } = await supabase.rpc(
    'misafir_cihaz_durumu',
    { p_device_id: deviceId },
  );
  if (durumErr) {
    return { ok: false, hata: durumErr.message };
  }

  const durum = (durumHam ?? {}) as CihazDurum;
  const action = durum.action ?? 'create';

  if (action === 'block') {
    return {
      ok: false,
      hata:
        'Bu cihazdan misafir hesabı açılamaz. Hesap askıya alınmış veya engellenmiş olabilir.',
    };
  }

  if (action === 'reuse' && durum.user_id) {
    const yerel = await yerelOturumuAc(deviceId, durum.user_id);
    if (yerel) return { ok: true };
    const edge = await edgeOturumuAc(deviceId, durum.user_id);
    if (edge) return { ok: true };
    return {
      ok: false,
      hata:
        'Mevcut misafir oturumu açılamadı. İnternet bağlantını kontrol edip tekrar dene.',
    };
  }

  // create
  const { data, error } = await supabase.auth.signInAnonymously({
    options: {
      data: {
        is_guest: true,
        display_name: 'Misafir',
        language: 'tr',
      },
    },
  });

  if (error) {
    return {
      ok: false,
      hata:
        error.message.includes('Anonymous') ||
        error.message.includes('anonymous')
          ? 'Misafir girişi için Supabase Anonymous provider açılmalı.'
          : error.message,
    };
  }

  if (!data.session) {
    return { ok: false, hata: 'Misafir oturumu oluşturulamadı.' };
  }

  const { data: bagla, error: baglaErr } = await supabase.rpc(
    'misafir_cihaz_bagla',
    { p_device_id: deviceId },
  );
  if (baglaErr) {
    await supabase.auth.signOut({ scope: 'local' });
    await MisafirCihazOturumuTemizle();
    return { ok: false, hata: baglaErr.message };
  }

  const bag = (bagla ?? {}) as { ok?: boolean; hata?: string; reason?: string };
  if (bag.ok === false) {
    await supabase.auth.signOut({ scope: 'local' });
    await MisafirCihazOturumuTemizle();
    if (bag.reason === 'reuse_required') {
      // Race: başka misafir bağlandı — reuse dene
      const tekrar = await supabase.rpc('misafir_cihaz_durumu', {
        p_device_id: deviceId,
      });
      const d2 = (tekrar.data ?? {}) as CihazDurum;
      if (d2.action === 'reuse' && d2.user_id) {
        const ok =
          (await yerelOturumuAc(deviceId, d2.user_id)) ||
          (await edgeOturumuAc(deviceId, d2.user_id));
        if (ok) return { ok: true };
      }
    }
    return {
      ok: false,
      hata: bag.hata ?? 'Bu cihazdan misafir hesabı açılamadı.',
    };
  }

  await oturumuKaydet(deviceId);
  return { ok: true };
}

/** Ban / hesap silme sonrası yerel misafir token’ını temizle */
export async function MisafirCihazOturumunuGuvenliTemizle(): Promise<void> {
  await MisafirCihazOturumuTemizle();
}

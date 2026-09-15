import { supabase } from '../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';
import { GuvenlikOlayiKaydet } from '../../guvenlik/olaylar/GuvenlikOlayiKaydet';
import { ManuelCikisYap } from '../oturum/ManuelCikisYap';

export type HesapSilSonuc =
  | { ok: true; hardDeleted?: boolean }
  | { ok: false; hata: string };

/**
 * Kullanici kendi hesabini siler.
 * 1) Soft delete (RPC) — her zaman
 * 2) Edge Function ile auth.users hard delete — mumkunse
 * 3) Lokal oturumu kapat
 */
export async function HesapSil(input?: {
  reason?: string;
}): Promise<HesapSilSonuc> {
  const { data: rpcData, error } = await supabase.rpc('hesap_sil_istegi', {
    p_reason: input?.reason ?? null,
  });

  if (error) {
    return { ok: false, hata: error.message };
  }

  const kod =
    rpcData && typeof rpcData === 'object' && 'kod' in rpcData
      ? String((rpcData as { kod?: string }).kod)
      : 'deleted';

  if (kod !== 'deleted' && kod !== 'already_deleted' && kod !== 'no_profile') {
    return { ok: false, hata: 'Hesap silinemedi' };
  }

  void GuvenlikOlayiKaydet('account_delete_requested', {
    reason: input?.reason ?? null,
    kod,
  });

  let hardDeleted = false;

  // JWT hala gecerliyken hard delete dene
  try {
    const base = OrtamDegiskenleri.supabaseUrl?.replace(/\/$/, '');
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData.session?.access_token;
    if (base && jwt && OrtamDegiskenleri.supabaseAnonAnahtari) {
      const res = await fetch(`${base}/functions/v1/hesap-sil`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: OrtamDegiskenleri.supabaseAnonAnahtari,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: input?.reason ?? null }),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          hardDeleted?: boolean;
        };
        hardDeleted = !!json.hardDeleted;
      }
    }
  } catch {
    /* soft delete yeterli — Apple soft delete kabul eder */
  }

  try {
    await ManuelCikisYap('account_deleted');
  } catch {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* hard delete sonrasi session zaten gecersiz olabilir */
    }
  }

  return { ok: true, hardDeleted };
}

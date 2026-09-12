import { supabase } from '../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';

/**
 * Guest → Registered: ayni internal UUID korunur (anonymous upgrade).
 */
export async function MisafirHesabiTamamla(input: {
  ad: string;
  soyad: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; hata?: string; needsConfirm?: boolean }> {
  const displayName = `${input.ad.trim()} ${input.soyad.trim()}`.trim();
  const username =
    `${input.ad.trim()}${input.soyad.trim()}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16) || `user${Date.now().toString(36).slice(-6)}`;

  const { data, error } = await supabase.auth.updateUser({
    email: input.email.trim(),
    password: input.password,
    data: {
      is_guest: false,
      display_name: displayName,
      username,
      first_name: input.ad.trim(),
      last_name: input.soyad.trim(),
    },
  });

  if (error) return { ok: false, hata: error.message };

  const { error: rpcError } = await supabase.rpc('misafir_hesabi_tamamlandi', {
    p_display_name: displayName,
    p_username: username,
  });

  if (rpcError) {
    // Auth upgrade oldu; profil RPC basarisiz olabilir (migration eksik)
    console.warn('[MisafirHesabiTamamla] profil RPC:', rpcError.message);
  }

  return {
    ok: true,
    needsConfirm: !data.user?.email_confirmed_at,
  };
}

export function MisafirEmailDogrulamaYonlendirmesi(): string {
  return `${OrtamDegiskenleri.uygulamaSemasi}://auth/callback`;
}

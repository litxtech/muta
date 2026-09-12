import { supabase } from '../../../lib/supabase';

/**
 * Misafir girisi — ayni UUID upgrade icin anonymous auth tercih edilir.
 * Dashboard: Authentication → Providers → Anonymous: ON
 */
export async function MisafirOlarakDevamEt(): Promise<{
  ok: boolean;
  hata?: string;
}> {
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
        error.message.includes('Anonymous') || error.message.includes('anonymous')
          ? 'Misafir girisi icin Supabase Anonymous provider acilmali.'
          : error.message,
    };
  }

  if (!data.session) {
    return { ok: false, hata: 'Misafir oturumu olusturulamadi.' };
  }

  return { ok: true };
}

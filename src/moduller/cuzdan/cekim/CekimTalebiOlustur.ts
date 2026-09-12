import { supabase } from '../../../lib/supabase';
import { FinansIdempotencyAnahtariOlustur } from '../islemler/FinansIdempotencyAnahtariOlustur';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export async function CekimTalebiOlustur(input: {
  diamonds: number;
  method?: string;
  details?: Record<string, unknown>;
}): Promise<{ ok: boolean; hata?: string }> {
  if (await KillSwitchAktifMiSunucu('kill_withdrawal')) {
    return { ok: false, hata: 'Çekim geçici olarak kapalı.' };
  }
  if (!(await OzellikBayragiAktifMiSunucu('withdrawals_enabled'))) {
    return { ok: false, hata: 'withdrawals_enabled bayrağı kapalı.' };
  }

  const { error } = await supabase.rpc('cekim_talebi_olustur', {
    p_diamonds: input.diamonds,
    p_method: input.method ?? 'bank',
    p_details: input.details ?? {},
    p_idempotency_key: FinansIdempotencyAnahtariOlustur('withdrawal'),
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function CekimTaleplerimiGetir() {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

import { supabase } from '../../../lib/supabase';
import { FinansIdempotencyAnahtariOlustur } from '../islemler/FinansIdempotencyAnahtariOlustur';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

function CekimHataMesaji(ham?: string): string {
  const m = (ham ?? '').toLowerCase();
  if (!m) return 'Çekim talebi oluşturulamadı.';
  if (m.includes('insufficient')) return 'Elmas bakiyesi yetersiz.';
  if (m.includes('guest')) return 'Misafir hesaplar çekim yapamaz.';
  if (m.includes('temporarily disabled') || m.includes('kill'))
    return 'Çekim geçici olarak kapalı.';
  if (m.includes('feature disabled') || m.includes('withdrawals'))
    return 'Çekim şu an kullanılamıyor.';
  if (m.includes('invalid amount')) return 'Geçerli bir elmas miktarı gir.';
  if (m.includes('not authenticated')) return 'Oturum gerekli.';
  return ham ?? 'Çekim talebi oluşturulamadı.';
}

export async function CekimTalebiOlustur(input: {
  diamonds: number;
  method?: string;
  details?: Record<string, unknown>;
}): Promise<{ ok: boolean; hata?: string }> {
  if (await KillSwitchAktifMiSunucu('kill_withdrawal')) {
    return { ok: false, hata: 'Çekim geçici olarak kapalı.' };
  }
  const withdrawAcik =
    (await OzellikBayragiAktifMiSunucu('wallet_withdraw_enabled')) ||
    (await OzellikBayragiAktifMiSunucu('withdrawals_enabled'));
  if (!withdrawAcik) {
    return { ok: false, hata: 'Çekim şu an kullanılamıyor.' };
  }
  const { error: bayrakErr } = await supabase.rpc('cekim_wallet_bayrak_kontrol');
  if (bayrakErr) {
    return { ok: false, hata: CekimHataMesaji(bayrakErr.message) };
  }

  const { error } = await supabase.rpc('cekim_talebi_olustur', {
    p_diamonds: input.diamonds,
    p_method: input.method ?? 'bank',
    p_details: input.details ?? {},
    p_idempotency_key: FinansIdempotencyAnahtariOlustur('withdrawal'),
  });
  if (error) return { ok: false, hata: CekimHataMesaji(error.message) };
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

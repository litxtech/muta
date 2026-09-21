import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';
import type { GonderiPaylasSonuc } from './tipler';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function yeniClientId(): string {
  // crypto.randomUUID yoksa basit uuid
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID() as string;
  } catch {
    /* */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Durum gönderisini bir veya birden fazla kullanıcıya SHARED_POST olarak gönderir.
 * İstemci owner/media göndermez — sunucu doğrular.
 */
export async function GonderiPaylasServisi(input: {
  statusId: string;
  recipientIds: string[];
  note?: string | null;
}): Promise<GonderiPaylasSonuc> {
  if (!(await OzellikBayragiAktifMiSunucu('messages_enabled'))) {
    return { ok: false, sent_count: 0, fail_count: 0, hata: 'Mesajlaşma kapalı.' };
  }

  const unique = Array.from(
    new Set(
      (input.recipientIds ?? []).filter(
        (id) => typeof id === 'string' && UUID_RE.test(id),
      ),
    ),
  );

  if (!UUID_RE.test(input.statusId)) {
    return { ok: false, sent_count: 0, fail_count: 0, hata: 'Geçersiz gönderi.' };
  }
  if (unique.length === 0) {
    return { ok: false, sent_count: 0, fail_count: 0, hata: 'Alıcı seçilmedi.' };
  }

  const clientIds = unique.map(() => yeniClientId());

  const { data, error } = await supabase.rpc('durum_dm_paylas', {
    p_status_id: input.statusId,
    p_recipient_ids: unique,
    p_note: input.note?.trim() ? input.note.trim().slice(0, 500) : null,
    p_client_ids: clientIds,
  });

  if (error) {
    return {
      ok: false,
      sent_count: 0,
      fail_count: unique.length,
      hata: error.message,
    };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const sent = Number(row.sent_count ?? 0);
  const fail = Number(row.fail_count ?? 0);
  return {
    ok: !!row.ok && sent > 0,
    sent_count: sent,
    fail_count: fail,
    results: Array.isArray(row.results)
      ? (row.results as GonderiPaylasSonuc['results'])
      : [],
    hata:
      sent === 0
        ? 'Gönderilemedi.'
        : fail > 0
          ? `${sent} kişiye gönderildi, ${fail} başarısız.`
          : undefined,
  };
}

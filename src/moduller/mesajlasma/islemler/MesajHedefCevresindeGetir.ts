import { supabase } from '../../../lib/supabase';
import type { DirektMesaj } from '../okuma/MesajlariGetir';

/**
 * Reply / pin jump — hedef mesaj etrafındaki pencere (kronolojik artan).
 */
export async function MesajHedefCevresindeGetir(input: {
  threadId: string;
  messageId: string;
  beforeLimit?: number;
  afterLimit?: number;
}): Promise<
  | { ok: true; mesajlar: DirektMesaj[] }
  | { ok: false; hata: string }
> {
  const { data, error } = await supabase.rpc('mesajlari_hedef_cevresinde_getir', {
    p_thread_id: input.threadId,
    p_message_id: input.messageId,
    p_before_limit: input.beforeLimit ?? 30,
    p_after_limit: input.afterLimit ?? 30,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, mesajlar: (data as DirektMesaj[]) ?? [] };
}

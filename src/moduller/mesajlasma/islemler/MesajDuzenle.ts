import { supabase } from '../../../lib/supabase';
import type { DirektMesaj } from '../okuma/MesajlariGetir';

export async function MesajDuzenle(input: {
  messageId: string;
  newBody: string;
  expectedVersion?: number | null;
}): Promise<
  | { ok: true; mesaj: DirektMesaj }
  | { ok: false; hata: string }
> {
  const { data, error } = await supabase.rpc('mesaj_duzenle', {
    p_message_id: input.messageId,
    p_new_body: input.newBody,
    p_expected_version: input.expectedVersion ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, mesaj: data as DirektMesaj };
}

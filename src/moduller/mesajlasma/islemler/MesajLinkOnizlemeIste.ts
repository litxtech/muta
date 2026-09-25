import { supabase } from '../../../lib/supabase';
import type { MesajLinkOnizleme } from '../okuma/MesajlariGetir';

/**
 * Server-side link preview (SSRF-safe edge). Never fetch arbitrary URLs on device.
 */
export async function MesajLinkOnizlemeIste(input: {
  url: string;
  messageId?: string;
}): Promise<
  | { ok: true; preview: MesajLinkOnizleme }
  | { ok: false; status?: string }
> {
  const { data, error } = await supabase.functions.invoke('link-preview', {
    body: {
      url: input.url,
      message_id: input.messageId,
    },
  });
  if (error || !data?.ok || !data.preview) {
    return { ok: false, status: data?.status };
  }
  return { ok: true, preview: data.preview as MesajLinkOnizleme };
}

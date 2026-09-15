import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';
import { supabase } from '../../../lib/supabase';
import type {
  CallSecurityEvent,
  DirectCall,
  GorusmeTuru,
  ThreadKarsiProfil,
} from '../tipler';

export async function MesajThreadKarsiProfil(
  threadId: string,
): Promise<ThreadKarsiProfil | null> {
  const { data, error } = await supabase.rpc('mesaj_thread_karsi_profil', {
    p_thread_id: threadId,
  });
  if (error) throw error;
  return (data as ThreadKarsiProfil) ?? null;
}

/** Karsi tarafa aninda arama sinyali (postgres_changes beklemeden) */
async function aramaSinyaliGonder(call: DirectCall) {
  try {
    const ch = supabase.channel(`call-ring-${call.callee_id}`, {
      config: { broadcast: { ack: false, self: false } },
    });
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve();
        }
      });
      // subscribe asla gelmezse kilitleme
      setTimeout(resolve, 400);
    });
    await ch.send({
      type: 'broadcast',
      event: 'incoming_call',
      payload: call,
    });
    void supabase.removeChannel(ch);
  } catch {
    /* realtime opsiyonel — postgres_changes yedek */
  }
}

/** Outbox'taki push'u hemen isle (giris JWT ile) */
function pushWorkerTetikle() {
  const base = OrtamDegiskenleri.supabaseUrl;
  const anon = OrtamDegiskenleri.supabaseAnonAnahtari;
  if (!base || !anon) return;
  void (async () => {
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return;
    await fetch(`${base}/functions/v1/notification-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        apikey: anon,
      },
      body: JSON.stringify({ limit: 20 }),
    });
  })().catch(() => undefined);
}

export async function GorusmeBaslat(
  threadId: string,
  callType: GorusmeTuru,
): Promise<{ ok: true; call: DirectCall } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('gorusme_baslat', {
    p_thread_id: threadId,
    p_call_type: callType,
  });
  if (error) return { ok: false, hata: error.message };
  const call = data as DirectCall;
  // UI engellemeden paralel sinyal
  void aramaSinyaliGonder(call);
  pushWorkerTetikle();
  return { ok: true, call };
}

export async function GorusmeCevapla(
  callId: string,
): Promise<{ ok: true; call: DirectCall } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('gorusme_cevapla', {
    p_call_id: callId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, call: data as DirectCall };
}

export async function GorusmeReddet(
  callId: string,
): Promise<{ ok: true; call: DirectCall } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('gorusme_reddet', {
    p_call_id: callId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, call: data as DirectCall };
}

export async function GorusmeBitir(
  callId: string,
  reason = 'hangup',
): Promise<{ ok: true; call: DirectCall } | { ok: false; hata: string }> {
  const { data, error } = await supabase.rpc('gorusme_bitir', {
    p_call_id: callId,
    p_reason: reason,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true, call: data as DirectCall };
}

export async function GorusmeGetir(callId: string): Promise<DirectCall> {
  const { data, error } = await supabase.rpc('gorusme_getir', {
    p_call_id: callId,
  });
  if (error) throw error;
  return data as DirectCall;
}

export async function GorusmeGuvenlikOlayi(input: {
  callId: string;
  eventType: 'screenshot' | 'screen_record' | 'capture_blocked' | 'capture_attempt';
  platform?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await supabase.rpc('gorusme_guvenlik_olayi', {
    p_call_id: input.callId,
    p_event_type: input.eventType,
    p_platform: input.platform ?? null,
    p_details: input.details ?? {},
  });
}

export async function AdminGorusmeGuvenlikListesi(
  limit = 50,
): Promise<CallSecurityEvent[]> {
  const { data, error } = await supabase.rpc('admin_gorusme_guvenlik_listesi', {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as CallSecurityEvent[];
}

export async function AdminGorusmeUyariGonder(
  eventId: string,
  message: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('admin_gorusme_uyari_gonder', {
    p_event_id: eventId,
    p_message: message,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AdminGorusmeOlayGoruldu(eventId: string): Promise<void> {
  await supabase.rpc('admin_gorusme_olay_goruldu', { p_event_id: eventId });
}

import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';
import { supabase } from '../../../lib/supabase';

export type LiveKitRol = 'listener' | 'speaker' | 'host' | 'publisher';

export type LiveKitTokenSonuc =
  | {
      ok: true;
      token: string;
      url: string;
      roomName: string;
      mock: boolean;
    }
  | { ok: false; hata: string };

/**
 * LiveKit secret mobilde yok — Edge Function `livekit-token`.
 * Audit RPC sadece sunucuda (cift istek yok → daha hizli).
 *
 * Not: Mock token dönmek görüşmeyi "bağlı" gösterir ama ses/görüntü gitmez.
 * URL yoksa hata dön — sessiz mock yok.
 */
export async function LiveKitTokenAl(input: {
  roomName: string;
  role: LiveKitRol;
}): Promise<LiveKitTokenSonuc> {
  const edgeUrl =
    OrtamDegiskenleri.livekitTokenUrl ||
    process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_URL ||
    '';
  const livekitUrl =
    OrtamDegiskenleri.livekitUrl || process.env.EXPO_PUBLIC_LIVEKIT_URL || '';

  if (!edgeUrl || !livekitUrl) {
    return {
      ok: false,
      hata:
        'LiveKit yapılandırması eksik (EXPO_PUBLIC_LIVEKIT_URL / TOKEN_URL). Yeni build gerekli.',
    };
  }

  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) return { ok: false, hata: 'Oturum gerekli' };

  try {
    const res = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        apikey: OrtamDegiskenleri.supabaseAnonAnahtari,
      },
      body: JSON.stringify({
        roomName: input.roomName,
        role: input.role,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      token?: string;
      url?: string;
      error?: string;
    };

    if (!res.ok) {
      const msg = json.error ?? `Token servisi hata: ${res.status}`;
      if (/api key|unauthorized|secret/i.test(msg)) {
        return {
          ok: false,
          hata: 'LiveKit API anahtari gecersiz — Cloud Keys yenile',
        };
      }
      return { ok: false, hata: msg };
    }
    if (!json.token) return { ok: false, hata: 'Token bos' };

    return {
      ok: true,
      token: json.token,
      url: json.url ?? livekitUrl,
      roomName: input.roomName,
      mock: false,
    };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'Token alinamadi',
    };
  }
}

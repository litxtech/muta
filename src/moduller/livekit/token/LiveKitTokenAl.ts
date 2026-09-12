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
 * LiveKit secret mobilde yok.
 * Production: Edge Function `livekit-token`.
 * Dev: mock token + baglanti simulasyonu.
 */
export async function LiveKitTokenAl(input: {
  roomName: string;
  role: LiveKitRol;
}): Promise<LiveKitTokenSonuc> {
  const { error: auditError } = await supabase.rpc('livekit_token_istegi_kaydet', {
    p_room_name: input.roomName,
    p_role: input.role,
  });
  if (auditError) {
    // Migration yoksa devam (mock)
    console.warn('[LiveKitTokenAl] audit:', auditError.message);
  }

  const edgeUrl = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_URL;
  const livekitUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL;

  if (edgeUrl && livekitUrl) {
    const { data: session } = await supabase.auth.getSession();
    const jwt = session.session?.access_token;
    if (!jwt) return { ok: false, hata: 'Oturum gerekli' };

    try {
      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          roomName: input.roomName,
          role: input.role,
        }),
      });
      if (!res.ok) {
        return { ok: false, hata: `Token servisi hata: ${res.status}` };
      }
      const json = (await res.json()) as { token?: string; url?: string };
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

  // Dev mock — Expo Go'da native LiveKit olmadan UI/akıs testi
  return {
    ok: true,
    token: `mock.${OrtamDegiskenleri.ortam}.${input.role}.${Date.now()}`,
    url: livekitUrl ?? 'wss://mock.livekit.local',
    roomName: input.roomName,
    mock: true,
  };
}

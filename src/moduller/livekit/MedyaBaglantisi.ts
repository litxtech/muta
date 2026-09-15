import { MedyaIzinleriniIste } from './izin/MedyaIzinleriniIste';
import { LiveKitTokenAl, type LiveKitRol } from './token/LiveKitTokenAl';
import { LiveKitBaglantiYoneticisi } from './baglanti/LiveKitBaglantiYoneticisi';

export type RtcSaglayici = 'livekit';

export function AktifRtcSaglayici(): RtcSaglayici {
  return 'livekit';
}

export type MedyaBaglantiSonuc =
  | { ok: true; saglayici: RtcSaglayici; mock: boolean; kanal: string }
  | { ok: false; hata: string };

/**
 * Oda / canli / 1:1 gorusme — LiveKit facade.
 * Gift / PK / chat buraya yazilmaz.
 */
export async function MedyaOdasiBaglan(input: {
  roomName: string;
  role: LiveKitRol;
  video?: boolean;
  /** true: aynı odaya zorla yeniden bağlan (rol yükseltme) */
  zorla?: boolean;
}): Promise<MedyaBaglantiSonuc> {
  const asPublisher =
    input.role === 'host' ||
    input.role === 'publisher' ||
    input.role === 'speaker';
  const publishVideo = !!input.video && asPublisher;

  // Dinleyici: mic/kamera OS diyaloğu yok. Yayıncı: önce get, yoksa request.
  const izin = await MedyaIzinleriniIste({
    mikrofon: asPublisher,
    kamera: publishVideo,
  });
  if (!izin.ok) return { ok: false, hata: izin.hata ?? 'Medya izni yok' };

  const token = await LiveKitTokenAl({
    roomName: input.roomName,
    role: input.role,
  });
  if (!token.ok) return { ok: false, hata: token.hata };

  const bag = await LiveKitBaglantiYoneticisi.baglan({
    url: token.url,
    token: token.token,
    roomName: token.roomName,
    mock: token.mock,
    asPublisher,
    publishVideo,
    zorla: input.zorla,
  });
  if (!bag.ok) return { ok: false, hata: bag.hata ?? 'LiveKit baglanti hatasi' };

  // Uzak ses her zaman hoparlörden — dinleyici/host fark etmez
  void LiveKitBaglantiYoneticisi.setSpeakerphone(true);

  return {
    ok: true,
    saglayici: 'livekit',
    mock: token.mock || LiveKitBaglantiYoneticisi.mockMu(),
    kanal: token.roomName,
  };
}

export async function MedyaOdasiKes() {
  await LiveKitBaglantiYoneticisi.baglantiyiKes();
}

/** Yerel mikrofonu aç/kapat (yayıncı token gerekir). */
export function MedyaMikrofonAyarla(acik: boolean) {
  LiveKitBaglantiYoneticisi.muteLocalAudio(!acik);
}

export function MedyaHoparlorAyarla(acik: boolean) {
  void LiveKitBaglantiYoneticisi.setSpeakerphone(acik);
}

/**
 * Dinleyici → konuşmacı: yeni token + yeniden bağlan.
 * Mikrofon kabulünden sonra çağır.
 */
export async function MedyaKonusmaciyaYukselt(
  roomName: string,
): Promise<MedyaBaglantiSonuc> {
  return MedyaOdasiBaglan({ roomName, role: 'speaker', zorla: true });
}

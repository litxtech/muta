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
  /** 1:1 görüşme — düşük çözünürlük, speech audio, az kasma */
  gorusmeModu?: boolean;
  /** true: aynı odaya zorla yeniden bağlan (rol yükseltme) */
  zorla?: boolean;
}): Promise<MedyaBaglantiSonuc> {
  const asPublisher =
    input.role === 'host' ||
    input.role === 'publisher' ||
    input.role === 'speaker';
  const publishVideo = !!input.video && asPublisher;
  /** Ses odası: dinleyici de OS mic izni — playAndRecord / inCommunication uzak ses için */
  const sesOdasi = !input.gorusmeModu && !input.video;

  // Ses odası dinleyici: izin var, yayın yok. Canlı video izleyici: izin yok.
  const izin = await MedyaIzinleriniIste({
    mikrofon: asPublisher || sesOdasi,
    kamera: publishVideo,
    amac: asPublisher ? 'yayin' : 'dinleme',
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
    gorusmeModu: !!input.gorusmeModu,
    /** video bayrağı yoksa ses odası — Android↔iOS communication profili */
    sesOdasi,
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

/**
 * Konuşmacı → dinleyici: yayın hakkını geri al.
 * Koltuktan düşünce / red sonrası çağır — mute yetmez, token canPublish kapatılmalı.
 */
export async function MedyaDinleyiciyeDusur(
  roomName: string,
): Promise<MedyaBaglantiSonuc> {
  return MedyaOdasiBaglan({ roomName, role: 'listener', zorla: true });
}

/**
 * Uzak ses hacmi (hoparlör) — mikrofon değil.
 * 0..1 sürekli seviye; boolean geriye uyum (true=1, false=0).
 */
export function MedyaUzakSesHacmiAyarla(hacim: number | boolean) {
  const v = typeof hacim === 'boolean' ? (hacim ? 1 : 0) : hacim;
  LiveKitBaglantiYoneticisi.setRemoteAudioVolume(v);
}

/**
 * Oyun çıkışı sonrası: expo-audio LiveKit oturumunu bozduysa yeniden aç.
 * zorla=true → tam AudioSession configure (oyun SFX sonrası şart).
 */
export function MedyaSesOturumunuYenile(zorla = false) {
  void LiveKitBaglantiYoneticisi.sesOturumunuYenile(zorla);
}

/** Bu oturumda mikrofon yayın hakkı var mı (host/konuşmacı ve bağlı). */
export function MedyaYayinciMi(): boolean {
  return LiveKitBaglantiYoneticisi.yayinciMi();
}

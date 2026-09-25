/**
 * Sesli mesaj kaydı — expo-audio AudioRecorder + dm-media upload.
 */
import {
  AudioModule,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import i18n from '../../../i18n';
import { DmSesMedyasiYukle } from '../islemler/DmMedyasiYukle';

type RecorderLike = InstanceType<typeof AudioModule.AudioRecorder>;

let recorder: RecorderLike | null = null;
let kayitBaslangicMs = 0;

export async function SesliMesajIzinIste(): Promise<boolean> {
  let perm = await getRecordingPermissionsAsync();
  if (!perm.granted) {
    perm = await requestRecordingPermissionsAsync();
  }
  return !!perm.granted;
}

export async function SesliMesajKayitBaslat(): Promise<
  { ok: true } | { ok: false; hata: string }
> {
  try {
    if (!(await SesliMesajIzinIste())) {
      return { ok: false, hata: i18n.t('mesajV2.micPermissionDenied') };
    }
    await SesliMesajKayitIptal();
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();
    kayitBaslangicMs = Date.now();
    return { ok: true };
  } catch (e) {
    recorder = null;
    return {
      ok: false,
      hata: e instanceof Error ? e.message : i18n.t('mesajV2.uploadFailedRetry'),
    };
  }
}

export function SesliMesajKayitSaniye(): number {
  if (!recorder?.isRecording && kayitBaslangicMs <= 0) return 0;
  if (recorder?.isRecording) {
    return Math.max(0, Number(recorder.currentTime ?? 0));
  }
  return Math.max(0, (Date.now() - kayitBaslangicMs) / 1000);
}

export function SesliMesajKayitDevamMi(): boolean {
  return !!recorder?.isRecording;
}

export async function SesliMesajKayitIptal(): Promise<void> {
  const r = recorder;
  recorder = null;
  kayitBaslangicMs = 0;
  if (!r) return;
  try {
    if (r.isRecording) await r.stop();
  } catch {
    /* noop */
  }
  try {
    await setAudioModeAsync({ allowsRecording: false });
  } catch {
    /* noop */
  }
}

export async function SesliMesajKayitBitir(): Promise<
  | { ok: true; uri: string; durationMs: number }
  | { ok: false; hata: string }
> {
  const r = recorder;
  recorder = null;
  if (!r) {
    return { ok: false, hata: i18n.t('mesajV2.uploadFailedRetry') };
  }
  try {
    const durationMs = Math.max(
      0,
      Math.round((Number(r.currentTime ?? 0) || (Date.now() - kayitBaslangicMs) / 1000) * 1000),
    );
    await r.stop();
    const uri = r.uri;
    kayitBaslangicMs = 0;
    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      /* noop */
    }
    if (!uri) {
      return { ok: false, hata: i18n.t('mesajV2.uploadFailedRetry') };
    }
    return { ok: true, uri, durationMs };
  } catch (e) {
    kayitBaslangicMs = 0;
    return {
      ok: false,
      hata: e instanceof Error ? e.message : i18n.t('mesajV2.uploadFailedRetry'),
    };
  }
}

/** Kayıt bitir + dm-media yükle */
export async function SesliMesajKaydetVeYukle(): Promise<
  | { ok: true; url: string; durationMs: number; mime: string }
  | { ok: false; hata: string }
> {
  const bitis = await SesliMesajKayitBitir();
  if (!bitis.ok) return bitis;
  const up = await DmSesMedyasiYukle(bitis.uri, {
    mime: 'audio/mp4',
    durationMs: bitis.durationMs,
  });
  if (!up.ok) return { ok: false, hata: up.hata };
  return {
    ok: true,
    url: up.url,
    durationMs: bitis.durationMs,
    mime: up.mime,
  };
}

import { Platform } from 'react-native';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Camera } from 'expo-camera';
import { UygulamaKimligi } from '../../../yapilandirma/UygulamaKimligi';

/**
 * Mikrofon (+ isteğe bağlı kamera) — RTC join öncesi.
 *
 * - Önce get* ile bak; zaten granted ise request çağırma (her girişte OS diyaloğu yok).
 * - Dinleyici (mikrofon:false) için mic izni istenmez — sadece yayıncıda gerekir.
 */
export async function MedyaIzinleriniIste(input?: {
  mikrofon?: boolean;
  kamera?: boolean;
}): Promise<{ ok: boolean; hata?: string }> {
  const mikrofonGerekli = input?.mikrofon !== false;

  try {
    if (mikrofonGerekli) {
      let mic = await getRecordingPermissionsAsync();
      if (!mic.granted) {
        mic = await requestRecordingPermissionsAsync();
      }
      if (!mic.granted) {
        return {
          ok: false,
          hata:
            Platform.OS === 'ios'
              ? `Mikrofon izni gerekli. Ayarlar → ${UygulamaKimligi.APP_NAME} → Mikrofon.`
              : 'Mikrofon izni gerekli.',
        };
      }
    }

    if (input?.kamera) {
      let cam = await Camera.getCameraPermissionsAsync();
      if (!cam.granted) {
        cam = await Camera.requestCameraPermissionsAsync();
      }
      if (!cam.granted) {
        return {
          ok: false,
          hata:
            Platform.OS === 'ios'
              ? `Kamera izni gerekli. Ayarlar → ${UygulamaKimligi.APP_NAME} → Kamera.`
              : 'Kamera izni gerekli.',
        };
      }
    }

    return { ok: true };
  } catch (e) {
    console.warn(
      '[MedyaIzin]',
      e instanceof Error ? e.message : 'izin kontrol edilemedi',
    );
    return {
      ok: false,
      hata: 'Medya izni kontrol edilemedi. Mikrofon/kamera izinlerini açıp tekrar dene.',
    };
  }
}

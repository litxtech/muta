import { Alert, Linking, Platform } from 'react-native';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Camera } from 'expo-camera';
import { UygulamaKimligi } from '../../../yapilandirma/UygulamaKimligi';

/**
 * Mikrofon (+ isteğe bağlı kamera) — RTC join öncesi.
 * WhatsApp tarzı: önce mevcut izin; yoksa request; reddedilirse Ayarlar'a yönlendir.
 *
 * Ses odası dinleyici de mic izni ister: iOS playAndRecord / Android
 * MODE_IN_COMMUNICATION uzak ses için OS izni şart — yayın açılmaz.
 */
export async function MedyaIzinleriniIste(input?: {
  mikrofon?: boolean;
  kamera?: boolean;
  /** true: reddedilince Ayarlar diyaloğu göster */
  ayarlarDiyalog?: boolean;
  /**
   * dinleme: konuşmadan odadakileri duymak (ses odası dinleyici)
   * yayin: mikrofon yayınlamak (host/koltuk/görüşme)
   */
  amac?: 'dinleme' | 'yayin';
}): Promise<{ ok: boolean; hata?: string }> {
  const mikrofonGerekli = input?.mikrofon !== false;
  const ayarlarDiyalog = input?.ayarlarDiyalog !== false;
  const dinleme = input?.amac === 'dinleme';

  try {
    if (mikrofonGerekli) {
      let mic = await getRecordingPermissionsAsync();
      if (!mic.granted) {
        mic = await requestRecordingPermissionsAsync();
      }
      if (!mic.granted) {
        const hata =
          Platform.OS === 'ios'
            ? `Mikrofon izni gerekli. Ayarlar → ${UygulamaKimligi.APP_NAME} → Mikrofon.`
            : 'Mikrofon izni gerekli. Ayarlar → Uygulamalar → İzinler → Mikrofon.';
        if (ayarlarDiyalog) {
          ayarlaraYonlendir(
            'Mikrofon izni',
            dinleme
              ? 'Odadakileri duymak için ses izni gerekli. Konuşmazsın; mikrofonun kapalı kalır. Ayarlardan açabilirsin.'
              : 'Konuşmak için mikrofon gerekli. Ayarlardan açabilirsin.',
          );
        }
        return { ok: false, hata };
      }
    }

    if (input?.kamera) {
      let cam = await Camera.getCameraPermissionsAsync();
      if (!cam.granted) {
        cam = await Camera.requestCameraPermissionsAsync();
      }
      if (!cam.granted) {
        const hata =
          Platform.OS === 'ios'
            ? `Kamera izni gerekli. Ayarlar → ${UygulamaKimligi.APP_NAME} → Kamera.`
            : 'Kamera izni gerekli. Ayarlar → Uygulamalar → İzinler → Kamera.';
        if (ayarlarDiyalog) {
          ayarlaraYonlendir(
            'Kamera izni',
            'Görüntülü arama için kamera gerekli. Ayarlardan açabilirsin.',
          );
        }
        return { ok: false, hata };
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

function ayarlaraYonlendir(baslik: string, mesaj: string) {
  Alert.alert(baslik, mesaj, [
    { text: 'Vazgeç', style: 'cancel' },
    {
      text: 'Ayarlar',
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

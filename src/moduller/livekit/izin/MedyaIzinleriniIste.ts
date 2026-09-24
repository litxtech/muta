import { Alert, Linking, Platform } from 'react-native';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Camera } from 'expo-camera';
import { UygulamaKimligi } from '../../../yapilandirma/UygulamaKimligi';
import i18n from '../../../i18n';

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
            ? i18n.t('medyaIzin.mikrofonHataIos', {
                app: UygulamaKimligi.APP_NAME,
              })
            : i18n.t('medyaIzin.mikrofonHataAndroid');
        if (ayarlarDiyalog) {
          ayarlaraYonlendir(
            i18n.t('medyaIzin.mikrofonBaslik'),
            dinleme
              ? i18n.t('medyaIzin.mikrofonDinleme')
              : i18n.t('medyaIzin.mikrofonYayin'),
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
            ? i18n.t('medyaIzin.kameraHataIos', {
                app: UygulamaKimligi.APP_NAME,
              })
            : i18n.t('medyaIzin.kameraHataAndroid');
        if (ayarlarDiyalog) {
          ayarlaraYonlendir(
            i18n.t('medyaIzin.kameraBaslik'),
            i18n.t('medyaIzin.kameraMesaj'),
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
      hata: i18n.t('medyaIzin.kontrolEdilemedi'),
    };
  }
}

function ayarlaraYonlendir(baslik: string, mesaj: string) {
  Alert.alert(baslik, mesaj, [
    { text: i18n.t('ortak.vazgec'), style: 'cancel' },
    {
      text: i18n.t('profil.ayarlar'),
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

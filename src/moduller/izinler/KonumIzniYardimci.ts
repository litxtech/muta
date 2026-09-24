/**
 * Konum izni yardımcıları.
 * Uygulamada şehir seçimi katalog tabanlıdır (GPS zorunlu değil).
 * GPS gereken özellik eklenirse bu modül üzerinden foreground izin istenir.
 */
import { Alert, Linking, Platform } from 'react-native';
import i18n from '../../i18n';
import { UygulamaKimligi } from '../../yapilandirma/UygulamaKimligi';

export async function UygulamaAyarlariniAc(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    Alert.alert(
      i18n.t('konumIzin.ayarlar') as string,
      Platform.OS === 'ios'
        ? (i18n.t('konumIzin.ayarlarYolIos', {
            app: UygulamaKimligi.APP_NAME,
          }) as string)
        : (i18n.t('konumIzin.ayarlarYolAndroid') as string),
    );
  }
}

/**
 * Konum izni reddedildiğinde gösterilecek standart UX.
 * Crash yok; manuel şehir seçimine yönlendir.
 */
export function KonumIzniReddedildiUyari(opts?: {
  manuelSehirHref?: string;
  onManuelSehir?: () => void;
}): void {
  Alert.alert(
    i18n.t('konumIzin.reddedildiBaslik') as string,
    i18n.t('konumIzin.reddedildiBody') as string,
    [
      { text: i18n.t('ortak.tamam') as string, style: 'cancel' },
      ...(opts?.onManuelSehir
        ? [
            {
              text: i18n.t('konumIzin.sehirSec') as string,
              onPress: opts.onManuelSehir,
            },
          ]
        : []),
      {
        text: i18n.t('konumIzin.ayarlariAc') as string,
        onPress: () => {
          void UygulamaAyarlariniAc();
        },
      },
    ],
  );
}

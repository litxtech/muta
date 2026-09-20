/**
 * Konum izni yardımcıları.
 * Uygulamada şehir seçimi katalog tabanlıdır (GPS zorunlu değil).
 * GPS gereken özellik eklenirse bu modül üzerinden foreground izin istenir.
 */
import { Alert, Linking, Platform } from 'react-native';

export async function UygulamaAyarlariniAc(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    Alert.alert(
      'Ayarlar',
      Platform.OS === 'ios'
        ? 'Ayarlar → Tamuso yolundan izinleri yönetebilirsin.'
        : 'Uygulama ayarlarından izinleri yönetebilirsin.',
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
    'Konum kullanılamıyor',
    'Konuma dayalı özellik için izin gerekli. İstersen şehrini manuel seçebilirsin.',
    [
      { text: 'Tamam', style: 'cancel' },
      ...(opts?.onManuelSehir
        ? [{ text: 'Şehir seç', onPress: opts.onManuelSehir }]
        : []),
      {
        text: 'Ayarları Aç',
        onPress: () => {
          void UygulamaAyarlariniAc();
        },
      },
    ],
  );
}

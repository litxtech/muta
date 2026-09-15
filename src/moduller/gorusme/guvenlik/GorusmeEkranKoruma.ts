import { Platform } from 'react-native';
import { GorusmeGuvenlikOlayi } from '../islemler/GorusmeIslemleri';

/**
 * Gorusme sirasinda ekran kaydi / screenshot engeli + tespit.
 * Native: expo-screen-capture. Expo Go'da kisitli olabilir.
 */
export async function GorusmeEkranKorumaBaslat(callId: string): Promise<() => void> {
  const temizleyiciler: Array<() => void> = [];

  try {
    const ScreenCapture = await import('expo-screen-capture');
    await ScreenCapture.preventScreenCaptureAsync();

    const sub = ScreenCapture.addScreenshotListener(() => {
      void GorusmeGuvenlikOlayi({
        callId,
        eventType: 'screenshot',
        platform: Platform.OS,
        details: {
          note: 'Ekran goruntusu girisimi tespit edildi',
          at: new Date().toISOString(),
        },
      }).catch(() => undefined);
    });
    temizleyiciler.push(() => sub.remove());
  } catch {
    void GorusmeGuvenlikOlayi({
      callId,
      eventType: 'capture_attempt',
      platform: Platform.OS,
      details: { note: 'Screen capture API kullanilamadi' },
    }).catch(() => undefined);
  }

  return () => {
    temizleyiciler.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    void import('expo-screen-capture')
      .then((m) => m.allowScreenCaptureAsync())
      .catch(() => undefined);
  };
}

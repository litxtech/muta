/**
 * WebRTC / LiveKit gürültülü DEBUG loglarını kapat (metro konsolu).
 * Uygulama açılışında bir kez çağır.
 */
export function LiveKitGurultuLoglariniKapat(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const debug = require('debug') as { disable?: () => void };
    debug.disable?.();
  } catch {
    /* debug yok */
  }

  try {
    // `require('livekit-client')` Metro'da CommonJS koşuluna düşüp UMD kopyasını
    // (≈580 KB) giriş paketine ekliyordu. Dinamik import aynı ESM modülünü
    // kullanır; paket zaten yüklüyse ek istek olmaz.
    void import('livekit-client')
      .then((lk) => {
        const seviye = lk.LogLevel?.warn ?? lk.LogLevel?.error;
        if (typeof lk.setLogLevel === 'function' && seviye != null) {
          lk.setLogLevel(seviye);
        }
      })
      .catch(() => undefined);
  } catch {
    /* livekit-client yok */
  }
}

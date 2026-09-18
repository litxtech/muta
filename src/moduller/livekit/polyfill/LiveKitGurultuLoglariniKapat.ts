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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lk = require('livekit-client') as {
      setLogLevel?: (level: unknown) => void;
      LogLevel?: { warn?: unknown; error?: unknown };
    };
    const seviye = lk.LogLevel?.warn ?? lk.LogLevel?.error;
    if (typeof lk.setLogLevel === 'function' && seviye != null) {
      lk.setLogLevel(seviye);
    }
  } catch {
    /* livekit-client yok */
  }
}

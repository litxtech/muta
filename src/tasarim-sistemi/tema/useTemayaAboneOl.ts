import { useSyncExternalStore } from 'react';
import { temaAboneOl, temaKodunuAl, type TemaKodu } from './TemaDurumu';

/** Bilesen tema degisince yeniden cizilsin (babel enjekte eder). */
export function useTemayaAboneOl(): TemaKodu {
  return useSyncExternalStore(temaAboneOl, temaKodunuAl, temaKodunuAl);
}

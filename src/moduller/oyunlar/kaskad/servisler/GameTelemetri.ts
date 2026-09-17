/**
 * GameTelemetri — hafif olay takibi.
 * RNG seed / sonuç içeriği gibi hassas veriler ASLA loglanmaz.
 */

import { GameLogger } from '../../cekirdek/OyunLogger';

export type KaskadTelemetryEvent =
  | 'game_open'
  | 'spin_request'
  | 'spin_success'
  | 'spin_error'
  | 'cascade'
  | 'bonus_trigger'
  | 'bonus_complete'
  | 'game_exit'
  | 'reconnect'
  | 'round_recovered';

export function trackKaskad(
  event: KaskadTelemetryEvent,
  meta?: Record<string, string | number | boolean>,
): void {
  if (__DEV__) {
    GameLogger.info(`kaskad.${event}`, meta);
  }
  // Production'da merkezi analytics'e bağlanacaksa tek nokta burasıdır.
}

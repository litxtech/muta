/**
 * NOX REELS — telemetri (hassas veri yok).
 */

export type SlotAnalyticsEvent =
  | 'slot_opened'
  | 'slot_closed'
  | 'slot_spin_requested'
  | 'slot_spin_completed'
  | 'slot_win'
  | 'slot_bonus_started'
  | 'slot_bonus_completed'
  | 'slot_error';

export function trackSlotEvent(
  event: SlotAnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug('[nox-analytics]', event, props ?? {});
  }
}

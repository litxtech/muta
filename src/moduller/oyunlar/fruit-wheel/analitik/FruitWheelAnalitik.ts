import { AnalyticsOlayEkle } from '../../../guvenlik/analytics/AnalyticsOlayEkle';

export function fruitWheelOlay(
  name:
    | 'fruit_wheel_open'
    | 'round_view'
    | 'selection_add'
    | 'selection_remove'
    | 'selection_confirm'
    | 'round_locked'
    | 'spin_started'
    | 'result_shown'
    | 'settlement_displayed'
    | 'history_open'
    | 'rules_open'
    | 'game_exit'
    | 'recover_round'
    | 'purchased_consent_required'
    | 'purchased_consent_given'
    | 'game_error',
  props?: Record<string, unknown>,
): void {
  void AnalyticsOlayEkle(name, props);
}

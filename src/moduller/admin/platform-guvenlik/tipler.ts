export type PlatformGuvenlikUyari = {
  id: string;
  alert_type: string;
  severity: string;
  status: string;
  new_user_id: string | null;
  matched_user_id: string | null;
  device_id: string | null;
  email_new: string | null;
  email_matched: string | null;
  match_score: number | null;
  match_reasons: string[] | unknown;
  metadata: Record<string, unknown> | null;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  new_display_name?: string | null;
  new_username?: string | null;
  matched_display_name?: string | null;
  matched_username?: string | null;
};

export type PlatformGuvenlikDetay = {
  ok: boolean;
  hata?: string;
  alert?: PlatformGuvenlikUyari;
  logs?: Array<{
    id: string;
    event_type: string;
    severity: string;
    device_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  tombstones?: Array<Record<string, unknown>>;
  binding?: Record<string, unknown> | null;
  device_sessions?: Array<Record<string, unknown>>;
};

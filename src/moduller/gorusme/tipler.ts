export type GorusmeTuru = 'audio' | 'video';

export type GorusmeDurumu =
  | 'ringing'
  | 'active'
  | 'ended'
  | 'rejected'
  | 'missed'
  | 'cancelled';

export type DirectCall = {
  id: string;
  thread_id: string;
  caller_id: string;
  callee_id: string;
  call_type: GorusmeTuru;
  status: GorusmeDurumu;
  channel_name: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
  end_reason: string | null;
  /** People discovery paid calling */
  is_paid?: boolean;
  price_per_minute_snapshot?: number | null;
  billing_status?: string | null;
};

export type ThreadKarsiProfil = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  public_user_id: string | null;
  is_verified?: boolean;
  is_platform_official?: boolean;
  is_platform_yargic?: boolean;
  thread_kind?: 'dm' | 'mahkeme' | string;
  thread_title?: string | null;
  closed_at?: string | null;
  dispute_id?: string | null;
  dispute_status?: string | null;
  offer_id?: string | null;
  yargic_id?: string | null;
  can_moderate?: boolean;
  peer_agency_id?: string | null;
  agency_name?: string | null;
  agency_logo_url?: string | null;
  uyeler?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    public_user_id: string | null;
    is_verified?: boolean;
    is_platform_official?: boolean;
    is_platform_yargic?: boolean;
    rol?: string;
  }[];
};

export type CallSecurityEvent = {
  id: string;
  call_id: string | null;
  user_id: string;
  peer_id: string | null;
  thread_id: string | null;
  event_type: string;
  platform: string | null;
  call_type: string | null;
  call_status: string | null;
  details: Record<string, unknown>;
  admin_seen: boolean;
  warning_sent_at: string | null;
  warning_message: string | null;
  created_at: string;
  user_name: string;
  peer_name: string;
};

/** Paylaşılan durum (shared_post) tipleri — içerik snapshot yok. */

export type PaylasilanDurumAvailability =
  | 'AVAILABLE'
  | 'DELETED_BY_OWNER'
  | 'REMOVED_BY_PLATFORM'
  | 'NOT_AVAILABLE'
  | 'PERMISSION_DENIED';

export type PaylasilanDurumOnizleme = {
  status_id: string;
  availability: PaylasilanDurumAvailability;
  message?: string;
  user_id?: string;
  media_type?: 'image' | 'video' | 'card' | 'text' | string;
  media_url?: string;
  caption?: string | null;
  post_kind?: string;
  payload?: Record<string, unknown> | null;
  created_at?: string;
  display_name?: string;
  username?: string | null;
  avatar_url?: string | null;
  public_user_id?: string | null;
};

export type GonderiPaylasAlici = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  /** Son konuşma thread'i (varsa) */
  thread_id?: string | null;
};

export type GonderiPaylasSonuc = {
  ok: boolean;
  sent_count: number;
  fail_count: number;
  hata?: string;
  results?: Array<{
    ok: boolean;
    recipient_id: string;
    thread_id?: string;
    message_id?: string;
    deduped?: boolean;
    error?: string;
  }>;
};

export function PaylasilanDurumMesaji(
  availability: PaylasilanDurumAvailability,
  fallback?: string | null,
): string {
  if (fallback && fallback.trim()) return fallback.trim();
  switch (availability) {
    case 'DELETED_BY_OWNER':
      return 'Bu gönderi sahibi tarafından silindi.';
    case 'REMOVED_BY_PLATFORM':
      return 'Bu içerik platform tarafından kaldırıldı.';
    case 'PERMISSION_DENIED':
      return 'Bu gönderiyi görüntüleyemezsiniz.';
    case 'NOT_AVAILABLE':
    default:
      return 'Bu gönderiye artık ulaşılamıyor.';
  }
}

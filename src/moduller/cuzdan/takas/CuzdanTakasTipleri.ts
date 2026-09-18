/** Sabit cüzdan markası — uygulama adından bağımsız */
export const CUZDAN_MARKA_ADI = 'MUTA PAY';

export type WalletAccount = {
  user_id: string;
  wallet_number: string;
  wallet_brand_name: string;
  legal_first_name: string | null;
  legal_last_name: string | null;
  kyc_status: 'none' | 'pending' | 'approved' | 'rejected';
};

export type CoinTradeOffer = {
  id: string;
  seller_id: string;
  buyer_type: 'user' | 'agency';
  buyer_user_id: string | null;
  buyer_agency_id: string | null;
  coins: number;
  note: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  buyer_approved_at?: string | null;
  payment_coins_bought?: number | null;
  payment_source?: string | null;
  payment_info_at?: string | null;
  receipt_path?: string | null;
  receipt_uploaded_at?: string | null;
  receipt_deadline_at?: string | null;
  receipt_warning_sent_at?: string | null;
  escalated_to_admin_at?: string | null;
  platform_approved_at?: string | null;
  completed_at?: string | null;
};

export const TAKAS_DURUM_ETIKET: Record<string, string> = {
  pending_buyer: 'Alıcı yanıtı bekleniyor',
  pending_payment_info: 'Ödeme bilgisi bekleniyor',
  pending_receipt: 'Dekont bekleniyor (1 gün)',
  receipt_overdue: 'Dekont süresi aşıldı — admin',
  pending_platform: 'Platform onayı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  rejected: 'Reddedildi',
  expired: 'Süresi doldu',
};

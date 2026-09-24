import i18n from '../../../i18n';

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
  /** Teklif anında kilitlenen katalog TL */
  katalog_tl?: number | string | null;
  satici_net_tl?: number | string | null;
  platform_pay_tl?: number | string | null;
  odeme_pencere?: string | null;
};

const TAKAS_DURUM_ANAHTAR: Record<string, string> = {
  pending_buyer: 'takas.durumPendingBuyer',
  pending_payment_info: 'takas.durumPendingPayment',
  pending_receipt: 'takas.durumPendingReceipt',
  receipt_overdue: 'takas.durumReceiptOverdue',
  pending_platform: 'takas.durumPendingPlatform',
  completed: 'takas.durumCompleted',
  cancelled: 'takas.durumCancelled',
  rejected: 'takas.durumRejected',
  expired: 'takas.durumExpired',
};

/** Canlı dil — `etiket[status]` okuması her seferinde i18n.t çağırır */
export const TAKAS_DURUM_ETIKET: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  {
    get(_target, status: string | symbol) {
      if (typeof status !== 'string') return undefined;
      const key = TAKAS_DURUM_ANAHTAR[status];
      return key ? (i18n.t(key) as string) : undefined;
    },
    has(_target, status: string | symbol) {
      return typeof status === 'string' && status in TAKAS_DURUM_ANAHTAR;
    },
    ownKeys() {
      return Object.keys(TAKAS_DURUM_ANAHTAR);
    },
    getOwnPropertyDescriptor(_target, status) {
      if (typeof status === 'string' && status in TAKAS_DURUM_ANAHTAR) {
        return { enumerable: true, configurable: true };
      }
      return undefined;
    },
  },
);

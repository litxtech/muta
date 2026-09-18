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
};

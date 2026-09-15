import { supabase } from '../../../lib/supabase';

export type CiroDonem = 'today' | 'week' | 'month' | 'all';

export type CiroMetrik = {
  try: number;
  coins: number;
  adet: number;
};

export type AdminCiroIslem = {
  id: string;
  user_id: string;
  coins_added: number;
  amount_try: number;
  amount_usd: number | null;
  provider: string | null;
  status: string;
  created_at: string;
  display_name: string;
  username: string | null;
  public_user_id: string | null;
  avatar_url: string | null;
  package_title: string | null;
};

export type AdminCiroKimden = {
  user_id: string;
  display_name: string;
  username: string | null;
  public_user_id: string | null;
  avatar_url: string | null;
  toplam_try: number;
  toplam_coin: number;
  islem_adet: number;
  son_yukleme: string | null;
};

export type AdminCiroOzeti = {
  ok: boolean;
  period: CiroDonem;
  period_start: string;
  generated_at: string;
  ozet: {
    today: CiroMetrik;
    week: CiroMetrik;
    month: CiroMetrik;
    all: CiroMetrik;
  };
  islemler: AdminCiroIslem[];
  kimden: AdminCiroKimden[];
};

function sayi(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function metrik(raw: any): CiroMetrik {
  return {
    try: sayi(raw?.try),
    coins: sayi(raw?.coins),
    adet: sayi(raw?.adet),
  };
}

export async function AdminCiroOzetiGetir(
  period: CiroDonem = 'today',
  limit = 80,
): Promise<AdminCiroOzeti> {
  const { data, error } = await supabase.rpc('admin_ciro_ozeti', {
    p_period: period,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const row = data as any;
  return {
    ok: !!row?.ok,
    period: (row?.period as CiroDonem) ?? period,
    period_start: String(row?.period_start ?? ''),
    generated_at: String(row?.generated_at ?? new Date().toISOString()),
    ozet: {
      today: metrik(row?.ozet?.today),
      week: metrik(row?.ozet?.week),
      month: metrik(row?.ozet?.month),
      all: metrik(row?.ozet?.all),
    },
    islemler: Array.isArray(row?.islemler) ? row.islemler : [],
    kimden: Array.isArray(row?.kimden) ? row.kimden : [],
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../lib/supabase';
import { DEFAULT_CUZDAN_UI_CONFIG } from './CuzdanUiVarsayilan';
import { CuzdanUiNormalize } from './CuzdanUiNormalize';
import type { CuzdanUiCanliYanit, CuzdanUiPayload } from './CuzdanUiTipleri';

const CACHE_KEY = 'cuzdan_ui_live_v1';

export async function CuzdanUiCanliGetir(): Promise<CuzdanUiCanliYanit> {
  try {
    const { data, error } = await supabase.rpc('wallet_ui_canli_getir');
    if (error) throw error;
    const row = data as {
      ok?: boolean;
      source?: string;
      version_no?: number;
      version_id?: string;
      published_at?: string;
      label?: string;
      payload?: unknown;
    };
    const payload = CuzdanUiNormalize(row?.payload);
    const sonuc: CuzdanUiCanliYanit = {
      ok: true,
      source: (row?.source as CuzdanUiCanliYanit['source']) || 'live',
      version_no: Number(row?.version_no ?? 0),
      version_id: row?.version_id ?? null,
      published_at: row?.published_at ?? null,
      label: row?.label ?? null,
      payload,
    };
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(sonuc)).catch(() => undefined);
    return sonuc;
  } catch {
    const cached = await CuzdanUiCacheOku();
    if (cached) return { ...cached, source: 'cache' };
    return {
      ok: true,
      source: 'default',
      version_no: 0,
      payload: DEFAULT_CUZDAN_UI_CONFIG,
    };
  }
}

export async function CuzdanUiCacheOku(): Promise<CuzdanUiCanliYanit | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CuzdanUiCanliYanit;
    return {
      ...parsed,
      payload: CuzdanUiNormalize(parsed.payload),
      source: 'cache',
      ok: true,
    };
  } catch {
    return null;
  }
}

export function CuzdanUiCanliDinle(onChange: () => void): () => void {
  const ch = supabase
    .channel('wallet-ui-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wallet_ui_live' },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(ch);
  };
}

export async function AdminCuzdanUiTaslakGetir(): Promise<{
  version_id: string;
  version_no: number;
  payload: CuzdanUiPayload;
  label?: string | null;
}> {
  const { data, error } = await supabase.rpc('admin_wallet_ui_taslak_getir');
  if (error) throw new Error(error.message);
  const row = data as {
    version_id: string;
    version_no: number;
    payload: unknown;
    label?: string;
  };
  return {
    version_id: row.version_id,
    version_no: row.version_no,
    label: row.label,
    payload: CuzdanUiNormalize(row.payload),
  };
}

export async function AdminCuzdanUiTaslakKaydet(
  payload: CuzdanUiPayload,
  label?: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_wallet_ui_taslak_kaydet', {
    p_payload: payload,
    p_label: label ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function AdminCuzdanUiYayinla(label?: string): Promise<{
  published_version_no: number;
}> {
  const { data, error } = await supabase.rpc('admin_wallet_ui_yayinla', {
    p_label: label ?? null,
  });
  if (error) throw new Error(error.message);
  const row = data as { published_version_no?: number };
  return { published_version_no: Number(row?.published_version_no ?? 0) };
}

export async function AdminCuzdanUiGeriAl(): Promise<{ version_no: number }> {
  const { data, error } = await supabase.rpc('admin_wallet_ui_geri_al');
  if (error) throw new Error(error.message);
  const row = data as { version_no?: number };
  return { version_no: Number(row?.version_no ?? 0) };
}

export async function AdminCuzdanUiSurumler(limit = 30) {
  const { data, error } = await supabase.rpc('admin_wallet_ui_surumler', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data as Array<Record<string, unknown>>) ?? [];
}

export async function AdminCuzdanUiAudit(limit = 50) {
  const { data, error } = await supabase.rpc('admin_wallet_ui_audit', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data as Array<Record<string, unknown>>) ?? [];
}

import { supabase } from '../../../lib/supabase';
import type { AppPaylasimLinki } from '../tipler';

export async function AktifPaylasimLinkleriniGetir(): Promise<AppPaylasimLinki[]> {
  const { data, error } = await supabase.rpc('aktif_paylasim_linklerini_getir');
  if (error) {
    // RPC yoksa tabloya düş
    const { data: rows, error: e2 } = await supabase
      .from('app_share_links')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (e2) throw e2;
    return (rows ?? []) as AppPaylasimLinki[];
  }
  return (data ?? []) as AppPaylasimLinki[];
}

/** Admin: tüm linkler (pasif dahil) */
export async function TumPaylasimLinkleriniGetir(): Promise<AppPaylasimLinki[]> {
  const { data, error } = await supabase
    .from('app_share_links')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppPaylasimLinki[];
}

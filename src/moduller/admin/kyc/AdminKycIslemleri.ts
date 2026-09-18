import { supabase } from '../../../lib/supabase';

export type AdminKycBasvuru = {
  id: string;
  user_id: string;
  status: string;
  doc_type: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  hometown: string | null;
  phone_e164: string | null;
  email: string | null;
  country: string | null;
  nationality: string | null;
  doc_front_path: string;
  doc_back_path: string | null;
  selfie_path: string;
  liveness_passed: boolean;
  admin_note: string | null;
  created_at: string;
  profiles?: {
    display_name: string | null;
    username: string | null;
  } | null;
};

export async function AdminKycListesi(
  limit = 40,
): Promise<AdminKycBasvuru[]> {
  const { data, error } = await supabase
    .from('kyc_applications')
    .select(
      '*, profiles:user_id(display_name, username)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AdminKycBasvuru[]) ?? [];
}

export async function AdminKycDurumGuncelle(
  id: string,
  status: 'approved' | 'rejected',
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_kyc_durum_guncelle', {
    p_id: id,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function AdminKycBelgeUrl(
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('kyc-docs')
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

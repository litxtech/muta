import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { DepoyaMedyaYukle } from '../../../ortak/medya/DepoyaMedyaYukle';
import type { PolitikaKayit } from '../../politikalar/tipler/PolitikaTipleri';

const BUCKET = 'policy-media';

export async function AdminPolitikaListele(): Promise<PolitikaKayit[]> {
  const { data, error } = await supabase.rpc('admin_politika_listele');
  if (error) throw new Error(error.message);
  return (data as PolitikaKayit[]) ?? [];
}

export async function AdminPolitikaOlustur(input: {
  title: string;
  code?: string | null;
  description?: string | null;
  linkLabel?: string | null;
  consentLabel?: string | null;
  showOnRegister?: boolean;
  showOnLogin?: boolean;
  isRequired?: boolean;
  bodyMd?: string;
}): Promise<PolitikaKayit> {
  const { data, error } = await supabase.rpc('admin_politika_olustur', {
    p_title: input.title,
    p_code: input.code ?? null,
    p_description: input.description ?? null,
    p_link_label: input.linkLabel ?? null,
    p_consent_label: input.consentLabel ?? null,
    p_show_on_register: input.showOnRegister ?? false,
    p_show_on_login: input.showOnLogin ?? false,
    p_is_required: input.isRequired ?? true,
    p_body_md: input.bodyMd ?? '',
  });
  if (error) throw new Error(error.message);
  return data as PolitikaKayit;
}

export async function AdminPolitikaGuncelle(input: {
  code: string;
  title?: string | null;
  description?: string | null;
  linkLabel?: string | null;
  consentLabel?: string | null;
  showOnRegister?: boolean | null;
  showOnLogin?: boolean | null;
  isRequired?: boolean | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
  bodyMd?: string | null;
  yeniSurum?: boolean;
}): Promise<PolitikaKayit> {
  const { data, error } = await supabase.rpc('admin_politika_guncelle', {
    p_code: input.code,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_link_label: input.linkLabel ?? null,
    p_consent_label: input.consentLabel ?? null,
    p_show_on_register: input.showOnRegister ?? null,
    p_show_on_login: input.showOnLogin ?? null,
    p_is_required: input.isRequired ?? null,
    p_is_active: input.isActive ?? null,
    p_sort_order: input.sortOrder ?? null,
    p_body_md: input.bodyMd ?? null,
    p_yeni_surum: input.yeniSurum ?? true,
  });
  if (error) throw new Error(error.message);
  return data as PolitikaKayit;
}

export async function AdminPolitikaSil(code: string): Promise<void> {
  const { error } = await supabase.rpc('admin_politika_sil', { p_code: code });
  if (error) throw new Error(error.message);
}

export async function AdminPolitikaGorselSecVeYukle(
  policyCode: string,
): Promise<string> {
  const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!izin.granted) {
    throw new Error('Galeri izni gerekli');
  }
  const sec = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (sec.canceled || !sec.assets?.[0]?.uri) {
    throw new Error('İptal');
  }
  const asset = sec.assets[0];
  const ext =
    asset.uri.split('.').pop()?.toLowerCase()?.replace(/\?.*/, '') || 'jpg';
  const path = `${policyCode}/${Date.now()}.${ext === 'heic' ? 'jpg' : ext}`;
  const result = await DepoyaMedyaYukle(supabase, {
    bucket: BUCKET,
    path,
    uri: asset.uri,
    mime: asset.mimeType,
    tur: 'image',
    upsert: false,
  });
  if (!result.ok) throw new Error(result.hata);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(result.path);
  return data.publicUrl;
}

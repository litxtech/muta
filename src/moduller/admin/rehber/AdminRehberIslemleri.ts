import { Linking, Platform } from 'react-native';
import { supabase } from '../../../lib/supabase';
import type { AdminRehberKisi } from './tipler';

export async function AdminRehberListesiGetir(
  q?: string,
  limit = 300,
): Promise<AdminRehberKisi[]> {
  const { data, error } = await supabase.rpc('admin_rehber_listesi', {
    p_q: q?.trim() || null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as AdminRehberKisi[];
}

export function RehberGorunenAd(kisi: AdminRehberKisi): string {
  return (
    kisi.display_name?.trim() ||
    kisi.username?.trim() ||
    kisi.email?.split('@')[0] ||
    'Kullanıcı'
  );
}

export function RehberBasHarf(kisi: AdminRehberKisi): string {
  const ad = RehberGorunenAd(kisi);
  const ch = ad.charAt(0).toLocaleUpperCase('tr-TR');
  if (/[A-ZÇĞİÖŞÜI]/.test(ch)) return ch;
  if (/[0-9]/.test(ch)) return '#';
  return '#';
}

export function RehberTelefonRakam(telefon?: string | null): string {
  return (telefon ?? '').replace(/[^\d]/g, '');
}

export async function RehberWhatsAppAc(
  telefon?: string | null,
  mesaj?: string,
): Promise<{ ok: boolean; hata?: string }> {
  const tel = RehberTelefonRakam(telefon);
  if (!tel) return { ok: false, hata: 'Telefon numarası yok' };
  const q = mesaj ? `?text=${encodeURIComponent(mesaj)}` : '';
  const url = `https://wa.me/${tel}${q}`;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'WhatsApp açılamadı',
    };
  }
}

export async function RehberMailAc(
  email?: string | null,
  konu?: string,
): Promise<{ ok: boolean; hata?: string }> {
  const eposta = (email ?? '').trim();
  if (!eposta) return { ok: false, hata: 'E-posta yok' };
  const subject = konu
    ? `?subject=${encodeURIComponent(konu)}`
    : '';
  try {
    await Linking.openURL(`mailto:${eposta}${subject}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'Mail açılamadı',
    };
  }
}

export async function RehberAraAc(
  telefon?: string | null,
): Promise<{ ok: boolean; hata?: string }> {
  const tel = (telefon ?? '').trim();
  if (!tel) return { ok: false, hata: 'Telefon numarası yok' };
  try {
    await Linking.openURL(`tel:${tel}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'Arama açılamadı',
    };
  }
}

export async function RehberSmsAc(
  telefon?: string | null,
): Promise<{ ok: boolean; hata?: string }> {
  const tel = (telefon ?? '').trim();
  if (!tel) return { ok: false, hata: 'Telefon numarası yok' };
  const url = Platform.select({
    ios: `sms:${tel}`,
    default: `sms:${tel}`,
  })!;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'SMS açılamadı',
    };
  }
}

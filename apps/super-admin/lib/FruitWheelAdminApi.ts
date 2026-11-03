/**
 * Meyve Çarkı personel RPC'leri — YALNIZCA web yönetim konsolunda kullanılır.
 *
 * Bu dosya `apps/super-admin` içinde tutulur; mobil uygulama hiçbir zaman
 * import etmez. Böylece iOS/Android binary'sinde personel RPC adları görünmez
 * (Guideline 2.5.19).
 *
 * ÖNEMLİ: Sonuç belirleme (force_next), ağırlık/çarpan yayınlama ve politika
 * yazma uçları kaldırıldı. Çark sonucu sunucudaki RNG ile üretilir; personel
 * paneli sonucu seçemez. Panel yalnızca okuma, bakım aç/kapat ve denetim izleme
 * yapar.
 */
import { supabase } from '../../../src/lib/supabase';

export async function fruitWheelAdminDashboard(): Promise<unknown> {
  const { data, error } = await supabase.rpc('fruit_wheel_admin_dashboard');
  if (error) return { ok: false, code: error.message };
  return data;
}

export async function fruitWheelAdminMath(): Promise<unknown> {
  const { data, error } = await supabase.rpc('fruit_wheel_admin_math');
  if (error) return { ok: false, code: error.message };
  return data;
}

/** Yalnızca bakım modu: oyunu kapatır/açar. Sonucu değiştirmez. */
export async function fruitWheelAdminSetEnabled(enabled: boolean): Promise<unknown> {
  const { data, error } = await supabase.rpc('fruit_wheel_admin_set_enabled', {
    p_enabled: enabled,
  });
  if (error) return { ok: false, code: error.message };
  return data;
}

export async function fruitWheelAdminAudit(): Promise<unknown> {
  const { data, error } = await supabase.rpc('fruit_wheel_admin_audit', { p_limit: 30 });
  if (error) return { ok: false, code: error.message };
  return data;
}

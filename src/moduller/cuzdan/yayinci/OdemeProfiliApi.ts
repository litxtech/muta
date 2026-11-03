/**
 * Yayıncı ödeme profili — tek yer: ülke, ad, telefon, vergi no, şirket beyanı,
 * banka talimatı ve vergi/şirket evrakları.
 *
 * Belgeler sunucuda sürümlenir ve SİLİNEMEZ; bu istemci yalnızca yeni sürüm
 * yükler. Tüm doğrulama `yayinci_odeme_profili_kaydet` /
 * `yayinci_odeme_belgesi_kaydet` RPC'lerindedir.
 */
import { supabase } from '../../../lib/supabase';
import { YerelDosyayiBaytOku } from '../../../ortak/medya/DepoyaMedyaYukle';
import { sunucuHataKodu } from './YayinciKazancApi';
import { BelgeMimeTipi, BelgeUzantisi, OdemeProfiliVerisiCoz } from './OdemeProfiliYardimcilari';
import {
  ODEME_BELGE_KOVASI,
  ODEME_BELGE_MAX_BAYT,
  type BelgeYukleGirdisi,
  type OdemeBelgeTuru,
  type OdemeIslemSonucu,
  type OdemeProfiliBelgesi,
  type OdemeProfiliGirdisi,
  type OdemeProfiliVerisi,
} from './OdemeProfiliApiTipleri';

export {
  BelgeMimeTipi,
  BelgeUzantisi,
  GecerliEksikler,
  OdemeProfiliVerisiCoz,
} from './OdemeProfiliYardimcilari';
export {
  ODEME_BELGE_KOVASI,
  ODEME_BELGE_MAX_BAYT,
  ODEME_PROFILI_HREF,
} from './OdemeProfiliApiTipleri';
export type {
  BelgeYukleGirdisi,
  OdemeBankaOzeti,
  OdemeBelgeDurumu,
  OdemeBelgeTuru,
  OdemeIslemSonucu,
  OdemeProfiliBelgesi,
  OdemeProfiliDurumu,
  OdemeProfiliEksigi,
  OdemeProfiliGirdisi,
  OdemeProfiliKaydi,
  OdemeProfiliVerisi,
} from './OdemeProfiliApiTipleri';

function asObj(data: unknown): Record<string, any> {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, any>)
    : {};
}

function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function OdemeProfiliGetir(): Promise<OdemeProfiliVerisi> {
  const { data, error } = await supabase.rpc('yayinci_odeme_profilim');
  if (error) throw new Error(sunucuHataKodu(error));
  return OdemeProfiliVerisiCoz(data);
}

export async function OdemeProfiliKaydet(
  girdi: OdemeProfiliGirdisi,
): Promise<OdemeIslemSonucu<OdemeProfiliVerisi>> {
  try {
    const { data, error } = await supabase.rpc('yayinci_odeme_profili_kaydet', {
      p_country_code: girdi.countryCode.trim().toUpperCase(),
      p_legal_first_name: girdi.firstName.trim(),
      p_legal_last_name: girdi.lastName.trim(),
      p_phone: girdi.phone.trim(),
      p_tax_number: girdi.taxNumber?.trim() || null,
      p_tax_office: girdi.taxOffice?.trim() || null,
      p_has_company: girdi.hasCompany,
      p_company_name: girdi.hasCompany ? girdi.companyName?.trim() || null : null,
      p_company_tax_number: girdi.hasCompany
        ? girdi.companyTaxNumber?.trim().toUpperCase() || null
        : null,
      p_company_country_code: girdi.hasCompany
        ? girdi.companyCountryCode?.trim().toUpperCase() || null
        : null,
      p_phone_country_code: girdi.phoneCountryCode?.trim() || null,
    });
    if (error) {
      return { ok: false, kod: sunucuHataKodu(error), hata: error.message };
    }
    return { ok: true, veri: OdemeProfiliVerisiCoz(data) };
  } catch (e) {
    return { ok: false, kod: 'rpc_error', hata: e instanceof Error ? e.message : undefined };
  }
}

export async function OdemeBelgeleriniGetir(): Promise<OdemeProfiliBelgesi[]> {
  const { data, error } = await supabase.rpc('yayinci_odeme_belgelerim');
  if (error) throw new Error(sunucuHataKodu(error));
  return asList<OdemeProfiliBelgesi>(data);
}

/**
 * Önce özel kovaya yükler, sonra sürüm satırını RPC ile kaydeder.
 * Aynı türden yeni yükleme eskisini silmez; sunucu version = max + 1 atar.
 */
export async function OdemeBelgesiYukle(
  girdi: BelgeYukleGirdisi,
): Promise<OdemeIslemSonucu<{ id: string; version: number; doc_type: OdemeBelgeTuru }>> {
  try {
    const { data: oturum } = await supabase.auth.getUser();
    const uid = oturum?.user?.id;
    if (!uid) return { ok: false, kod: 'Not authenticated' };

    if (girdi.byteSize != null && girdi.byteSize > ODEME_BELGE_MAX_BAYT) {
      return { ok: false, kod: 'invalid_file_size' };
    }

    const uzanti = BelgeUzantisi(girdi.dosyaAdi || girdi.uri, girdi.mime);
    const mime = BelgeMimeTipi(girdi.mime, uzanti);
    const yol = `${uid}/${girdi.tur}-${Date.now()}.${uzanti}`;

    const bayt = await YerelDosyayiBaytOku(girdi.uri);
    if (bayt.byteLength === 0) return { ok: false, kod: 'empty_file' };
    if (bayt.byteLength > ODEME_BELGE_MAX_BAYT) {
      return { ok: false, kod: 'invalid_file_size' };
    }

    const yukleme = await supabase.storage
      .from(ODEME_BELGE_KOVASI)
      .upload(yol, bayt, { contentType: mime, upsert: false });

    if (yukleme.error) {
      return { ok: false, kod: 'upload_failed', hata: yukleme.error.message };
    }

    const { data, error } = await supabase.rpc('yayinci_odeme_belgesi_kaydet', {
      p_doc_type: girdi.tur,
      p_storage_path: yol,
      p_mime: mime,
      p_file_name: girdi.dosyaAdi || null,
      p_byte_size: bayt.byteLength,
    });

    if (error) {
      return { ok: false, kod: sunucuHataKodu(error), hata: error.message };
    }

    const d = asObj(data);
    return {
      ok: true,
      veri: {
        id: String(d.id ?? ''),
        version: Number(d.version ?? 0),
        doc_type: (d.doc_type ?? girdi.tur) as OdemeBelgeTuru,
      },
    };
  } catch (e) {
    return { ok: false, kod: 'upload_failed', hata: e instanceof Error ? e.message : undefined };
  }
}

/** İstemci kapısı için: profil tamamsa true. RPC yoksa null (kapı uygulanmaz). */
export async function OdemeProfiliTamamMi(): Promise<boolean | null> {
  try {
    const v = await OdemeProfiliGetir();
    return v.tamam;
  } catch {
    return null;
  }
}

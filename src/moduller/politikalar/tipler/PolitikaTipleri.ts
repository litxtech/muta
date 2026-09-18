/** Politika CMS tipleri — DB + UI ortak. */

export type PolitikaKayit = {
  code: string;
  title: string;
  description: string | null;
  is_required: boolean;
  is_active: boolean;
  link_label: string | null;
  consent_label: string | null;
  show_on_register: boolean;
  show_on_login: boolean;
  sort_order: number;
  version_id?: string | null;
  version?: number | null;
  body_md?: string | null;
  published_at?: string | null;
  body_len?: number | null;
  created_at?: string;
  updated_at?: string;
};

/** UI okuma modeli (eski PolitikaTanimi uyumlu). */
export type PolitikaGorunum = {
  kod: string;
  baslik: string;
  kisa: string;
  onayEtiketi: string;
  linkEtiketi: string;
  govde: string;
  versionId?: string | null;
};

export function PolitikaKayittanGorunum(p: PolitikaKayit): PolitikaGorunum {
  return {
    kod: p.code,
    baslik: p.title,
    kisa: p.description?.trim() || '',
    onayEtiketi:
      p.consent_label?.trim() ||
      `${p.title} metnini okudum ve kabul ediyorum`,
    linkEtiketi: p.link_label?.trim() || p.title,
    govde: p.body_md ?? '',
    versionId: p.version_id ?? null,
  };
}

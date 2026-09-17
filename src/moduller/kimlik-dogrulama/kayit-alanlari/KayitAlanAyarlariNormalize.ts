import type {
  KayitAlanAyarlari,
  KayitAlanModu,
  KayitOzelAlan,
  KayitOzelAlanTuru,
  YerlesikKayitAlani,
} from './tipler';
import {
  VARSAYILAN_KAYIT_ALANLARI,
  VARSAYILAN_KAYIT_ALAN_AYARLARI,
} from './tipler';

const YERLESIK: YerlesikKayitAlani[] = [
  'phone',
  'gender',
  'birth_date',
  'email',
  'avatar',
];

function modNormalize(raw: unknown): KayitAlanModu {
  const m = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (m === 'required' || m === 'hidden' || m === 'optional') return m;
  return 'optional';
}

function seceneklerNormalize(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x ?? '').trim())
    .filter((x) => x.length > 0);
}

function ozelAlanNormalize(raw: unknown): KayitOzelAlan | null {
  const r = (raw ?? {}) as Partial<KayitOzelAlan> & {
    alan_turu?: string;
    mod?: string;
  };
  if (!r.id || !r.anahtar || !r.etiket) return null;
  const tur = (r.alan_turu ?? 'text') as KayitOzelAlanTuru;
  const alan_turu: KayitOzelAlanTuru =
    tur === 'select' || tur === 'number' ? tur : 'text';
  const mod = r.mod === 'required' ? 'required' : 'optional';
  return {
    id: String(r.id),
    anahtar: String(r.anahtar),
    etiket: String(r.etiket),
    alan_turu,
    secenekler: seceneklerNormalize(r.secenekler),
    mod,
    sira: Number(r.sira ?? 0),
    aktif: r.aktif !== false,
    created_at: r.created_at,
  };
}

export function KayitAlanAyarlariNormalize(raw: unknown): KayitAlanAyarlari {
  const payload = (raw ?? {}) as {
    alanlar?: Partial<Record<YerlesikKayitAlani, unknown>>;
    ozel_alanlar?: unknown;
    updated_at?: string;
  };

  const alanlar = { ...VARSAYILAN_KAYIT_ALANLARI };
  for (const key of YERLESIK) {
    alanlar[key] = modNormalize(
      payload.alanlar?.[key] ?? VARSAYILAN_KAYIT_ALANLARI[key],
    );
  }

  const ozel = Array.isArray(payload.ozel_alanlar)
    ? (payload.ozel_alanlar
        .map(ozelAlanNormalize)
        .filter(Boolean) as KayitOzelAlan[])
    : [];

  return {
    alanlar,
    ozel_alanlar: ozel,
    updated_at: payload.updated_at,
  };
}

export function KayitAlanAyarlariVeyaVarsayilan(
  raw: unknown | null | undefined,
): KayitAlanAyarlari {
  if (!raw) return { ...VARSAYILAN_KAYIT_ALAN_AYARLARI, alanlar: { ...VARSAYILAN_KAYIT_ALANLARI }, ozel_alanlar: [] };
  return KayitAlanAyarlariNormalize(raw);
}

/**
 * Ödeme profili — saf yardımcılar (ağ/Supabase bağımlılığı yok).
 * Testler ve API katmanı bu modülü paylaşır.
 */
import type {
  OdemeBelgeTuru,
  OdemeProfiliBelgesi,
  OdemeProfiliDurumu,
  OdemeProfiliEksigi,
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

export function OdemeProfiliVerisiCoz(ham: unknown): OdemeProfiliVerisi {
  const d = asObj(ham);
  return {
    exists: Boolean(d.exists),
    status: (d.status ?? 'incomplete') as OdemeProfiliDurumu,
    tamam: Boolean(d.tamam),
    eksikler: asList<OdemeProfiliEksigi>(d.eksikler),
    sirket_yok: Boolean(d.sirket_yok),
    has_company: Boolean(d.has_company),
    belge_gerekli: asList<OdemeBelgeTuru>(d.belge_gerekli),
    profile: (d.profile ?? null) as OdemeProfiliKaydi | null,
    documents: asList<OdemeProfiliBelgesi>(d.documents),
    banka: {
      exists: false,
      status: 'none',
      country_code: null,
      account_holder: null,
      bank_name: null,
      scheme: null,
      currency: null,
      masked: {},
      ...asObj(d.banka),
    },
  };
}

/** Dosya adı/URI → güvenli uzantı (kova mime listesiyle uyumlu). */
export function BelgeUzantisi(dosyaAdi: string, mime: string | null | undefined): string {
  const m = (mime ?? '').toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('heic') || m.includes('heif')) return 'heic';
  const uzanti = dosyaAdi.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf', 'png', 'webp', 'heic', 'jpg', 'jpeg'].includes(uzanti)) {
    return uzanti === 'jpeg' ? 'jpg' : uzanti;
  }
  return 'jpg';
}

export function BelgeMimeTipi(mime: string | null | undefined, uzanti: string): string {
  const m = (mime ?? '').trim().toLowerCase();
  if (
    m === 'application/pdf' ||
    m === 'image/png' ||
    m === 'image/webp' ||
    m === 'image/heic' ||
    m === 'image/jpeg'
  ) {
    return m;
  }
  switch (uzanti) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

/** Sunucu eksik kodlarını sırayla korur; bilinmeyenleri atar. */
export function GecerliEksikler(liste: unknown): OdemeProfiliEksigi[] {
  const gecerli: OdemeProfiliEksigi[] = [
    'profil',
    'ad',
    'soyad',
    'telefon',
    'ulke',
    'vergi_no',
    'sirket_adi',
    'sirket_vergi_no',
    'vergi_belgesi',
    'sirket_belgesi',
  ];
  return asList<string>(liste).filter((k): k is OdemeProfiliEksigi =>
    (gecerli as string[]).includes(k),
  );
}

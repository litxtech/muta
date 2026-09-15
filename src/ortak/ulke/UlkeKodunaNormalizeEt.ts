/**
 * ISO 3166-1 alpha-2 normalizasyonu.
 * UI `geo_countries.name` (örn. Türkiye) tutabilir; Stripe / dış API'ler
 * yalnızca iki harfli kod (TR) veya İngilizce "Turkey" bekler — ham Türkçe
 * görünen adı asla gönderme.
 */

const ALIASES: Record<string, string> = {
  tr: 'TR',
  tur: 'TR',
  turkey: 'TR',
  turkiye: 'TR',
  'turkiye cumhuriyeti': 'TR',
  'republic of turkey': 'TR',
  'republic of turkiye': 'TR',
  de: 'DE',
  germany: 'DE',
  deutschland: 'DE',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  gb: 'GB',
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
};

/** Türkçe karakterleri ASCII'ye indirger (İ/ı dahil). */
export function UlkeMetniniKatla(raw: string): string {
  return raw
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Görünen ad / alias / kod → ISO alpha-2 (büyük harf).
 * Tanınmazsa: zaten 2 harfse uppercase döner; aksi halde null.
 */
export function UlkeKodunaNormalizeEt(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const folded = UlkeMetniniKatla(trimmed);
  if (ALIASES[folded]) return ALIASES[folded];

  // "Türkiye " / bozuk encoding varyantları
  if (folded.replace(/[^a-z]/g, '') === 'turkiye') return 'TR';

  return null;
}

/** Profil / API için güvenli kod; bilinmiyorsa varsayılan TR. */
export function UlkeKodunaZorla(
  raw: string | null | undefined,
  varsayilan: string = 'TR',
): string {
  return UlkeKodunaNormalizeEt(raw) ?? varsayilan;
}

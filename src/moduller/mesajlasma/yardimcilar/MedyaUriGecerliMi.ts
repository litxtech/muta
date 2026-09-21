/** Image / expo-video için güvenli uzak URI — boş, göreli, junk → false */
export function MedyaUriGecerliMi(
  uri: string | null | undefined,
): uri is string {
  return typeof uri === 'string' && /^https?:\/\//i.test(uri.trim());
}

export function MedyaUriGuvenli(
  uri: string | null | undefined,
): string | null {
  return MedyaUriGecerliMi(uri) ? uri.trim() : null;
}

/**
 * Tam ekran / galeri önizleme — https + yerel picker (file/content/ph).
 * Video / uzak feed için MedyaUriGuvenli kullan.
 */
export function MedyaUriOnizlemeGuvenli(
  uri: string | null | undefined,
): string | null {
  if (typeof uri !== 'string') return null;
  const t = uri.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^(file|content|ph|assets-library):/i.test(t)) return t;
  return null;
}

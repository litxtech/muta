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

type CacheEntry = {
  translated: string;
  corrected: string;
  source_lang: string;
  same_language: boolean;
  at: number;
};

const TTL_MS = 1000 * 60 * 60 * 6;
const MAX = 400;
const map = new Map<string, CacheEntry>();

function key(text: string, targetLang: string): string {
  return `${targetLang}::${text}`;
}

export function CeviriCacheOku(
  text: string,
  targetLang: string,
): CacheEntry | null {
  const k = key(text, targetLang);
  const hit = map.get(k);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    map.delete(k);
    return null;
  }
  return hit;
}

export function CeviriCacheYaz(
  text: string,
  targetLang: string,
  entry: Omit<CacheEntry, 'at'>,
): void {
  if (map.size >= MAX) {
    const first = map.keys().next().value;
    if (first) map.delete(first);
  }
  map.set(key(text, targetLang), { ...entry, at: Date.now() });
}

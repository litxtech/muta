/**
 * React Native: fetch(uri).blob() sıkça type=text/plain döner.
 * Supabase Storage bunu reddeder. ArrayBuffer + açık contentType kullan.
 */

export function MedyaUzantisiCoz(
  uri: string,
  mime?: string | null,
  varsayilan: 'jpg' | 'mp4' = 'jpg',
): string {
  const m = (mime ?? '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('heic') || m.includes('heif')) return 'heic';
  if (m.includes('gif')) return 'gif';
  if (m.includes('quicktime')) return 'mov';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('webm')) return 'webm';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';

  const fromUri = uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (
    fromUri &&
    ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'mp4', 'mov', 'webm'].includes(
      fromUri,
    )
  ) {
    return fromUri === 'jpeg' || fromUri === 'heif' ? (fromUri === 'heif' ? 'heic' : 'jpg') : fromUri;
  }
  return varsayilan;
}

/** text/plain / boş mime → uzantıdan doğru tip */
export function GuvenliMimeTipi(
  mime: string | null | undefined,
  ext: string,
  tur: 'image' | 'video' = 'image',
): string {
  const m = (mime ?? '').trim().toLowerCase();
  if (
    m &&
    m !== 'text/plain' &&
    m !== 'application/octet-stream' &&
    m !== 'application/json' &&
    !m.startsWith('text/')
  ) {
    return m;
  }

  if (tur === 'video') {
    if (ext === 'mov') return 'video/quicktime';
    if (ext === 'webm') return 'video/webm';
    return 'video/mp4';
  }

  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

/**
 * Yerel dosya URI → Uint8Array (blob.type tuzağı yok).
 */
export async function YerelDosyayiBaytOku(
  uri: string,
): Promise<Uint8Array> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Dosya okunamadı (${response.status})`);
  }
  // arrayBuffer: RN'de blob.type=text/plain sorununu atlar
  const buf = await response.arrayBuffer();
  return new Uint8Array(buf);
}

export type DepoyaYukleGirdi = {
  bucket: string;
  path: string;
  uri: string;
  mime?: string | null;
  tur?: 'image' | 'video';
  upsert?: boolean;
};

export type DepoyaYukleSonuc =
  | { ok: true; path: string; contentType: string }
  | { ok: false; hata: string };

/**
 * Supabase Storage yükleme — doğru Content-Type ile.
 */
export async function DepoyaMedyaYukle(
  supabase: {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          body: Uint8Array,
          opts: { contentType: string; upsert: boolean },
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  girdi: DepoyaYukleGirdi,
): Promise<DepoyaYukleSonuc> {
  const tur = girdi.tur ?? 'image';
  const ext = MedyaUzantisiCoz(
    girdi.uri,
    girdi.mime,
    tur === 'video' ? 'mp4' : 'jpg',
  );
  const contentType = GuvenliMimeTipi(girdi.mime, ext, tur);

  try {
    const bytes = await YerelDosyayiBaytOku(girdi.uri);
    if (bytes.byteLength === 0) {
      return { ok: false, hata: 'Dosya boş' };
    }

    const { error } = await supabase.storage.from(girdi.bucket).upload(
      girdi.path,
      bytes,
      {
        contentType,
        upsert: girdi.upsert ?? false,
      },
    );

    if (error) {
      return {
        ok: false,
        hata: /mime|text\/plain|not supported/i.test(error.message)
          ? `Dosya tipi reddedildi (${contentType}). Tekrar dene veya JPG seç.`
          : error.message,
      };
    }

    return { ok: true, path: girdi.path, contentType };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : 'Yükleme başarısız',
    };
  }
}

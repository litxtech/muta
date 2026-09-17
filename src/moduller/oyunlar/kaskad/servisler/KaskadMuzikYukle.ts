/**
 * Admin — Realm of Storms müzik yükleme (storage + RPC).
 */

import { supabase } from '../../../../lib/supabase';
import {
  DepoyaMedyaYukle,
  MedyaUzantisiCoz,
} from '../../../../ortak/medya/DepoyaMedyaYukle';
import { SesDosyasiSec } from '../../../../ortak/medya/DocumentPickerHazirMi';
import {
  kaskadAdminMuzikEkle,
  type KaskadMusicAdminState,
} from './KaskadAdminApi';

export const KASKAD_MUSIC_BUCKET = 'kaskad-music';

export async function kaskadAdminMuzikDosyaYukle(opts?: {
  title?: string;
  durationMs?: number | null;
  autoPlaylist?: boolean;
}): Promise<KaskadMusicAdminState> {
  const secim = await SesDosyasiSec();
  if (!secim.ok) {
    if ('iptal' in secim && secim.iptal) {
      throw new Error('IPTAL');
    }
    throw new Error('hata' in secim ? secim.hata : 'Dosya seçilemedi');
  }

  const ext = MedyaUzantisiCoz(secim.uri, secim.mime, 'mp3');
  const path = `tracks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const yukleme = await DepoyaMedyaYukle(supabase, {
    bucket: KASKAD_MUSIC_BUCKET,
    path,
    uri: secim.uri,
    mime: secim.mime,
    tur: 'audio',
    upsert: false,
  });
  if (!yukleme.ok) throw new Error(yukleme.hata);

  const { data: urlData } = supabase.storage
    .from(KASKAD_MUSIC_BUCKET)
    .getPublicUrl(yukleme.path);

  const title =
    (opts?.title ?? '').trim() ||
    secim.name.replace(/\.[^.]+$/, '').trim() ||
    'Müzik';

  return kaskadAdminMuzikEkle({
    title,
    publicUrl: urlData.publicUrl,
    storagePath: yukleme.path,
    mimeType: yukleme.contentType ?? secim.mime,
    fileExt: ext,
    durationMs: opts?.durationMs ?? null,
    autoPlaylist: opts?.autoPlaylist !== false,
  });
}

export async function kaskadAdminMuzikStorageSil(
  storagePath: string | null | undefined,
): Promise<void> {
  if (!storagePath) return;
  try {
    await supabase.storage.from(KASKAD_MUSIC_BUCKET).remove([storagePath]);
  } catch {
    /* storage silme hatası admin akışını bozmasın */
  }
}

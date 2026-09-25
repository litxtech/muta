import { useEffect, useState } from 'react';
import { OzellikBayragiAktifMi } from '../../ozellik-bayraklari/OzellikBayragiAktifMi';
import { KillSwitchAktifMi } from '../../ozellik-bayraklari/OzellikBayragiAktifMi';
import { AiCeviriIste } from '../islemler/AiCeviriIste';
import { CeviriCacheOku, CeviriCacheYaz } from '../cache/CeviriCache';
import { HedefDilIleAyniMi } from '../yardimcilar/HedefDilIleAyniMi';

export type CeviriGorunum = {
  /** Orijinal (yazıldığı gibi) */
  orijinal: string;
  /**
   * Alt satır: yalnızca FARKLI dilden çeviri.
   * Aynı dil / yazım düzeltmesi gösterilmez.
   */
  altSatir: string | null;
  /** Arka planda istek var (UI spinner göstermez) */
  yukleniyor: boolean;
};

/**
 * Canlı sohbet / DM / görüşme için otomatik çeviri.
 * Yalnızca iki farklı dil arasında çalışır; aynı dilde (TR↔TR vb.)
 * ve yazım hatalarında çeviri/düzeltme göstermez.
 */
export function useMetinCevirisi(
  text: string | null | undefined,
  targetLang: string,
  context: 'live' | 'room' | 'dm' | 'call' | 'other' = 'other',
  enabled = true,
): CeviriGorunum {
  const raw = (text ?? '').trim();
  const [state, setState] = useState<CeviriGorunum>({
    orijinal: raw,
    altSatir: null,
    yukleniyor: false,
  });

  useEffect(() => {
    let iptal = false;

    if (
      !enabled ||
      !raw ||
      !OzellikBayragiAktifMi('live_chat_translation_enabled') ||
      KillSwitchAktifMi('kill_live_chat_translation')
    ) {
      setState({
        orijinal: raw,
        altSatir: null,
        yukleniyor: false,
      });
      return;
    }

    // Hedef dil ile metin aynı dil gibi görünüyorsa API çağırma
    if (HedefDilIleAyniMi(raw, targetLang)) {
      setState({
        orijinal: raw,
        altSatir: null,
        yukleniyor: false,
      });
      return;
    }

    const cached = CeviriCacheOku(raw, targetLang);
    if (cached) {
      const alt = altSatirHesapla(
        raw,
        cached.translated,
        cached.same_language,
        cached.source_lang,
        targetLang,
      );
      setState({
        orijinal: raw,
        altSatir: alt,
        yukleniyor: false,
      });
      return;
    }

    // Önce orijinali göster — spinner yok, mesaj anında okunur
    setState({
      orijinal: raw,
      altSatir: null,
      yukleniyor: true,
    });

    void (async () => {
      const r = await AiCeviriIste({
        text: raw,
        targetLang,
        context,
      });
      if (iptal) return;
      if (!r.ok) {
        if (__DEV__) {
          console.warn('[AI_CEVIRI] fail', r.code, { context, targetLang });
        }
        setState({
          orijinal: raw,
          altSatir: null,
          yukleniyor: false,
        });
        return;
      }
      CeviriCacheYaz(raw, targetLang, {
        translated: r.translated,
        corrected: r.corrected,
        source_lang: r.source_lang,
        same_language: r.same_language,
      });
      setState({
        orijinal: raw,
        altSatir: altSatirHesapla(
          raw,
          r.translated,
          r.same_language,
          r.source_lang,
          targetLang,
        ),
        yukleniyor: false,
      });
    })();

    return () => {
      iptal = true;
    };
  }, [raw, targetLang, context, enabled]);

  // Metin değişince eski alt satırı bir an bile gösterme
  const alt = state.orijinal === raw ? state.altSatir : null;
  return {
    orijinal: raw,
    altSatir: alt,
    yukleniyor: state.orijinal === raw ? state.yukleniyor : !!raw,
  };
}

/**
 * Çeviri yalnızca kaynak ≠ hedef dil ise gösterilir.
 * Aynı dilde yazım düzeltmesi ASLA gösterilmez.
 */
function altSatirHesapla(
  orijinal: string,
  translated: string,
  sameLanguage: boolean,
  sourceLang?: string,
  targetLang?: string,
): string | null {
  const src = (sourceLang ?? '').trim().toLowerCase().split('-')[0] ?? '';
  const tgt = (targetLang ?? '').trim().toLowerCase().split('-')[0] ?? '';

  // Aynı dil → çeviri yok (yanlış yazım dahil)
  if (src && tgt && src !== 'und' && src === tgt) return null;
  if (sameLanguage && !(src && tgt && src !== 'und' && src !== tgt)) {
    return null;
  }

  // Yalnızca çapraz dil çevirisi
  const t = translated.trim();
  if (!t || t === orijinal) return null;
  return t;
}

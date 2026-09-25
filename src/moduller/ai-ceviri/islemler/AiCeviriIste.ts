import { supabase } from '../../../lib/supabase';

export type AiCeviriSonuc =
  | {
      ok: true;
      translated: string;
      /** Kaynak dilde yazım düzeltilmiş metin */
      corrected: string;
      source_lang: string;
      same_language: boolean;
      cached?: boolean;
    }
  | { ok: false; code?: string };

/**
 * Server-side DeepSeek translation. Never call DeepSeek from the device.
 */
export async function AiCeviriIste(input: {
  text: string;
  targetLang: string;
  sourceLang?: string | null;
  context?: 'live' | 'room' | 'dm' | 'call' | 'other';
}): Promise<AiCeviriSonuc> {
  const text = input.text.trim();
  if (!text) return { ok: false, code: 'empty' };

  const { data, error } = await supabase.functions.invoke('deepseek-translate', {
    body: {
      text,
      target_lang: input.targetLang,
      source_lang: input.sourceLang ?? null,
      context: input.context ?? 'other',
    },
  });

  if (error || !data?.ok) {
    return { ok: false, code: data?.code ?? error?.message };
  }

  const translated = String(data.translated ?? text);
  const corrected = String(data.corrected ?? text);
  const sourceLang = String(data.source_lang ?? 'und');
  const src = sourceLang.toLowerCase().split('-')[0] ?? 'und';
  const tgt = input.targetLang.toLowerCase().split('-')[0] ?? input.targetLang;
  // Sunucu eski sürüm same_language yanlış dönebilir — client'ta da düzelt
  let same = !!data.same_language;
  if (src !== 'und' && src !== tgt) same = false;
  else if (src === tgt) same = true;

  return {
    ok: true,
    // Aynı dilde orijinali koru (eski cache'deki "düzeltme"yi ez)
    translated: same ? text : translated,
    corrected: same ? text : corrected,
    source_lang: sourceLang,
    same_language: same,
    cached: !!data.cached,
  };
}

/**
 * Hedef dil ile metnin aynı dil olup olmadığını kaba sezgisel kontrol.
 * Amaç: TR↔TR (yanlış yazım dahil) için AI çeviri çağrısını atlamak.
 * Şüphede false döner → sunucu karar verir.
 */
export function HedefDilIleAyniMi(
  text: string,
  targetLang: string,
): boolean {
  const tgt = targetLang.trim().toLowerCase().split('-')[0] ?? '';
  const raw = text.trim();
  if (!raw || !tgt) return false;

  if (tgt === 'tr') return turkceSohbetGibiMi(raw);
  if (tgt === 'en') return ingilizceSohbetGibiMi(raw);
  if (tgt === 'es') return ispanyolcaSohbetGibiMi(raw);
  if (tgt === 'pt') return portekizceSohbetGibiMi(raw);
  if (tgt === 'ar') return /[\u0600-\u06FF]/.test(raw);
  if (tgt === 'fr') return fransizcaSohbetGibiMi(raw);
  return false;
}

function turkceSohbetGibiMi(text: string): boolean {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return true;
  // Diakritiksiz / hatalı yazım dahil yaygın sohbet kalıpları
  return /\b(merhaba|mrb|selam|slm|nbr|naber|nasilsin|nasılsın|naber|iyi\s*misin|gunaydin|günaydın|iyi\s*akşamlar|iyi\s*geceler|tesekkur|teşekkür|saol|sagol|sağol|tamam|tmm|evet|hayir|hayır|lutfen|lütfen|benim|senin|bizim|var\s*mi|var\s*mı|yok\s*mu|ne\s*haber|asl|kib|knk|kanka|abi|abla|hocam|lan|ya\b|be\b|miyim|misin|musun|müsün|musunuz|ederim|anladim|anladım|bilmiyorum|biliyorum|geldim|geliyorum|gidiyorum|nerdesin|neredesin|napıyorsun|napiyorsun|napion|nabıyon)\b/i.test(
    text,
  );
}

function ingilizceSohbetGibiMi(text: string): boolean {
  if (/[çğıöşüÇĞİÖŞÜ\u0600-\u06FF]/.test(text)) return false;
  return /\b(hello|hi|hey|thanks|thank you|please|yes|no|ok|okay|how are you|what'?s up|good morning|good night|sorry|love|miss you|i am|i'?m|you are|you'?re)\b/i.test(
    text,
  );
}

function ispanyolcaSohbetGibiMi(text: string): boolean {
  if (/[ñáéíóúü¿¡]/i.test(text)) return true;
  return /\b(hola|gracias|por favor|buenos días|buenas noches|cómo estás|como estas|sí|si\b|no\b|vale|qué tal|que tal)\b/i.test(
    text,
  );
}

function portekizceSohbetGibiMi(text: string): boolean {
  if (/[ãõáéíóúâêôç]/i.test(text)) return true;
  return /\b(olá|ola|obrigado|obrigada|por favor|bom dia|boa noite|tudo bem|sim|não|nao|valeu)\b/i.test(
    text,
  );
}

function fransizcaSohbetGibiMi(text: string): boolean {
  if (/[àâäéèêëïîôùûüçœæ]/i.test(text)) return true;
  return /\b(bonjour|salut|merci|s'?il vous plaît|s'?il te plaît|oui|non|ça va|ca va|bonne nuit|comment ça va)\b/i.test(
    text,
  );
}

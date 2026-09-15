const BLOCKED_SCHEMES = [
  'javascript:',
  'file:',
  'data:',
  'intent:',
  'vbscript:',
  'about:',
  'blob:',
];

export type UrlValidation = {
  ok: boolean;
  url?: string;
  reason?: string;
};

/**
 * Sadece https:// — http default kapalı.
 * Open redirect / malicious scheme engeli.
 */
export function isSafeHttpsUrl(raw: string): UrlValidation {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: false, reason: 'URL boş' };

  const lower = trimmed.toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { ok: false, reason: `Engellenen şema: ${scheme}` };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Geçersiz URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Sadece HTTPS izinli' };
  }

  // Host kontrolü
  if (!parsed.hostname || parsed.hostname === 'localhost') {
    return { ok: false, reason: 'Geçersiz host' };
  }

  // Userinfo (user:pass@) şüpheli — engelle
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL kimlik bilgisi engellendi' };
  }

  // Control characters
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return { ok: false, reason: 'Geçersiz karakter' };
  }

  return { ok: true, url: parsed.toString() };
}

export function shouldAllowWebViewNavigation(url: string): boolean {
  return isSafeHttpsUrl(url).ok;
}

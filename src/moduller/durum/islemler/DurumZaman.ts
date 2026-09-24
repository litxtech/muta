import i18n from '../../../i18n';
import { DilNormalizeEt, DIL_LOCALE_MAP } from '../../../i18n/diller';

function aktifLocale(): string {
  const dil = DilNormalizeEt(i18n.language);
  return DIL_LOCALE_MAP[dil] ?? dil;
}

/** Göreli zaman — X tarzı kısa */
export function DurumZamanMetni(iso: string): string {
  try {
    const d = new Date(iso);
    const fark = Date.now() - d.getTime();
    if (fark < 60_000) {
      return i18n.t('durumX.zamanSn', { n: Math.max(1, Math.floor(fark / 1000)) });
    }
    if (fark < 3_600_000) {
      return i18n.t('durumX.zamanDk', { n: Math.floor(fark / 60_000) });
    }
    if (fark < 86_400_000) {
      return i18n.t('durumX.zamanSa', { n: Math.floor(fark / 3_600_000) });
    }
    if (fark < 7 * 86_400_000) {
      return i18n.t('durumX.zamanGun', { n: Math.floor(fark / 86_400_000) });
    }
    return d.toLocaleDateString(aktifLocale(), {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

export function DurumTarihSaat(iso: string): string {
  try {
    return new Date(iso).toLocaleString(aktifLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

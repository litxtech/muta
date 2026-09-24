import i18n from '../../i18n';
import type { TakipIslemKodu } from './TakipTipleri';

export function TakipHataMesaji(
  code: TakipIslemKodu | string | undefined,
  fallback?: string,
): string {
  switch (code) {
    case 'rate_limited':
      return i18n.t('takip.hataRateLimited');
    case 'blocked':
      return i18n.t('takip.hataBlocked');
    case 'self':
      return i18n.t('takip.hataSelf');
    case 'guest':
      return i18n.t('takip.hataGuest');
    case 'not_found':
      return i18n.t('takip.hataNotFound');
    case 'forbidden':
      return i18n.t('takip.hataForbidden');
    case 'unauthenticated':
      return i18n.t('takip.hataUnauthenticated');
    case 'timeout':
      return i18n.t('takip.hataTimeout');
    case 'network':
      return i18n.t('takip.hataNetwork');
    case 'server':
      return i18n.t('takip.hataServer');
    default:
      return fallback || i18n.t('takip.hataGenel');
  }
}

export function TakipHatadanKod(err: unknown): TakipIslemKodu {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message ?? '')
      : String(err ?? '');
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code ?? '')
      : '';
  const status =
    err && typeof err === 'object' && 'status' in err
      ? Number((err as { status?: number }).status)
      : 0;

  if (status === 429 || /rate.?limit|çok hızlı|too many/i.test(msg)) {
    return 'rate_limited';
  }
  if (status === 401 || /not authenticated|oturum/i.test(msg)) {
    return 'unauthenticated';
  }
  if (status === 403 || /engellen|forbidden|blocked/i.test(msg)) {
    return 'blocked';
  }
  if (status === 408 || /timeout|timed out/i.test(msg)) return 'timeout';
  if (
    code === 'ENOTFOUND' ||
    /network|offline|failed to fetch|internet/i.test(msg)
  ) {
    return 'network';
  }
  if (status >= 500) return 'server';
  return 'server';
}

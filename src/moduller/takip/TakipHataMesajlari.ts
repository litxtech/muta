import type { TakipIslemKodu } from './TakipTipleri';

export function TakipHataMesaji(
  code: TakipIslemKodu | string | undefined,
  fallback?: string,
): string {
  switch (code) {
    case 'rate_limited':
      return 'Çok hızlı işlem yapıyorsun. Biraz sonra tekrar dene.';
    case 'blocked':
      return 'Bu kullanıcıyla iletişim engellenmiş.';
    case 'self':
      return 'Kendini takip edemezsin.';
    case 'guest':
      return 'Takip için hesabını tamamla.';
    case 'not_found':
      return 'Kullanıcı bulunamadı.';
    case 'forbidden':
      return 'Bu işlem için yetkin yok.';
    case 'unauthenticated':
      return 'Oturumun yok.';
    case 'timeout':
      return 'Bağlantı zaman aşımına uğradı.';
    case 'network':
      return 'İnternet bağlantısı yok. Takip kaydedilmedi.';
    case 'server':
      return 'Sunucu hatası. Tekrar dene.';
    default:
      return fallback || 'İşlem tamamlanamadı.';
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

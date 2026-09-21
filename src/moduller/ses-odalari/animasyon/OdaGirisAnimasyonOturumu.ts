/**
 * Oda oturumu boyunca giriş animasyonu tekrarını engeller.
 * Strict Mode remount / seats flicker / profil güncellemesi yeniden oynatmaz.
 */

const anahtarlar = new Set<string>();

export function OdaGirisAnimasyonuGosterildiMi(anahtar: string): boolean {
  return anahtarlar.has(anahtar);
}

export function OdaGirisAnimasyonuIsaretle(anahtar: string): void {
  anahtarlar.add(anahtar);
}

export function OdaGirisAnimasyonuOdaTemizle(roomId: string): void {
  const prefix = `${roomId}:`;
  for (const k of [...anahtarlar]) {
    if (k.startsWith(prefix)) anahtarlar.delete(k);
  }
}

export function OdaGirisAnimAnahtari(
  roomId: string,
  tur: 'seviye' | 'sahip',
  userId: string,
): string {
  return `${roomId}:${tur}:${userId}`;
}

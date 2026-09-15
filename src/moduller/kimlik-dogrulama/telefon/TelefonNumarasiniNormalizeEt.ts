/**
 * TR odaklı telefon → E.164 (+90…).
 * Örn: 05xx xxx xx xx → +905xxxxxxxxx
 */
export function TelefonNumarasiniNormalizeEt(
  ham: string,
): { ok: true; e164: string; rakamlar: string } | { ok: false; hata: string } {
  const temiz = ham.trim().replace(/[^\d+]/g, '');
  let rakamlar = temiz.replace(/\D/g, '');

  if (rakamlar.startsWith('00')) {
    rakamlar = rakamlar.slice(2);
  }

  // 05xxxxxxxxx (11) → 905xxxxxxxxx
  if (rakamlar.length === 11 && rakamlar.startsWith('0')) {
    rakamlar = `90${rakamlar.slice(1)}`;
  }
  // 5xxxxxxxxx (10) → 905xxxxxxxxx
  if (rakamlar.length === 10 && rakamlar.startsWith('5')) {
    rakamlar = `90${rakamlar}`;
  }

  if (rakamlar.length < 10 || rakamlar.length > 15) {
    return { ok: false, hata: 'Geçerli bir telefon numarası gir.' };
  }

  // TR cep: 905xxxxxxxxx (12 hane)
  if (rakamlar.startsWith('90') && rakamlar.length !== 12) {
    return { ok: false, hata: 'Türkiye cep numarası 10 haneli olmalı (5xx…).' };
  }

  return { ok: true, e164: `+${rakamlar}`, rakamlar };
}

/** Giriş alanında telefon gibi mi görünüyor? */
export function KimlikTelefonGibiMi(ham: string): boolean {
  const t = ham.trim();
  if (t.includes('@')) return false;
  const rakam = t.replace(/\D/g, '');
  // kullanıcı adı çoğunlukla harf içerir; telefon ağırlıklı rakam
  const sadeceRakamVeIsaret = /^[\d\s+\-()]+$/.test(t);
  return sadeceRakamVeIsaret && rakam.length >= 10;
}

/** Auth için telefon hesabı e-posta sanal adresi */
export function TelefonAuthEmaili(e164: string): string {
  const rakam = e164.replace(/\D/g, '');
  return `ph${rakam}@phone.tamuso.local`;
}

import i18n from '../../../i18n';

/** ISO tarih (YYYY-MM-DD) → yaş */
export function YasHesapla(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return -1;
  const now = new Date();
  let yas = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) yas -= 1;
  return yas;
}

export function DogumYilSecenekleri(
  minYas = 18,
): { id: string; label: string }[] {
  const max = new Date().getFullYear() - minYas;
  const min = 1925;
  const out: { id: string; label: string }[] = [];
  for (let y = max; y >= min; y -= 1) out.push({ id: String(y), label: String(y) });
  return out;
}

export const DOGUM_AYLARI = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
].map((m) => ({ id: m, label: m }));

export function DogumGunSecenekleri(
  yil: string,
  ay: string,
): { id: string; label: string }[] {
  const dim = new Date(Number(yil) || 2000, Number(ay) || 1, 0).getDate();
  return Array.from({ length: dim }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return { id: d, label: d };
  });
}

/** 18+ doğrula; geçerliyse ISO tarih döner */
export function DogumTarihiDogrula(
  yil: string,
  ay: string,
  gun: string,
): { ok: true; iso: string } | { ok: false; hata: string } {
  if (!yil || !ay || !gun) {
    return { ok: false, hata: i18n.t('auth.dogumSec') };
  }
  const iso = `${yil}-${ay}-${gun}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { ok: false, hata: i18n.t('auth.dogumGecersiz') };
  }
  const yas = YasHesapla(iso);
  if (yas < 0) return { ok: false, hata: i18n.t('auth.dogumGecersiz') };
  if (yas < 18) {
    return {
      ok: false,
      hata: i18n.t('auth.yas18Alt'),
    };
  }
  if (yas > 120) return { ok: false, hata: i18n.t('auth.dogumGecersiz') };
  return { ok: true, iso };
}

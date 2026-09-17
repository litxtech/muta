import { TakipServisi } from '../../takip/islemler/TakipServisi';
import { TakipHataMesaji } from '../../takip/TakipHataMesajlari';

export async function TakipEt(hedefKullaniciId: string): Promise<{ ok: boolean; hata?: string }> {
  const r = await TakipServisi.takipEt(hedefKullaniciId);
  if (!r.ok) return { ok: false, hata: r.hata ?? TakipHataMesaji(r.code) };
  return { ok: true };
}

export async function TakibiBirak(hedefKullaniciId: string): Promise<{ ok: boolean; hata?: string }> {
  const r = await TakipServisi.takiptenCik(hedefKullaniciId);
  if (!r.ok) return { ok: false, hata: r.hata ?? TakipHataMesaji(r.code) };
  return { ok: true };
}

export async function TakipEdiliyorMu(hedefKullaniciId: string): Promise<boolean> {
  const d = await TakipServisi.durumGetir(hedefKullaniciId);
  return d?.state === 'FOLLOWING' || d?.state === 'MUTUAL';
}

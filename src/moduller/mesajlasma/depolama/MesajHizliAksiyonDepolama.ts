/**
 * Kullanıcı tanımlı hızlı paylaşım çipleri (etiket + gönderilecek metin).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANAHTAR = '@muta/mesaj_hizli_aksiyonlar_v1';
export const HIZLI_AKSIYON_MAX = 12;

export type HizliAksiyonOge = {
  id: string;
  etiket: string;
  metin: string;
};

function idUret(): string {
  return `ha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function HizliAksiyonlariGetir(): Promise<HizliAksiyonOge[]> {
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    if (!ham) return [];
    const parsed = JSON.parse(ham) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is HizliAksiyonOge =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as HizliAksiyonOge).id === 'string' &&
          typeof (x as HizliAksiyonOge).etiket === 'string' &&
          typeof (x as HizliAksiyonOge).metin === 'string',
      )
      .map((x) => ({
        id: x.id,
        etiket: x.etiket.trim().slice(0, 40),
        metin: x.metin.trim().slice(0, 2000),
      }))
      .filter((x) => x.etiket.length > 0 && x.metin.length > 0)
      .slice(0, HIZLI_AKSIYON_MAX);
  } catch {
    return [];
  }
}

async function kaydet(liste: HizliAksiyonOge[]): Promise<void> {
  await AsyncStorage.setItem(
    ANAHTAR,
    JSON.stringify(liste.slice(0, HIZLI_AKSIYON_MAX)),
  );
}

export async function HizliAksiyonEkle(opts: {
  etiket: string;
  metin: string;
}): Promise<
  | { ok: true; oge: HizliAksiyonOge; liste: HizliAksiyonOge[] }
  | { ok: false; hata: 'bos' | 'limit' }
> {
  const etiket = opts.etiket.trim().slice(0, 40);
  const metin = opts.metin.trim().slice(0, 2000);
  if (!etiket || !metin) return { ok: false, hata: 'bos' };
  const mevcut = await HizliAksiyonlariGetir();
  if (mevcut.length >= HIZLI_AKSIYON_MAX) return { ok: false, hata: 'limit' };
  const oge: HizliAksiyonOge = { id: idUret(), etiket, metin };
  const liste = [...mevcut, oge];
  await kaydet(liste);
  return { ok: true, oge, liste };
}

export async function HizliAksiyonSil(
  id: string,
): Promise<HizliAksiyonOge[]> {
  const liste = (await HizliAksiyonlariGetir()).filter((x) => x.id !== id);
  await kaydet(liste);
  return liste;
}

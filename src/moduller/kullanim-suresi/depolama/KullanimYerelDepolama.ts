import AsyncStorage from '@react-native-async-storage/async-storage';
import { KULLANIM_STORAGE_KEY } from '../sabitler';

export type KullanimYerelDurum = {
  /** Kullanıcıya göre sunucudan bilinen toplam (senkron sonrası) */
  sunucuToplam: number;
  /** Henüz RPC ile gönderilmemiş saniye */
  bekleyen: number;
};

const BOS: KullanimYerelDurum = { sunucuToplam: 0, bekleyen: 0 };

function anahtar(userId: string) {
  return `${KULLANIM_STORAGE_KEY}:${userId}`;
}

export async function KullanimYerelGetir(
  userId: string,
): Promise<KullanimYerelDurum> {
  try {
    const raw = await AsyncStorage.getItem(anahtar(userId));
    if (!raw) return { ...BOS };
    const p = JSON.parse(raw) as Partial<KullanimYerelDurum>;
    return {
      sunucuToplam: Math.max(0, Math.floor(Number(p.sunucuToplam) || 0)),
      bekleyen: Math.max(0, Math.floor(Number(p.bekleyen) || 0)),
    };
  } catch {
    return { ...BOS };
  }
}

export async function KullanimYerelKaydet(
  userId: string,
  durum: KullanimYerelDurum,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      anahtar(userId),
      JSON.stringify({
        sunucuToplam: Math.max(0, Math.floor(durum.sunucuToplam)),
        bekleyen: Math.max(0, Math.floor(durum.bekleyen)),
      }),
    );
  } catch {
    /* sessiz */
  }
}

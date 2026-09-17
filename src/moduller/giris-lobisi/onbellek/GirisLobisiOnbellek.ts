import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
import {
  VARSAYILAN_GIRIS_LOBISI_AYAR,
  type GirisLobisiPublic,
} from '../tipler';

const ANAHTAR = 'giris_lobisi_public_v1';

let bellek: GirisLobisiPublic | null = null;
let diskYukleniyor: Promise<GirisLobisiPublic | null> | null = null;

function gecerliMi(x: unknown): x is GirisLobisiPublic {
  if (!x || typeof x !== 'object') return false;
  const o = x as GirisLobisiPublic;
  return !!o.ayar && Array.isArray(o.medya);
}

/** Senkron — çıkışta lobi anında son bilinen medyayı göstersin. */
export function GirisLobisiOnbellektenAl(): GirisLobisiPublic | null {
  return bellek;
}

export function GirisLobisiOnbellegeYaz(data: GirisLobisiPublic): void {
  bellek = data;
  void AsyncStorage.setItem(ANAHTAR, JSON.stringify(data)).catch(() => undefined);
  for (const m of data.medya) {
    if (m.tur === 'image' && m.public_url) {
      void Image.prefetch(m.public_url).catch(() => undefined);
    }
    if (data.ayar.logo_url) {
      void Image.prefetch(data.ayar.logo_url).catch(() => undefined);
    }
  }
}

/** Disk → bellek (ilk açılış / çıkış öncesi ısıtma). */
export async function GirisLobisiOnbellekDisktenYukle(): Promise<GirisLobisiPublic | null> {
  if (bellek) return bellek;
  if (diskYukleniyor) return diskYukleniyor;

  diskYukleniyor = (async () => {
    try {
      const raw = await AsyncStorage.getItem(ANAHTAR);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!gecerliMi(parsed)) return null;
      bellek = {
        ayar: { ...VARSAYILAN_GIRIS_LOBISI_AYAR, ...parsed.ayar },
        medya: parsed.medya,
      };
      return bellek;
    } catch {
      return null;
    } finally {
      diskYukleniyor = null;
    }
  })();

  return diskYukleniyor;
}

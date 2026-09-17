import AsyncStorage from '@react-native-async-storage/async-storage';
import { GuvenliOturumDepolama } from '../depolama/GuvenliOturumDepolama';
import {
  OTURUM_GECMISI_MAX,
  type OturumGecmisiKaydi,
  type OturumGecmisiToken,
} from './tipler';

const LISTE_ANAHTAR = 'oturum_gecmisi_v1';
const tokenAnahtar = (userId: string) => `oturum_gecmisi_token_${userId}`;

function sirala(liste: OturumGecmisiKaydi[]): OturumGecmisiKaydi[] {
  return [...liste].sort((a, b) =>
    a.kaydedildiAt < b.kaydedildiAt ? 1 : a.kaydedildiAt > b.kaydedildiAt ? -1 : 0,
  );
}

export async function OturumGecmisiListesiniGetir(): Promise<OturumGecmisiKaydi[]> {
  try {
    const raw = await AsyncStorage.getItem(LISTE_ANAHTAR);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sirala(
      parsed.filter(
        (x): x is OturumGecmisiKaydi =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as OturumGecmisiKaydi).userId === 'string',
      ),
    );
  } catch {
    return [];
  }
}

async function listeyiYaz(liste: OturumGecmisiKaydi[]): Promise<void> {
  await AsyncStorage.setItem(LISTE_ANAHTAR, JSON.stringify(sirala(liste)));
}

export async function OturumGecmisiTokeniniGetir(
  userId: string,
): Promise<OturumGecmisiToken | null> {
  try {
    const raw = await GuvenliOturumDepolama.getItem(tokenAnahtar(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OturumGecmisiToken>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string'
    ) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
    };
  } catch {
    return null;
  }
}

async function tokenYaz(
  userId: string,
  token: OturumGecmisiToken,
): Promise<void> {
  await GuvenliOturumDepolama.setItem(
    tokenAnahtar(userId),
    JSON.stringify(token),
  );
}

async function tokenSil(userId: string): Promise<void> {
  try {
    await GuvenliOturumDepolama.removeItem(tokenAnahtar(userId));
  } catch {
    /* yoksa sorun değil */
  }
}

/**
 * Çıkış öncesi hesabı lobide göstermek üzere kaydeder.
 * En fazla OTURUM_GECMISI_MAX hesap; en eski düşer.
 */
export async function OturumGecmisineKaydet(input: {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  kimlik: string | null;
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  const mevcut = await OturumGecmisiListesiniGetir();
  const kayit: OturumGecmisiKaydi = {
    userId: input.userId,
    username: input.username,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    kimlik: input.kimlik,
    kaydedildiAt: new Date().toISOString(),
  };

  const digerler = mevcut.filter((x) => x.userId !== input.userId);
  const sonraki = sirala([kayit, ...digerler]).slice(0, OTURUM_GECMISI_MAX);

  const dusenler = mevcut.filter(
    (x) => !sonraki.some((y) => y.userId === x.userId),
  );
  for (const d of dusenler) {
    await tokenSil(d.userId);
  }

  await tokenYaz(input.userId, {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
  });
  await listeyiYaz(sonraki);
}

/** Lobiden kalıcı sil — bir daha görünmez (yeniden giriş+çıkışa kadar). */
export async function OturumGecmisindenKaldir(userId: string): Promise<void> {
  const mevcut = await OturumGecmisiListesiniGetir();
  await listeyiYaz(mevcut.filter((x) => x.userId !== userId));
  await tokenSil(userId);
}

export async function OturumGecmisiTokeniniTemizle(
  userId: string,
): Promise<void> {
  await tokenSil(userId);
}

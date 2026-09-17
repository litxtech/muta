import type {
  OrtakTakipciOzeti,
  TakipDurumu,
  TakipListeTuru,
} from '../TakipTipleri';

type Kayit<T> = { value: T; exp: number };

const TTL_MS = 45_000;
const store = new Map<string, Kayit<unknown>>();

function get<T>(key: string): T | null {
  const row = store.get(key) as Kayit<T> | undefined;
  if (!row) return null;
  if (Date.now() > row.exp) {
    store.delete(key);
    return null;
  }
  return row.value;
}

function set<T>(key: string, value: T, ttl = TTL_MS) {
  store.set(key, { value, exp: Date.now() + ttl });
}

function delPrefix(prefix: string) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export const TakipCache = {
  durumKey: (viewerId: string, targetId: string) => `durum:${viewerId}:${targetId}`,
  listeKey: (kind: TakipListeTuru, ownerId: string) => `liste:${kind}:${ownerId}`,
  ortakKey: (viewerId: string, targetId: string) => `ortak:${viewerId}:${targetId}`,
  oneriKey: (viewerId: string) => `oneri:${viewerId}`,

  durumAl(viewerId: string, targetId: string): TakipDurumu | null {
    return get(this.durumKey(viewerId, targetId));
  },
  durumYaz(viewerId: string, targetId: string, value: TakipDurumu) {
    set(this.durumKey(viewerId, targetId), value);
  },
  ortakAl(viewerId: string, targetId: string): OrtakTakipciOzeti | null {
    return get(this.ortakKey(viewerId, targetId));
  },
  ortakYaz(viewerId: string, targetId: string, value: OrtakTakipciOzeti) {
    set(this.ortakKey(viewerId, targetId), value, 120_000);
  },

  invalidateUser(userId: string) {
    delPrefix(`durum:${userId}:`);
    for (const k of store.keys()) {
      if (k.endsWith(`:${userId}`)) store.delete(k);
    }
    delPrefix(`liste:followers:${userId}`);
    delPrefix(`liste:following:${userId}`);
    delPrefix(`oneri:${userId}`);
  },

  invalidatePair(actorId: string, targetId: string) {
    store.delete(this.durumKey(actorId, targetId));
    store.delete(this.durumKey(targetId, actorId));
    delPrefix(`liste:followers:${targetId}`);
    delPrefix(`liste:following:${actorId}`);
    delPrefix(`liste:followers:${actorId}`);
    delPrefix(`liste:following:${targetId}`);
    store.delete(this.ortakKey(actorId, targetId));
    delPrefix(`oneri:${actorId}`);
  },

  temizle() {
    store.clear();
  },
};

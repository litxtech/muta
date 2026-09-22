/**
 * Backend: level = greatest(1, (1 + (xp / 500))::int)
 * → level 1: 0–499 XP, her 500 XP bir seviye.
 */

const XP_PER_LEVEL = 500;

export type SeviyeXpOzeti = {
  level: number;
  xp: number;
  /** Mevcut seviyedeki XP (0 … XP_PER_LEVEL-1) */
  seviyeIciXp: number;
  /** Bir sonraki seviye eşiği (kümülatif) */
  sonrakiEsik: number;
  /** 0–1 ilerleme */
  oran: number;
};

export function SeviyeXpOzetiHesapla(
  levelGirdi?: number | null,
  xpGirdi?: number | null,
): SeviyeXpOzeti {
  const xp = Math.max(0, Math.floor(Number(xpGirdi) || 0));
  const hesaplanan = Math.max(1, 1 + Math.floor(xp / XP_PER_LEVEL));
  const level = Math.max(1, Math.floor(Number(levelGirdi) || hesaplanan));
  const seviyeIciXp = xp - (level - 1) * XP_PER_LEVEL;
  const guvenliIci = Math.max(0, Math.min(XP_PER_LEVEL, seviyeIciXp));
  const sonrakiEsik = level * XP_PER_LEVEL;
  return {
    level,
    xp,
    seviyeIciXp: guvenliIci,
    sonrakiEsik,
    oran: Math.min(1, guvenliIci / XP_PER_LEVEL),
  };
}

export function SayiKisaBicim(n: number): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return v.toLocaleString('tr-TR');
}

/**
 * Tab çubuğunda görünen ve sayfa kaydırmasıyla gezilen sıra.
 * Gizli sekmeler (rooms / wallet / cihazlar) dahil değil.
 */
export const GORUNUR_TAB_SIRASI = [
  'index',
  'durum',
  'create',
  'messages',
  'profile',
] as const;

export type GorunurTabAdi = (typeof GORUNUR_TAB_SIRASI)[number];

export function gorunurTabMu(ad: string): ad is GorunurTabAdi {
  return (GORUNUR_TAB_SIRASI as readonly string[]).includes(ad);
}

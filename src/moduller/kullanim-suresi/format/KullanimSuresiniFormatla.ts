/** Toplam saniyeyi okunaklı Türkçe süreye çevirir */
export function KullanimSuresiniFormatla(
  totalSeconds: number,
  opts?: { kisa?: boolean },
): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const gun = Math.floor(s / 86400);
  const saat = Math.floor((s % 86400) / 3600);
  const dk = Math.floor((s % 3600) / 60);

  if (opts?.kisa) {
    if (gun > 0) return `${gun}g ${saat}s`;
    if (saat > 0) return `${saat}s ${dk}dk`;
    if (dk > 0) return `${dk} dk`;
    return `${s} sn`;
  }

  const parcalar: string[] = [];
  if (gun > 0) parcalar.push(`${gun} gün`);
  if (saat > 0) parcalar.push(`${saat} sa`);
  if (dk > 0 || parcalar.length === 0) parcalar.push(`${dk} dk`);
  return parcalar.join(' ');
}

/** Saniyeyi MM:SS veya H:MM:SS olarak gösterir. */
export function SureFormat(saniye: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(saniye ?? 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

export function MsSureFormat(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '0:00';
  return SureFormat(Math.floor(ms / 1000));
}

/** Üretim hakkı — kullanıcıya dakika olarak. */
export function DakikaEtiket(saniye: number | null | undefined): string {
  const sn = Math.max(0, Math.floor(Number(saniye ?? 0)));
  const dk = Math.round(sn / 60);
  if (dk < 1 && sn > 0) return `${sn} sn`;
  return `${dk} dk`;
}

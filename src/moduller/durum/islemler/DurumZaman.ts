/** Göreli zaman — X tarzı kısa */
export function DurumZamanMetni(iso: string): string {
  try {
    const d = new Date(iso);
    const fark = Date.now() - d.getTime();
    if (fark < 60_000) return `${Math.max(1, Math.floor(fark / 1000))}sn`;
    if (fark < 3_600_000) return `${Math.floor(fark / 60_000)}dk`;
    if (fark < 86_400_000) return `${Math.floor(fark / 3_600_000)}sa`;
    if (fark < 7 * 86_400_000) return `${Math.floor(fark / 86_400_000)}g`;
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

export function DurumTarihSaat(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Aktif ses odası oturumu — profil ziyaretinde medya bağlantısını canlı tutar.
 * Normal çıkışta bitirilir; arka planda iken MedyaOdasiKes çağrılmaz.
 */

export type AktifSesOdasiDurum = {
  roomId: string;
  title: string;
  /** true: oda ekranı blur olsa bile LiveKit açık kalsın */
  arkaPlanda: boolean;
  micAcik: boolean;
  dinleyiciSayisi: number;
};

type Dinleyici = (durum: AktifSesOdasiDurum | null) => void;

let durum: AktifSesOdasiDurum | null = null;
const dinleyiciler = new Set<Dinleyici>();

function yayinla() {
  dinleyiciler.forEach((fn) => fn(durum));
}

export function AktifSesOdasiDurumunuAl(): AktifSesOdasiDurum | null {
  return durum;
}

export function AktifSesOdasiArkaPlandaMi(): boolean {
  return !!durum?.arkaPlanda;
}

export function AktifSesOdasiCanliMi(): boolean {
  return !!durum;
}

export function AktifSesOdasiDinle(fn: Dinleyici): () => void {
  dinleyiciler.add(fn);
  fn(durum);
  return () => {
    dinleyiciler.delete(fn);
  };
}

export function AktifSesOdasiBaslat(input: {
  roomId: string;
  title: string;
  micAcik?: boolean;
  dinleyiciSayisi?: number;
}): void {
  durum = {
    roomId: input.roomId,
    title: input.title,
    arkaPlanda: false,
    micAcik: input.micAcik ?? false,
    dinleyiciSayisi: input.dinleyiciSayisi ?? 0,
  };
  yayinla();
}

/** Profil vb. — oda ekranı blur olur ama ses devam eder */
export function AktifSesOdasiArkaPlanaAl(): void {
  if (!durum) return;
  durum = { ...durum, arkaPlanda: true };
  yayinla();
}

/** Oda ekranına dönünce */
export function AktifSesOdasiOneCikar(): void {
  if (!durum) return;
  durum = { ...durum, arkaPlanda: false };
  yayinla();
}

export function AktifSesOdasiGuncelle(patch: {
  title?: string;
  micAcik?: boolean;
  dinleyiciSayisi?: number;
}): void {
  if (!durum) return;
  durum = {
    ...durum,
    ...(patch.title != null ? { title: patch.title } : null),
    ...(patch.micAcik != null ? { micAcik: patch.micAcik } : null),
    ...(patch.dinleyiciSayisi != null
      ? { dinleyiciSayisi: patch.dinleyiciSayisi }
      : null),
  };
  yayinla();
}

/** Normal çıkış / oda kapandı — oturum state temizlenir (medya ayrı kesilir) */
export function AktifSesOdasiBitir(): void {
  if (!durum) return;
  durum = null;
  yayinla();
}

/**
 * Kayıt sırasında seçilen avatar — e-posta OTP sonrası yüklemek için
 * aynı uygulama oturumunda tutulur.
 */
import type { SecilenProfilMedya } from '../../kullanici-profili/islemler/ProfilMedyasiYukle';

let bekleyen: SecilenProfilMedya | null = null;

export function KayitBekleyenAvatarAyarla(medya: SecilenProfilMedya | null): void {
  bekleyen = medya;
}

export function KayitBekleyenAvatarAlVeTemizle(): SecilenProfilMedya | null {
  const m = bekleyen;
  bekleyen = null;
  return m;
}

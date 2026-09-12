type SesSeviyeDinleyici = (userId: string, level: number) => void;

/**
 * Active speaker / audio level izolasyonu.
 * Tum Voice Room ekranini re-render etmez — aboneler secici guncellenir.
 */
class KonusmaciSesSeviyesiImpl {
  private seviyeler = new Map<string, number>();
  private dinleyiciler = new Set<SesSeviyeDinleyici>();
  private timer: ReturnType<typeof setInterval> | null = null;

  dinle(fn: SesSeviyeDinleyici) {
    this.dinleyiciler.add(fn);
    return () => {
      this.dinleyiciler.delete(fn);
    };
  }

  seviyeGetir(userId: string) {
    return this.seviyeler.get(userId) ?? 0;
  }

  /** Mock: gelistirme / Expo Go */
  mockBaslat(aktifKonusmaciId: string | null) {
    this.mockDurdur();
    this.timer = setInterval(() => {
      if (!aktifKonusmaciId) return;
      const level = 0.35 + Math.random() * 0.55;
      this.seviyeler.set(aktifKonusmaciId, level);
      this.dinleyiciler.forEach((fn) => fn(aktifKonusmaciId, level));
    }, 220);
  }

  mockDurdur() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  seviyeYaz(userId: string, level: number) {
    this.seviyeler.set(userId, level);
    this.dinleyiciler.forEach((fn) => fn(userId, level));
  }
}

export const KonusmaciSesSeviyesi = new KonusmaciSesSeviyesiImpl();

type KullaniciDinleyici = (level: number) => void;
type GenelDinleyici = (userId: string, level: number) => void;

/** Düşük sesi de yakala — konuşan avatar net görünsün */
const ESIK = 0.05;
const MIN_DELTA = 0.04;

/**
 * Active speaker / audio level izolasyonu.
 * Ekrani re-render etmez — yalnizca ilgili avatar abonesi guncellenir.
 */
class KonusmaciSesSeviyesiImpl {
  private seviyeler = new Map<string, number>();
  private genel = new Set<GenelDinleyici>();
  private kullanici = new Map<string, Set<KullaniciDinleyici>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  dinle(fn: GenelDinleyici) {
    this.genel.add(fn);
    return () => {
      this.genel.delete(fn);
    };
  }

  dinleKullanici(userId: string, fn: KullaniciDinleyici) {
    let set = this.kullanici.get(userId);
    if (!set) {
      set = new Set();
      this.kullanici.set(userId, set);
    }
    set.add(fn);
    fn(this.seviyeler.get(userId) ?? 0);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.kullanici.delete(userId);
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
      const level = 0.55 + Math.random() * 0.35;
      this.aktifleriYaz([{ userId: aktifKonusmaciId, level }]);
    }, 600);
  }

  mockDurdur() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  seviyeYaz(userId: string, level: number) {
    this.aktifleriYaz([{ userId, level }]);
  }

  /** Konusmayanlari sifirlar — halka titremesin / acik kalmasin */
  aktifleriYaz(aktifler: { userId: string; level: number }[]) {
    const next = new Map<string, number>();
    for (const a of aktifler) {
      const ham = Math.min(1, Math.max(0, a.level));
      next.set(a.userId, ham < ESIK ? 0 : ham);
    }

    const degisen: [string, number][] = [];
    for (const [id, prev] of this.seviyeler) {
      if (!next.has(id) && prev > 0) {
        this.seviyeler.set(id, 0);
        degisen.push([id, 0]);
      }
    }
    for (const [id, lvl] of next) {
      const prev = this.seviyeler.get(id) ?? 0;
      if (Math.abs(prev - lvl) < MIN_DELTA && !(prev > 0 && lvl === 0)) continue;
      this.seviyeler.set(id, lvl);
      degisen.push([id, lvl]);
    }

    for (const [id, lvl] of degisen) {
      this.kullanici.get(id)?.forEach((fn) => fn(lvl));
      this.genel.forEach((fn) => fn(id, lvl));
    }
  }

  temizle() {
    const onceki = [...this.seviyeler.keys()];
    this.seviyeler.clear();
    for (const id of onceki) {
      this.kullanici.get(id)?.forEach((fn) => fn(0));
      this.genel.forEach((fn) => fn(id, 0));
    }
  }
}

export const KonusmaciSesSeviyesi = new KonusmaciSesSeviyesiImpl();

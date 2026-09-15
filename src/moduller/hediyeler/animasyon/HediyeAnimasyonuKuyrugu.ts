import { DusukCihazAnimasyonSiniri } from '../../performans/DusukCihazModuAktifMi';
import { KillSwitchAktifMi } from '../../ozellik-bayraklari/OzellikBayragiAktifMi';

export type HediyeAnimasyonIslemi = {
  id: string;
  giftId: string;
  emoji: string;
  name: string;
  senderName?: string | null;
  animationUrl?: string | null;
  animationType?: string | null;
  durationMs: number;
  fullScreen: boolean;
  soundUrl?: string | null;
  coinCost?: number;
  quantity?: number;
};

type Dinleyici = (
  aktif: HediyeAnimasyonIslemi | null,
  kuyrukBoyu: number,
  sonBes: HediyeAnimasyonIslemi[],
) => void;

/**
 * Gift animasyon kuyrugu — LiveKit / mic / chat UI thread'ini bloklamaz.
 */
class HediyeAnimasyonuKuyruguImpl {
  private kuyruk: HediyeAnimasyonIslemi[] = [];
  private aktif: HediyeAnimasyonIslemi | null = null;
  private sonBes: HediyeAnimasyonIslemi[] = [];
  private calisiyor = false;
  private dinleyiciler = new Set<Dinleyici>();

  dinle(fn: Dinleyici) {
    this.dinleyiciler.add(fn);
    fn(this.aktif, this.kuyruk.length, this.sonBes);
    return () => {
      this.dinleyiciler.delete(fn);
    };
  }

  kuyrukBoyu() {
    return this.kuyruk.length;
  }

  aktifVarMi() {
    return this.aktif != null;
  }

  private yayinla() {
    this.dinleyiciler.forEach((fn) =>
      fn(this.aktif, this.kuyruk.length, this.sonBes),
    );
  }

  ekle(islem: Omit<HediyeAnimasyonIslemi, 'id'> & { id?: string }) {
    if (KillSwitchAktifMi('kill_heavy_animations')) {
      return;
    }
    const sinir = DusukCihazAnimasyonSiniri();
    if (this.kuyruk.length >= sinir.maxKuyruk) {
      return;
    }
    const fullScreen = sinir.fullScreenIzinli ? !!islem.fullScreen : false;
    const item: HediyeAnimasyonIslemi = {
      ...islem,
      id: islem.id ?? `anim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      durationMs: Math.min(islem.durationMs || 2200, sinir.maxDurationMs),
      fullScreen,
    };
    this.kuyruk.push(item);
    this.sonBes = [item, ...this.sonBes].slice(0, 5);
    this.yayinla();
    void this.calistir();
  }

  private async calistir() {
    if (this.calisiyor) return;
    this.calisiyor = true;
    while (this.kuyruk.length > 0) {
      this.aktif = this.kuyruk.shift() ?? null;
      this.yayinla();
      const sinir = DusukCihazAnimasyonSiniri();
      const ms = Math.min(this.aktif?.durationMs ?? 2200, sinir.maxDurationMs);
      await new Promise((r) => setTimeout(r, ms));
      this.aktif = null;
      this.yayinla();
    }
    this.calisiyor = false;
  }

  temizle() {
    this.kuyruk = [];
    this.aktif = null;
    this.yayinla();
  }
}

export const HediyeAnimasyonuKuyrugu = new HediyeAnimasyonuKuyruguImpl();

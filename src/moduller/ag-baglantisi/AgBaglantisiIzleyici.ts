import * as Network from 'expo-network';
import type { AgBaglantiDurumu } from './okuma/AgBaglantiDurumunuGetir';
import { AgBaglantiDurumunuGetir } from './okuma/AgBaglantiDurumunuGetir';

type Dinleyici = (durum: AgBaglantiDurumu) => void;

/**
 * Ag degisimlerini dinler; gift/LiveKit/chat bu dosyaya yazilmaz.
 */
class AgBaglantisiIzleyiciImpl {
  private dinleyiciler = new Set<Dinleyici>();
  private abonelik: { remove: () => void } | null = null;
  private son: AgBaglantiDurumu | null = null;

  sonDurum() {
    return this.son;
  }

  async baslat() {
    this.son = await AgBaglantiDurumunuGetir();
    this.yayinla(this.son);
    if (this.abonelik) return;
    this.abonelik = Network.addNetworkStateListener((state) => {
      this.son = {
        bagli: !!state.isConnected,
        internetErisilebilir:
          typeof state.isInternetReachable === 'boolean'
            ? state.isInternetReachable
            : null,
        tip: String(state.type ?? 'UNKNOWN'),
        ucakModu: this.son?.ucakModu ?? null,
      };
      this.yayinla(this.son);
    });
  }

  durdur() {
    this.abonelik?.remove();
    this.abonelik = null;
  }

  dinle(fn: Dinleyici) {
    this.dinleyiciler.add(fn);
    if (this.son) fn(this.son);
    return () => this.dinleyiciler.delete(fn);
  }

  private yayinla(durum: AgBaglantiDurumu) {
    this.dinleyiciler.forEach((fn) => fn(durum));
  }
}

export const AgBaglantisiIzleyici = new AgBaglantisiIzleyiciImpl();

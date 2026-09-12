type BaglantiDurumu = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

type Dinleyici = (durum: BaglantiDurumu, detay?: string) => void;

/**
 * LiveKit baglanti izolasyonu.
 * Screen/LiveKit internal logic buraya; gift/PK/chat buraya yazilmaz.
 * Audio level degisimi tum ekrani re-render etmemeli — ayri ses modulu.
 */
class LiveKitBaglantiYoneticisiImpl {
  private durum: BaglantiDurumu = 'idle';
  private dinleyiciler = new Set<Dinleyici>();
  private mock = false;
  private roomName: string | null = null;

  durumGetir() {
    return this.durum;
  }

  mockMu() {
    return this.mock;
  }

  odaAdi() {
    return this.roomName;
  }

  dinle(fn: Dinleyici) {
    this.dinleyiciler.add(fn);
    return () => this.dinleyiciler.delete(fn);
  }

  private yayinla(detay?: string) {
    this.dinleyiciler.forEach((fn) => fn(this.durum, detay));
  }

  async baglan(input: {
    url: string;
    token: string;
    roomName: string;
    mock?: boolean;
  }): Promise<{ ok: boolean; hata?: string }> {
    this.durum = 'connecting';
    this.roomName = input.roomName;
    this.mock = !!input.mock;
    this.yayinla('connecting');

    if (input.mock || input.token.startsWith('mock.')) {
      await new Promise((r) => setTimeout(r, 250));
      this.durum = 'connected';
      this.mock = true;
      this.yayinla('mock-connected');
      return { ok: true };
    }

    try {
      // Native @livekit/react-native FAZ5.1 / dev-client ile baglanir.
      // Simdilik JS client opsiyonel dinamik import (web).
      const { Room } = await import('livekit-client');
      const room = new Room();
      await room.connect(input.url, input.token);
      this.durum = 'connected';
      this.yayinla('connected');
      return { ok: true };
    } catch (e) {
      this.durum = 'error';
      const hata = e instanceof Error ? e.message : 'baglanti hatasi';
      this.yayinla(hata);
      return { ok: false, hata };
    }
  }

  async baglantiyiKes() {
    this.durum = 'disconnected';
    this.roomName = null;
    this.yayinla('disconnected');
  }
}

export const LiveKitBaglantiYoneticisi = new LiveKitBaglantiYoneticisiImpl();

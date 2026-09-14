import {
  Room,
  RoomEvent,
  Track,
  type LocalVideoTrack,
  type Participant,
  type RemoteVideoTrack,
  type VideoTrack,
} from 'livekit-client';
import { KonusmaciSesSeviyesi } from '../ses/KonusmaciSesSeviyesi';
// Native kontrol — VideoViewAl ile aynı kaynak
import { LiveKitNativeVarMi } from '../bilesenler/LiveKitVideoViewAl';

type LiveKitNative = {
  AndroidAudioTypePresets: { communication: unknown };
  AudioSession: {
    configureAudio: (opts: unknown) => Promise<void>;
    startAudioSession: () => Promise<void>;
    stopAudioSession: () => Promise<void>;
    selectAudioOutput: (output: string) => Promise<void>;
    getAudioOutputs: () => Promise<string[]>;
  };
  registerGlobals: () => void;
};

let livekitNative: LiveKitNative | null | undefined;

function livekitNativeAl(): LiveKitNative | null {
  if (livekitNative !== undefined) return livekitNative;
  if (!LiveKitNativeVarMi()) {
    livekitNative = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    livekitNative = require('@livekit/react-native') as LiveKitNative;
    if (!livekitNative?.AudioSession || !livekitNative?.registerGlobals) {
      livekitNative = null;
    }
  } catch {
    livekitNative = null;
  }
  return livekitNative;
}

type BaglantiDurumu = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
type Dinleyici = (durum: BaglantiDurumu, detay?: string) => void;
type VideoDinleyici = (state: {
  localVideo: LocalVideoTrack | null;
  remoteVideo: RemoteVideoTrack | null;
  remoteIds: string[];
}) => void;

let globalsHazir = false;

function globalsKaydet() {
  if (globalsHazir) return;
  try {
    const native = livekitNativeAl();
    if (!native) return;
    native.registerGlobals();
    globalsHazir = true;
  } catch (e) {
    console.warn('[LiveKit] registerGlobals', e);
  }
}

/**
 * LiveKit baglanti izolasyonu — 1:1 gorusme, ses odasi, canli.
 * Gift / PK / chat buraya yazilmaz.
 */
class LiveKitBaglantiYoneticisiImpl {
  private durum: BaglantiDurumu = 'idle';
  private dinleyiciler = new Set<Dinleyici>();
  private videoDinleyiciler = new Set<VideoDinleyici>();
  private mock = false;
  private roomName: string | null = null;
  private room: Room | null = null;
  private audioSessionAcik = false;
  /** Sıralı baglan/kes — paralel çift join (DUPLICATE_IDENTITY) engeli */
  private islemKuyrugu: Promise<unknown> = Promise.resolve();
  private baglantiNesil = 0;

  private sirayaAl<T>(islem: () => Promise<T>): Promise<T> {
    const sonraki = this.islemKuyrugu.then(islem, islem);
    this.islemKuyrugu = sonraki.then(
      () => undefined,
      () => undefined,
    );
    return sonraki;
  }

  durumGetir() {
    return this.durum;
  }

  mockMu() {
    return this.mock;
  }

  odaAdi() {
    return this.roomName;
  }

  oda(): Room | null {
    return this.room;
  }

  dinle(fn: Dinleyici) {
    this.dinleyiciler.add(fn);
    return () => {
      this.dinleyiciler.delete(fn);
    };
  }

  videoDinle(fn: VideoDinleyici) {
    this.videoDinleyiciler.add(fn);
    fn(this.videoDurumu());
    return () => {
      this.videoDinleyiciler.delete(fn);
    };
  }

  private yayinla(detay?: string) {
    this.dinleyiciler.forEach((fn) => fn(this.durum, detay));
  }

  private videoDurumu() {
    return {
      localVideo: this.localVideoTrack(),
      remoteVideo: this.remoteVideoTrack(),
      remoteIds: this.remoteParticipantIds(),
    };
  }

  private yayinlaVideo() {
    const state = this.videoDurumu();
    this.videoDinleyiciler.forEach((fn) => fn(state));
  }

  localVideoTrack(): LocalVideoTrack | null {
    const pub = this.room?.localParticipant.getTrackPublication(Track.Source.Camera);
    const t = pub?.track;
    if (t && t.kind === 'video') return t as LocalVideoTrack;
    // Kaynak etiketi gecikebilir — herhangi bir yerel video
    for (const p of this.room?.localParticipant.trackPublications.values() ?? []) {
      if (p.kind === Track.Kind.Video && p.track) {
        return p.track as LocalVideoTrack;
      }
    }
    return null;
  }

  remoteVideoTrack(): RemoteVideoTrack | null {
    if (!this.room) return null;
    for (const p of this.room.remoteParticipants.values()) {
      const cam = p.getTrackPublication(Track.Source.Camera);
      if (cam?.track && cam.track.kind === 'video') {
        return cam.track as RemoteVideoTrack;
      }
      for (const pub of p.trackPublications.values()) {
        if (pub.kind === Track.Kind.Video && pub.track) {
          return pub.track as RemoteVideoTrack;
        }
      }
    }
    return null;
  }

  remoteParticipantIds(): string[] {
    if (!this.room) return [];
    return [...this.room.remoteParticipants.keys()];
  }

  ilkRemoteId(): string | null {
    return this.remoteParticipantIds()[0] ?? null;
  }

  async baglan(input: {
    url: string;
    token: string;
    roomName: string;
    mock?: boolean;
    asPublisher?: boolean;
    publishVideo?: boolean;
    /** true: aynı odaya yeniden bağlan (token/rol yükseltme) */
    zorla?: boolean;
  }): Promise<{ ok: boolean; hata?: string }> {
    return this.sirayaAl(() => this.baglanIc(input));
  }

  private async baglanIc(input: {
    url: string;
    token: string;
    roomName: string;
    mock?: boolean;
    asPublisher?: boolean;
    publishVideo?: boolean;
    zorla?: boolean;
  }): Promise<{ ok: boolean; hata?: string }> {
    const nesil = ++this.baglantiNesil;

    // Aynı oda zaten bağlıysa gereksiz disconnect/abort yok
    if (
      !input.zorla &&
      !input.mock &&
      !input.token.startsWith('mock.') &&
      this.durum === 'connected' &&
      this.roomName === input.roomName &&
      this.room?.state === 'connected'
    ) {
      try {
        if (input.asPublisher !== false) {
          await this.mikrofonGucluAc();
          if (input.publishVideo) {
            await this.kameraGucluAc();
          }
        }
      } catch (e) {
        console.warn('[LiveKit] yeniden yayın', e);
        return {
          ok: false,
          hata:
            e instanceof Error
              ? e.message
              : 'Mikrofon/kamera yeniden açılamadı',
        };
      }
      this.yayinlaVideo();
      return { ok: true };
    }

    await this.baglantiyiKesIc();
    if (nesil !== this.baglantiNesil) {
      return { ok: false, hata: 'Bağlantı iptal edildi' };
    }

    this.durum = 'connecting';
    this.roomName = input.roomName;
    this.mock = !!input.mock;
    this.yayinla('connecting');

    if (input.mock || input.token.startsWith('mock.')) {
      // Sessiz mock = "bağlı" ama ses/görüntü yok — görüşmede kabul etme
      this.durum = 'error';
      this.mock = true;
      this.yayinla('mock-rejected');
      return {
        ok: false,
        hata:
          'Canlı medya yok (mock). LiveKit yapılandırması veya native WebRTC build gerekli.',
      };
    }

    try {
      globalsKaydet();
      const native = livekitNativeAl();
      if (!native) {
        this.durum = 'error';
        this.mock = false;
        this.yayinla('native-missing');
        return {
          ok: false,
          hata:
            'WebRTC native modülü yok. Expo Go değil, LiveKit’li development/production build kullan.',
        };
      }

      await native.AudioSession.configureAudio({
        android: {
          preferredOutputList: ['speaker', 'bluetooth', 'headset', 'earpiece'],
          audioTypeOptions: native.AndroidAudioTypePresets.communication,
        },
        ios: { defaultOutput: 'speaker' },
      });
      await native.AudioSession.startAudioSession();
      this.audioSessionAcik = true;

      if (nesil !== this.baglantiNesil) {
        await this.baglantiyiKesIc();
        return { ok: false, hata: 'Bağlantı iptal edildi' };
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      this.room = room;

      const yenile = () => this.yayinlaVideo();

      room.on(RoomEvent.TrackSubscribed, yenile);
      room.on(RoomEvent.TrackUnsubscribed, yenile);
      room.on(RoomEvent.TrackPublished, yenile);
      room.on(RoomEvent.TrackMuted, yenile);
      room.on(RoomEvent.TrackUnmuted, yenile);
      room.on(RoomEvent.LocalTrackPublished, yenile);
      room.on(RoomEvent.LocalTrackUnpublished, yenile);
      room.on(RoomEvent.ParticipantConnected, () => {
        this.yayinla('remote-joined');
        yenile();
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        this.yayinla('remote-left');
        yenile();
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        for (const s of speakers) {
          KonusmaciSesSeviyesi.seviyeYaz(s.identity, s.audioLevel ?? 0.5);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        if (this.room === room) {
          this.durum = 'disconnected';
          this.yayinla('disconnected');
        }
      });

      await room.connect(input.url, input.token);

      if (nesil !== this.baglantiNesil) {
        await room.disconnect(true).catch(() => undefined);
        if (this.room === room) this.room = null;
        return { ok: false, hata: 'Bağlantı iptal edildi' };
      }

      if (input.asPublisher !== false) {
        const micOk = await this.mikrofonGucluAc();
        if (!micOk) {
          await room.disconnect(true).catch(() => undefined);
          if (this.room === room) this.room = null;
          this.durum = 'error';
          this.yayinla('mic-failed');
          return {
            ok: false,
            hata: 'Mikrofon yayınlanamadı. İzinleri kontrol et ve tekrar dene.',
          };
        }
        if (input.publishVideo) {
          await this.kameraGucluAc();
        }
      }

      this.durum = 'connected';
      this.mock = false;
      this.yayinla('connected');
      this.yayinlaVideo();
      setTimeout(() => {
        if (nesil === this.baglantiNesil) {
          void this.mikrofonGucluAc();
          this.yayinlaVideo();
        }
      }, 400);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Sadece gerçekten native/modul yok hataları — "null" tek başına yakalanmaz
      const nativeYok =
        /Expo Go|Native module not found|WebRTC native module|Cannot find module|registerGlobals is not a function/i.test(
          msg,
        );
      if (nativeYok) {
        this.durum = 'error';
        this.mock = false;
        this.yayinla('native-error:' + msg);
        return {
          ok: false,
          hata:
            'WebRTC/LiveKit native hatası. Yeni development build al (Expo Go yeterli değil).',
        };
      }
      const hata = /invalid api key|unauthorized|Could not fetch region/i.test(
        msg,
      )
        ? 'LiveKit API anahtari gecersiz — Cloud Keys yenile'
        : msg;
      this.durum = 'error';
      this.yayinla(hata);
      return { ok: false, hata };
    }
  }

  /** Mikrofonu aç + yayın doğrula (retry) */
  private async mikrofonGucluAc(): Promise<boolean> {
    const lp = this.room?.localParticipant;
    if (!lp) return false;
    for (let i = 0; i < 2; i++) {
      try {
        await lp.setMicrophoneEnabled(true);
        await new Promise((r) => setTimeout(r, 120));
        const pub = lp.getTrackPublication(Track.Source.Microphone);
        if (pub?.track && !pub.isMuted) return true;
        // Publication gecikmeli gelebilir
        if (pub && !pub.isMuted) return true;
      } catch (e) {
        console.warn('[LiveKit] mikrofon', e);
      }
      await new Promise((r) => setTimeout(r, 280));
    }
    try {
      await this.room!.localParticipant.setMicrophoneEnabled(true);
      return true;
    } catch {
      return false;
    }
  }

  private async kameraGucluAc(): Promise<void> {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    try {
      await lp.setCameraEnabled(true);
    } catch (camErr) {
      console.warn('[LiveKit] kamera açma', camErr);
      await new Promise((r) => setTimeout(r, 280));
      await lp.setCameraEnabled(true).catch(() => undefined);
    }
    this.yayinlaVideo();
  }

  muteLocalAudio(mute: boolean) {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    void (async () => {
      try {
        if (mute) {
          await lp.setMicrophoneEnabled(false);
        } else {
          await this.mikrofonGucluAc();
        }
      } catch (e) {
        console.warn('[LiveKit] muteLocalAudio', e);
      }
    })();
  }

  setLocalVideoEnabled(enabled: boolean) {
    void (async () => {
      try {
        if (enabled) await this.kameraGucluAc();
        else await this.room?.localParticipant.setCameraEnabled(false);
        this.yayinlaVideo();
      } catch (e) {
        console.warn('[LiveKit] setLocalVideoEnabled', e);
      }
    })();
  }

  async setSpeakerphone(on: boolean) {
    try {
      if (!this.audioSessionAcik) return;
      const AudioSession = livekitNativeAl()?.AudioSession;
      if (!AudioSession) return;
      if (on) {
        await AudioSession.selectAudioOutput('speaker').catch(async () => {
          await AudioSession.selectAudioOutput('force_speaker');
        });
      } else {
        const outputs = await AudioSession.getAudioOutputs();
        const hedef = outputs.includes('earpiece')
          ? 'earpiece'
          : outputs.includes('default')
            ? 'default'
            : outputs[0];
        if (hedef) await AudioSession.selectAudioOutput(hedef);
      }
    } catch {
      /* ignore */
    }
  }

  async baglantiyiKes() {
    this.baglantiNesil += 1;
    return this.sirayaAl(() => this.baglantiyiKesIc());
  }

  private async baglantiyiKesIc() {
    try {
      const room = this.room;
      this.room = null;
      if (room) {
        await room.disconnect(true);
      }
    } catch {
      /* ignore — AbortReason polyfill TypeError'ı da yutar */
    }
    if (this.audioSessionAcik) {
      try {
        await livekitNativeAl()?.AudioSession.stopAudioSession();
      } catch {
        /* ignore */
      }
      this.audioSessionAcik = false;
    }
    this.roomName = null;
    this.durum = 'disconnected';
    this.yayinlaVideo();
    this.yayinla('disconnected');
  }
}

export const LiveKitBaglantiYoneticisi = new LiveKitBaglantiYoneticisiImpl();

/** UI icin VideoView track tipi */
export type LiveKitVideoTrackRef = VideoTrack | null;

import { Platform } from 'react-native';
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
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
    setDefaultRemoteAudioTrackVolume: (volume: number) => Promise<void>;
    setAppleAudioConfiguration: (config: {
      audioCategory?: string;
      audioCategoryOptions?: string[];
      audioMode?: string;
    }) => Promise<void>;
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
        await this.hoparlorGucluAc();
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

      await this.sesOturumuHazirla(native);

      if (nesil !== this.baglantiNesil) {
        await this.baglantiyiKesIc();
        return { ok: false, hata: 'Bağlantı iptal edildi' };
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          voiceIsolation: true,
        },
      });
      this.room = room;

      const yenile = () => this.yayinlaVideo();

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          // Uzak ses geldiğinde hoparlörü doğrula
          void this.hoparlorGucluAc();
        }
        yenile();
      });
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

      await room.connect(input.url, input.token, {
        autoSubscribe: true,
      });

      if (nesil !== this.baglantiNesil) {
        await room.disconnect(true).catch(() => undefined);
        if (this.room === room) this.room = null;
        return { ok: false, hata: 'Bağlantı iptal edildi' };
      }

      await this.hoparlorGucluAc();

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
          void this.hoparlorGucluAc();
          this.yayinlaVideo();
        }
      }, 350);
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

  /** Android: iletişim oturumu. iOS: registerGlobals auto-manager + speaker. */
  private async sesOturumuHazirla(native: LiveKitNative): Promise<void> {
    await native.AudioSession.configureAudio({
      android: {
        preferredOutputList: ['speaker', 'bluetooth', 'headset', 'earpiece'],
        audioTypeOptions: native.AndroidAudioTypePresets.communication,
      },
      ios: { defaultOutput: 'speaker' },
    });

    await native.AudioSession.startAudioSession();
    this.audioSessionAcik = true;

    await native.AudioSession.setDefaultRemoteAudioTrackVolume(1).catch(
      () => undefined,
    );

    if (Platform.OS === 'ios') {
      // setupIOSAudioManagement ile çakışmasın diye yumuşak ayar;
      // playAndRecord + defaultToSpeaker uzak sesi hoparlöre verir.
      await native.AudioSession.setAppleAudioConfiguration({
        audioCategory: 'playAndRecord',
        audioCategoryOptions: [
          'defaultToSpeaker',
          'allowBluetooth',
          'allowBluetoothA2DP',
          'allowAirPlay',
        ],
        audioMode: 'videoChat',
      }).catch(() => undefined);
    }
  }

  private async hoparlorGucluAc(): Promise<void> {
    try {
      const AudioSession = livekitNativeAl()?.AudioSession;
      if (!AudioSession) return;
      if (!this.audioSessionAcik) {
        await AudioSession.startAudioSession().catch(() => undefined);
        this.audioSessionAcik = true;
      }
      if (Platform.OS === 'ios') {
        await AudioSession.selectAudioOutput('force_speaker').catch(async () => {
          await AudioSession.selectAudioOutput('speaker').catch(() => undefined);
        });
      } else {
        await AudioSession.selectAudioOutput('speaker').catch(async () => {
          await AudioSession.selectAudioOutput('force_speaker').catch(
            () => undefined,
          );
        });
      }
    } catch {
      /* ignore */
    }
  }

  /** Mikrofonu aç + yayın doğrula (retry + manuel publish yedegi) */
  private async mikrofonGucluAc(): Promise<boolean> {
    const lp = this.room?.localParticipant;
    if (!lp) return false;

    for (let i = 0; i < 3; i++) {
      try {
        await lp.setMicrophoneEnabled(true);
        await new Promise((r) => setTimeout(r, 140));
        const pub = lp.getTrackPublication(Track.Source.Microphone);
        if (pub?.isMuted) {
          await pub.unmute().catch(() => undefined);
        }
        if (pub?.track && !pub.isMuted) return true;
        if (pub && !pub.isMuted) return true;
      } catch (e) {
        console.warn('[LiveKit] mikrofon', e);
      }

      // setMicrophoneEnabled yetmezse track elle yayınla
      try {
        const mevcut = lp.getTrackPublication(Track.Source.Microphone);
        if (mevcut?.track) {
          await lp.unpublishTrack(mevcut.track).catch(() => undefined);
        }
        const track = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        await lp.publishTrack(track, { source: Track.Source.Microphone });
        await new Promise((r) => setTimeout(r, 100));
        const pub = lp.getTrackPublication(Track.Source.Microphone);
        if (pub?.track && !pub.isMuted) return true;
      } catch (e) {
        console.warn('[LiveKit] mikrofon publish', e);
      }
      await new Promise((r) => setTimeout(r, 220));
    }
    return false;
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
        const pub = lp.getTrackPublication(Track.Source.Microphone);
        if (mute) {
          // Track'i kapatmak yerine mute — ses oturumu bozulmasın
          if (pub) {
            await pub.mute();
          } else {
            await lp.setMicrophoneEnabled(false);
          }
        } else if (pub?.track) {
          await pub.unmute();
          if (pub.isMuted) await this.mikrofonGucluAc();
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
      if (on) {
        await this.hoparlorGucluAc();
        return;
      }
      const AudioSession = livekitNativeAl()?.AudioSession;
      if (!AudioSession) return;
      if (!this.audioSessionAcik) return;
      const outputs = await AudioSession.getAudioOutputs();
      const hedef = outputs.includes('earpiece')
        ? 'earpiece'
        : outputs.includes('default')
          ? 'default'
          : outputs[0];
      if (hedef) await AudioSession.selectAudioOutput(hedef);
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
      // iOS: registerGlobals/setupIOSAudioManagement oturumu yönetir —
      // agresif stop sonraki odada uzak sesi kırabilir. Android'de kapat.
      if (Platform.OS === 'android') {
        try {
          await livekitNativeAl()?.AudioSession.stopAudioSession();
        } catch {
          /* ignore */
        }
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

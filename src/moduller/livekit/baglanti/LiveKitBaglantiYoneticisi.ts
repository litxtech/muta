import { AppState, Platform } from 'react-native';
import {
  AudioPresets,
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalVideoTrack,
  type Participant,
  type RemoteAudioTrack,
  type RemoteVideoTrack,
  type VideoTrack,
} from 'livekit-client';
import { KonusmaciSesSeviyesi } from '../ses/KonusmaciSesSeviyesi';
// Native kontrol — VideoViewAl ile aynı kaynak
import { LiveKitNativeVarMi } from '../bilesenler/LiveKitVideoViewAl';
import {
  IosYankIptaliAc,
  LiveKitGlobalsKaydet,
} from '../polyfill/LiveKitGlobalsKaydet';

/** 1:1 görüşme — WhatsApp benzeri: düşük gecikme, az kasma */
const GORUSME_VIDEO = VideoPresets.h360;
const GORUSME_VIDEO_SIMULCAST = [VideoPresets.h180, VideoPresets.h360];

/**
 * Capture — sampleRate ZORLAMA (cihaz WebRTC'ye bırak).
 * Android'de sabit 48k bazı cihazlarda iOS'a sessiz / bozuk Opus üretir.
 * Mono + AEC zorunlu (stereo/yankı Android↔iOS kırar).
 */
const SES_ODA_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
} as const;

/**
 * Konuşma preset — mono, çapraz platform.
 * dtx:false → Android→iOS'ta kesik/sessiz Opus riskini azaltır.
 * stopMicTrackOnMute:true → mute'ta track durur, sessiz frame sızmaz.
 */
const SES_ODA_PUBLISH = {
  audioPreset: AudioPresets.speech,
  dtx: false,
  red: true,
  forceStereo: false,
  stopMicTrackOnMute: true,
} as const;

/**
 * Ses odası misafir + canlı izleyici — STREAM_MUSIC.
 * gainTransientMayDuck: Spotify/YouTube Music kesilmez, oda konuşması varken kısılır.
 * Exclusive `gain` + inCommunication müzik uygulamalarını durdurur.
 */
const ANDROID_SES_ODASI_MISAFIR = {
  manageAudioFocus: true,
  audioMode: 'normal' as const,
  audioFocusMode: 'gainTransientMayDuck' as const,
  audioStreamType: 'music' as const,
  audioAttributesUsageType: 'media' as const,
  audioAttributesContentType: 'speech' as const,
  forceHandleAudioRouting: true,
};

/**
 * Konuşmacı / host / 1:1 — voiceCommunication (Android→iOS şart).
 * Media tipi Android yayın → iPhone'da sık sessiz kalır.
 * Yalnız yayıncılarda; misafir ANDROID_SES_ODASI_MISAFIR kullanır.
 */
const ANDROID_ILETISIM_AUDIO = {
  manageAudioFocus: true,
  audioMode: 'inCommunication' as const,
  audioFocusMode: 'gain' as const,
  audioStreamType: 'voiceCall' as const,
  audioAttributesUsageType: 'voiceCommunication' as const,
  audioAttributesContentType: 'speech' as const,
  forceHandleAudioRouting: true,
};

/** Ses odası: hoparlör öncelikli */
const ANDROID_CIKIS_ONCELIK = [
  'speaker',
  'bluetooth',
  'headset',
  'earpiece',
] as const;

/**
 * Android dinleyici uzak track — WebRTC setVolume [0,10].
 * Yalnız mikrofonu kapalı dinlemede. Yayıncıda AEC bozulmasın diye yok.
 */
const ANDROID_UZAK_SES_MAX = 3.5;

type LiveKitNative = {
  AndroidAudioTypePresets: { communication: unknown; media: unknown };
  AudioSession: {
    configureAudio: (opts: unknown) => Promise<void>;
    startAudioSession: () => Promise<void>;
    stopAudioSession: () => Promise<void>;
    selectAudioOutput: (output: string) => Promise<void>;
    getAudioOutputs: () => Promise<string[]>;
    setDefaultRemoteAudioTrackVolume: (volume: number) => Promise<void>;
    setAppleAudioConfiguration?: (config: {
      audioCategory?: string;
      audioCategoryOptions?: string[];
      audioMode?: string;
    }) => Promise<void>;
  };
  registerGlobals: (opts?: { autoConfigureAudioSession?: boolean }) => void;
  setupIOSAudioManagement?: (preferSpeaker?: boolean) => () => void;
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

function globalsKaydet() {
  try {
    if (!LiveKitGlobalsKaydet()) {
      console.warn('[LiveKit] registerGlobals: native yok');
    }
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
  /** Son configure imzası — aynı profilde tekrar configure etme (Android↔iOS sessizlik) */
  private sonSesImza: string | null = null;
  /** Sıralı baglan/kes — paralel çift join (DUPLICATE_IDENTITY) engeli */
  private islemKuyrugu: Promise<unknown> = Promise.resolve();
  private baglantiNesil = 0;
  /** user = ön kamera, environment = arka */
  private kameraFacing: 'user' | 'environment' = 'user';
  private gorusmeModu = false;
  /** Ses odası (video yayını yok) — misafir duck, konuşmacı communication */
  private sesOdasiModu = false;
  private speakerTimer: ReturnType<typeof setTimeout> | null = null;
  private speakerBekleyen: Participant[] | null = null;
  /** Uzak ses hacmi 0..1 (kullanıcı tercihi) — reconnect ezmez */
  private uzakSesHacmi = 1;
  /** Bu oturumda yayın hakkı var mı (host/speaker). Dinleyici false. */
  private asPublisher = false;
  /** Uygulama mikrofonu açık istiyor mu — reconnect setTimeout mute'u ezmesin */
  private micIstenenAcik = false;

  /** Track'e yazılacak seviye (Android dinleyicide boost; yayıncıda AEC için 1×) */
  private uzakSesUygulanacak(): number {
    if (this.uzakSesHacmi <= 0) return 0;
    const tercih = Math.min(1, this.uzakSesHacmi);
    if (
      Platform.OS === 'android' &&
      !this.gorusmeModu &&
      !this.asPublisher
    ) {
      return tercih * ANDROID_UZAK_SES_MAX;
    }
    return tercih;
  }

  private sirayaAl<T>(islem: () => Promise<T>): Promise<T> {
    const sonraki = this.islemKuyrugu.then(islem, islem);
    this.islemKuyrugu = sonraki.then(
      () => undefined,
      () => undefined,
    );
    return sonraki;
  }

  /** Aynı oda bağlı veya LiveKit yeniden bağlanıyor — hard disconnect yasak */
  private odaAyniVeCanliMi(roomName: string): boolean {
    if (this.roomName !== roomName || !this.room) return false;
    const s = this.room.state;
    return (
      s === ConnectionState.Connected ||
      s === ConnectionState.Reconnecting ||
      s === ConnectionState.SignalReconnecting
    );
  }

  private async bagliOlanaKadarBekle(timeoutMs = 12_000): Promise<boolean> {
    const room = this.room;
    if (!room) return false;
    if (room.state === ConnectionState.Connected) return true;

    return new Promise((resolve) => {
      let bitti = false;
      const bitir = (ok: boolean) => {
        if (bitti) return;
        bitti = true;
        clearTimeout(timer);
        room.off(RoomEvent.ConnectionStateChanged, onChange);
        resolve(ok);
      };
      const onChange = (state: ConnectionState) => {
        if (state === ConnectionState.Connected) bitir(true);
        else if (state === ConnectionState.Disconnected) bitir(false);
      };
      const timer = setTimeout(
        () => bitir(room.state === ConnectionState.Connected),
        timeoutMs,
      );
      room.on(RoomEvent.ConnectionStateChanged, onChange);
    });
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

  yayinciMi() {
    return this.asPublisher && this.durum === 'connected';
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
    /** 1:1 görüşme — düşük çözünürlük / speech audio (donma yok) */
    gorusmeModu?: boolean;
    /** Ses odası (video yok) — herkes communication */
    sesOdasi?: boolean;
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
    gorusmeModu?: boolean;
    sesOdasi?: boolean;
    zorla?: boolean;
  }): Promise<{ ok: boolean; hata?: string }> {
    const nesil = ++this.baglantiNesil;
    this.gorusmeModu = !!input.gorusmeModu;
    this.sesOdasiModu = !!input.sesOdasi;
    if (input.publishVideo) this.kameraFacing = 'user';
    // undefined → false (dinleyici güvenli); sadece açık true yayıncı
    this.asPublisher = !!input.asPublisher;
    const ayniOdaCanli =
      !input.mock &&
      !input.token.startsWith('mock.') &&
      this.odaAyniVeCanliMi(input.roomName);
    // Soft reuse: mute tercihini ezme.
    // Ses odası: koltukta bile mic kapalı başlar (kullanıcı açar).
    // Görüşme/video: yayıncıda mic açık.
    if (!this.asPublisher) {
      this.micIstenenAcik = false;
    } else if (input.sesOdasi) {
      if (!ayniOdaCanli || input.zorla) {
        this.micIstenenAcik = false;
      }
    } else if (!ayniOdaCanli || input.zorla) {
      this.micIstenenAcik = true;
    }
    // Rol / mod değişince ses profilini yeniden kur
    this.sonSesImza = null;

    // Aynı oda bağlı / reconnecting iken disconnect etme — "leave while reconnect"
    // ve ICE/WS race üretir. Rol yükseltmede (zorla) önce reconnect bitsin.
    if (ayniOdaCanli) {
      if (input.zorla) {
        const hazir = await this.bagliOlanaKadarBekle();
        if (!hazir && nesil === this.baglantiNesil) {
          // Reconnect başarısız — aşağıda temiz bağlan
        } else if (nesil !== this.baglantiNesil) {
          return { ok: false, hata: 'Bağlantı iptal edildi' };
        } else {
          // Bağlıyken zorla yeniden join (token/rol)
        }
      } else {
        if (this.room?.state !== ConnectionState.Connected) {
          const hazir = await this.bagliOlanaKadarBekle();
          if (!hazir) {
            // Düşmüş — aşağıda yeniden bağlan
          } else if (nesil !== this.baglantiNesil) {
            return { ok: false, hata: 'Bağlantı iptal edildi' };
          } else {
            try {
              await this.mikrofonDurumunuDogrula();
              if (this.asPublisher && this.micIstenenAcik && input.publishVideo) {
                await this.kameraGucluAc();
              }
              await this.hoparlorGucluAc();
              this.uzakSesleriGucluAc();
            } catch (e) {
              console.warn('[LiveKit] yeniden yayın', e);
            }
            this.durum = 'connected';
            this.yayinlaVideo();
            return { ok: true };
          }
        } else {
          try {
            await this.mikrofonDurumunuDogrula();
            if (this.asPublisher && this.micIstenenAcik && input.publishVideo) {
              await this.kameraGucluAc();
            }
            await this.hoparlorGucluAc();
            this.uzakSesleriGucluAc();
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
          this.durum = 'connected';
          this.yayinlaVideo();
          return { ok: true };
        }
      }
    }

    await this.baglantiyiKesIc({ rolSifirla: false });
    if (nesil !== this.baglantiNesil) {
      return { ok: false, hata: 'Bağlantı iptal edildi' };
    }

    // baglantiyiKesIc odayı keser; rol bayrakları bu join için yeniden yazılır
    // (eski kod sıfırlıyordu → mic publish kapısı hiç açılmıyordu)
    this.gorusmeModu = !!input.gorusmeModu;
    this.sesOdasiModu = !!input.sesOdasi;
    this.asPublisher = !!input.asPublisher;
    // Ses odası konuşmacısı da sessiz girer — mic butonu ile açılır
    this.micIstenenAcik = this.asPublisher && !this.sesOdasiModu;

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

      const gorusme = !!input.gorusmeModu;
      const sesOdasi = !gorusme && !input.publishVideo;
      const room = new Room({
        adaptiveStream: sesOdasi ? false : { pixelDensity: 'screen' },
        dynacast: !sesOdasi,
        stopLocalTrackOnUnpublish: true,
        audioCaptureDefaults: {
          ...SES_ODA_CAPTURE,
        },
        videoCaptureDefaults: gorusme
          ? {
              facingMode: 'user',
              resolution: GORUSME_VIDEO.resolution,
            }
          : {
              facingMode: 'user',
              resolution: VideoPresets.h720.resolution,
            },
        publishDefaults: gorusme
          ? {
              ...SES_ODA_PUBLISH,
              simulcast: true,
              videoSimulcastLayers: GORUSME_VIDEO_SIMULCAST,
              videoEncoding: GORUSME_VIDEO.encoding,
              degradationPreference: 'maintain-framerate',
            }
          : SES_ODA_PUBLISH,
      });
      this.room = room;

      const yenile = () => this.yayinlaVideo();

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const kendi =
            !!participant?.identity &&
            participant.identity === room.localParticipant.identity;
          try {
            // Kendi track asla çalınmaz; uzaklar tercih hacminde
            (track as RemoteAudioTrack).setVolume(
              kendi ? 0 : this.uzakSesUygulanacak(),
            );
          } catch {
            /* ignore */
          }
          // iOS: Android track gelince hoparlör + oturumu tazeleyerek sessizliği kır
          if (Platform.OS === 'ios' && !kendi) {
            void this.hoparlorGucluAc().catch(() => undefined);
            this.uzakSesleriGucluAc();
            IosYankIptaliAc();
          }
        }
        yenile();
      });
      room.on(RoomEvent.TrackUnsubscribed, yenile);
      room.on(RoomEvent.TrackPublished, yenile);
      room.on(RoomEvent.TrackMuted, (pub, participant) => {
        if (pub.kind === Track.Kind.Audio && participant?.identity) {
          try {
            KonusmaciSesSeviyesi.seviyeYaz(participant.identity, 0);
          } catch {
            /* ignore */
          }
        }
        yenile();
      });
      room.on(RoomEvent.TrackUnmuted, yenile);
      room.on(RoomEvent.LocalTrackPublished, yenile);
      room.on(RoomEvent.LocalTrackUnpublished, yenile);
      room.on(RoomEvent.ParticipantConnected, (p) => {
        try {
          const kendi = p.identity === room.localParticipant.identity;
          p.setVolume(kendi ? 0 : Math.min(1, this.uzakSesUygulanacak()));
        } catch {
          /* ignore */
        }
        this.yayinla('remote-joined');
        yenile();
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        this.yayinla('remote-left');
        yenile();
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        this.konusmacilariKuyrugaAl(speakers);
      });
      room.on(RoomEvent.Disconnected, () => {
        if (this.room === room) {
          this.durum = 'disconnected';
          this.speakerGuvenliTemizle();
          try {
            this.yayinla('disconnected');
          } catch {
            /* ignore */
          }
        }
      });
      room.on(RoomEvent.Reconnecting, () => {
        if (this.room === room) this.yayinla('reconnecting');
      });
      room.on(RoomEvent.SignalReconnecting, () => {
        if (this.room === room) this.yayinla('signal-reconnecting');
      });
      room.on(RoomEvent.Reconnected, () => {
        if (this.room !== room) return;
        this.durum = 'connected';
        this.yayinla('reconnected');
        void this.hoparlorGucluAc().catch(() => undefined);
        this.uzakSesleriGucluAc();
        // Koltuk onayı yokken / mute iken mic'i zorla açma
        void this.mikrofonDurumunuDogrula().catch((e) => {
          console.warn('[LiveKit] reconnect mic', e);
        });
        this.yayinlaVideo();
      });

      await room.connect(input.url, input.token, {
        autoSubscribe: true,
        maxRetries: 5,
        peerConnectionTimeout: 20_000,
      });

      if (nesil !== this.baglantiNesil) {
        await this.odayiGuvenliKes(room);
        if (this.room === room) this.room = null;
        return { ok: false, hata: 'Bağlantı iptal edildi' };
      }

      // PC + native audio engine otursun — erken publish "engine not connected" üretir
      await this.motorHazirOlanaKadarBekle(nesil);

      await this.hoparlorGucluAc();
      this.uzakSesleriGucluAc();

      if (this.asPublisher && this.micIstenenAcik) {
        const micOk = await this.mikrofonGucluAc();
        if (!micOk) {
          // Bir kez daha dene — engine gecikmeli açılabiliyor
          await new Promise((r) => setTimeout(r, 500));
          if (nesil === this.baglantiNesil) {
            const tekrar = await this.mikrofonGucluAc();
            if (!tekrar) {
              await this.odayiGuvenliKes(room);
              if (this.room === room) this.room = null;
              this.durum = 'error';
              this.yayinla('mic-failed');
              return {
                ok: false,
                hata:
                  'Mikrofon yayınlanamadı. İzinleri kontrol et ve tekrar dene.',
              };
            }
          }
        }
        if (input.publishVideo) {
          const camOk = await this.kameraGucluAc();
          if (!camOk) {
            console.warn('[LiveKit] kamera yayınlanamadı — ses devam');
          }
        }
      } else {
        // Dinleyici veya mute: OS/capture sızmasın
        await this.mikrofonuGuvenliKapat();
      }

      // Join sonrası: hoparlör + uzak ses (tam configure TEKRAR etme)
      await this.hoparlorGucluAc();
      this.uzakSesleriGucluAc();
      if (Platform.OS === 'ios' && this.asPublisher) {
        IosYankIptaliAc();
      }

      this.durum = 'connected';
      this.mock = false;
      this.yayinla('connected');
      this.yayinlaVideo();
      setTimeout(() => {
        if (nesil !== this.baglantiNesil) return;
        if (this.room?.state !== ConnectionState.Connected) return;
        void this.mikrofonDurumunuDogrula();
        if (this.asPublisher && input.publishVideo) void this.kameraGucluAc();
        void this.hoparlorGucluAc();
        this.uzakSesleriGucluAc();
        this.yayinlaVideo();
      }, 700);
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

  /**
   * Ses oturumu — connect ÖNCESİ bir kez (aynı profilde tekrar YOK).
   * Konuşmacı / 1:1: exclusive communication (Android↔iOS Opus).
   * Ses odası misafir: media + duck — harici müzik devam eder.
   * iOS: setupIOSAudioManagement otomatik; manuel setApple YOK (sıfır sample bug).
   */
  private async sesOturumuHazirla(
    native: LiveKitNative,
    zorla = false,
  ): Promise<void> {
    // Misafir (dinleyici) exclusive focus almaz — Spotify vb. kesilmez
    const iletisim = this.gorusmeModu || this.asPublisher;
    const profil = iletisim ? 'com' : 'duck';
    const imza = `${Platform.OS}:${profil}:${this.asPublisher ? 1 : 0}`;
    if (!zorla && this.audioSessionAcik && this.sonSesImza === imza) {
      await native.AudioSession.startAudioSession().catch(() => undefined);
      return;
    }

    if (Platform.OS === 'android') {
      // Yayıncı: communication. Misafir: media + duck (müzik karışır).
      const androidOpts = iletisim
        ? {
            ...(native.AndroidAudioTypePresets.communication as object),
            ...ANDROID_ILETISIM_AUDIO,
          }
        : {
            ...(native.AndroidAudioTypePresets.media as object),
            ...ANDROID_SES_ODASI_MISAFIR,
          };

      await native.AudioSession.configureAudio({
        android: {
          preferredOutputList: [...ANDROID_CIKIS_ONCELIK],
          audioTypeOptions: androidOpts,
        },
        ios: { defaultOutput: 'speaker' },
      });
    } else if (Platform.OS === 'ios') {
      // Sadece hoparlör varsayılanı — kategori/mode'u engine + setupIOSAudioManagement yönetir
      await native.AudioSession.configureAudio({
        ios: { defaultOutput: 'speaker' },
      }).catch(() => undefined);
    }

    await native.AudioSession.startAudioSession();
    this.audioSessionAcik = true;
    this.sonSesImza = imza;

    const hedef = Math.min(1, Math.max(0, this.uzakSesHacmi));
    await native.AudioSession.setDefaultRemoteAudioTrackVolume(
      hedef > 0.02 ? hedef : 1,
    ).catch(() => undefined);
  }

  /**
   * Uzak ses hacmi (tek kaynak) — 0..1 kullanıcı tercihi.
   * 0 = sessiz; Android'de 1 → track boost (ANDROID_UZAK_SES_MAX).
   * Reconnect / TrackSubscribed bunu ezmez.
   */
  setRemoteAudioVolume(volume: number): void {
    const v = !Number.isFinite(volume)
      ? 1
      : Math.max(0, Math.min(1, volume));
    this.uzakSesHacmi = v;
    const nativeHedef = v > 0.02 ? v : 0;
    try {
      void livekitNativeAl()
        ?.AudioSession.setDefaultRemoteAudioTrackVolume(nativeHedef)
        .catch(() => undefined);
    } catch {
      /* ignore */
    }
    this.uzakSesleriGucluAc();
  }

  /** Mevcut uzak ses tercihine göre seviyeleri uygula — yerel kimlik her zaman 0 (kendi sesini duyma) */
  private uzakSesleriGucluAc(): void {
    const room = this.room;
    if (!room) return;
    const v = this.uzakSesUygulanacak();
    const yerelKimlik = room.localParticipant.identity;
    try {
      for (const p of room.remoteParticipants.values()) {
        // Kendi identity remote listesinde olmamalı; yine de savunma
        if (p.identity && p.identity === yerelKimlik) {
          try {
            p.setVolume(0);
          } catch {
            /* ignore */
          }
          continue;
        }
        try {
          p.setVolume(Math.min(1, v > 0 ? Math.max(v, 0.01) : 0));
        } catch {
          /* ignore */
        }
        for (const pub of p.trackPublications.values()) {
          if (pub.kind === Track.Kind.Audio && pub.track) {
            try {
              (pub.track as RemoteAudioTrack).setVolume(v);
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* ignore */
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
        // force_speaker → iletişim modunda earpiece'i ezer
        await AudioSession.selectAudioOutput('force_speaker').catch(async () => {
          await AudioSession.selectAudioOutput('speaker').catch(() => undefined);
        });
        if (this.asPublisher || this.gorusmeModu) {
          IosYankIptaliAc();
        }
        return;
      }
      // Android: communication mode earpiece'e düşebilir — hoparlörü iki kez kilitle
      const outputs = await AudioSession.getAudioOutputs().catch(
        () => [] as string[],
      );
      const hedef = outputs.includes('speaker') ? 'speaker' : 'speaker';
      await AudioSession.selectAudioOutput(hedef).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 150));
      await AudioSession.selectAudioOutput('speaker').catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  /** Mikrofonu aç + yayın doğrula (retry + manuel publish yedegi) */
  private async mikrofonGucluAc(opts?: {
    /** true: unpublish/republish yok — reconnect sonrası güvenli */
    yalnizcaEnable?: boolean;
  }): Promise<boolean> {
    const room = this.room;
    const lp = room?.localParticipant;
    if (!lp || !room) return false;
    if (
      room.state === ConnectionState.Reconnecting ||
      room.state === ConnectionState.SignalReconnecting
    ) {
      return false;
    }

    for (let i = 0; i < 5; i++) {
      if (room.state !== ConnectionState.Connected) return false;
      try {
        // Oturum yoksa aç; aktif görüşmede tekrar configure ETME
        if (i === 0 && !this.audioSessionAcik) {
          const native = livekitNativeAl();
          if (native) await this.sesOturumuHazirla(native).catch(() => undefined);
        }
        await lp.setMicrophoneEnabled(true, {
          ...SES_ODA_CAPTURE,
        });
        await new Promise((r) => setTimeout(r, 200));
        const pub = lp.getTrackPublication(Track.Source.Microphone);
        if (pub?.isMuted) {
          await pub.unmute().catch(() => undefined);
        }
        if (pub?.track && !pub.isMuted) {
          if (Platform.OS === 'ios') IosYankIptaliAc();
          if (Platform.OS === 'android' && (this.sesOdasiModu || this.gorusmeModu)) {
            // Mic açılınca Android bazen media'ya düşer — communication'a kilitle
            const native = livekitNativeAl();
            if (native) {
              await this.sesOturumuHazirla(native, true).catch(() => undefined);
              await this.hoparlorGucluAc().catch(() => undefined);
            }
          }
          return true;
        }
        if (pub && !pub.isMuted) {
          if (Platform.OS === 'ios') IosYankIptaliAc();
          return true;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[LiveKit] mikrofon', e);
        if (/engine\s*not\s*connected|not connected within timeout/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 350 + i * 150));
          continue;
        }
      }

      if (opts?.yalnizcaEnable) {
        await new Promise((r) => setTimeout(r, 220));
        continue;
      }

      // PC yeniyken unpublish "Sender does not belong" üretir — sadece Connected
      if (room.state !== ConnectionState.Connected) return false;
      try {
        const mevcut = lp.getTrackPublication(Track.Source.Microphone);
        if (mevcut?.track) {
          await lp.unpublishTrack(mevcut.track).catch(() => undefined);
        }
        if (room.state !== ConnectionState.Connected) return false;
        const track = await createLocalAudioTrack({
          ...SES_ODA_CAPTURE,
        });
        await lp.publishTrack(track, {
          source: Track.Source.Microphone,
          audioPreset: AudioPresets.speech,
          dtx: false,
          red: true,
        });
        await new Promise((r) => setTimeout(r, 140));
        const pub = lp.getTrackPublication(Track.Source.Microphone);
        if (pub?.track && !pub.isMuted) {
          if (Platform.OS === 'android' && (this.sesOdasiModu || this.gorusmeModu)) {
            const native = livekitNativeAl();
            if (native) {
              await this.sesOturumuHazirla(native, true).catch(() => undefined);
              await this.hoparlorGucluAc().catch(() => undefined);
            }
          }
          if (Platform.OS === 'ios') IosYankIptaliAc();
          return true;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[LiveKit] mikrofon publish', e);
        if (/engine\s*not\s*connected|not connected within timeout/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 350 + i * 150));
          continue;
        }
      }
      await new Promise((r) => setTimeout(r, 280));
    }
    return false;
  }

  /**
   * Connect sonrası native audio engine / PC'nin publish kabul etmesi için kısa bekleme.
   * Erken setMicrophoneEnabled → "engine not connected within timeout".
   */
  private async motorHazirOlanaKadarBekle(nesil: number): Promise<void> {
    const room = this.room;
    if (!room) return;
    const basla = Date.now();
    while (Date.now() - basla < 2500) {
      if (nesil !== this.baglantiNesil) return;
      if (room.state === ConnectionState.Connected) {
        await new Promise((r) => setTimeout(r, 280));
        if (nesil !== this.baglantiNesil) return;
        if (room.state === ConnectionState.Connected) return;
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  private videoCaptureOpts() {
    return {
      facingMode: this.kameraFacing,
      resolution: this.gorusmeModu
        ? GORUSME_VIDEO.resolution
        : VideoPresets.h720.resolution,
    };
  }

  /** Kamera aç + yayın doğrula (retry + manuel publish) */
  private async kameraGucluAc(): Promise<boolean> {
    const room = this.room;
    const lp = room?.localParticipant;
    if (!lp || !room) return false;
    if (
      room.state === ConnectionState.Reconnecting ||
      room.state === ConnectionState.SignalReconnecting
    ) {
      return false;
    }
    const opts = this.videoCaptureOpts();

    for (let i = 0; i < 3; i++) {
      if (room.state !== ConnectionState.Connected) return false;
      try {
        await lp.setCameraEnabled(true, opts);
        await new Promise((r) => setTimeout(r, 160));
        const pub = lp.getTrackPublication(Track.Source.Camera);
        if (pub?.isMuted) {
          await pub.unmute().catch(() => undefined);
        }
        if (pub?.track && !pub.isMuted) {
          this.yayinlaVideo();
          return true;
        }
      } catch (camErr) {
        console.warn('[LiveKit] kamera açma', camErr);
      }

      if (room.state !== ConnectionState.Connected) return false;
      try {
        const mevcut = lp.getTrackPublication(Track.Source.Camera);
        if (mevcut?.track) {
          await lp.unpublishTrack(mevcut.track).catch(() => undefined);
        }
        if (room.state !== ConnectionState.Connected) return false;
        const track = await createLocalVideoTrack(opts);
        await lp.publishTrack(track, { source: Track.Source.Camera });
        await new Promise((r) => setTimeout(r, 120));
        const pub = lp.getTrackPublication(Track.Source.Camera);
        if (pub?.track && !pub.isMuted) {
          this.yayinlaVideo();
          return true;
        }
      } catch (e) {
        console.warn('[LiveKit] kamera publish', e);
      }
      await new Promise((r) => setTimeout(r, 240));
    }
    this.yayinlaVideo();
    return false;
  }

  /** Ön ↔ arka kamera (WhatsApp flip) */
  async kameraCevir(): Promise<void> {
    this.kameraFacing =
      this.kameraFacing === 'user' ? 'environment' : 'user';
    const track = this.localVideoTrack();
    try {
      if (track) {
        await track.restartTrack(this.videoCaptureOpts());
      } else {
        await this.kameraGucluAc();
      }
    } catch (e) {
      console.warn('[LiveKit] kameraCevir', e);
      await this.kameraGucluAc().catch(() => undefined);
    }
    this.yayinlaVideo();
  }

  muteLocalAudio(mute: boolean) {
    // Yayıncı değilse açma isteklerini yok say — koltuk onayı öncesi ses sızmasın
    if (!mute && !this.asPublisher) {
      this.micIstenenAcik = false;
      void this.mikrofonuGuvenliKapat();
      return;
    }
    this.micIstenenAcik = !mute;
    const lp = this.room?.localParticipant;
    if (!lp) return;
    void (async () => {
      try {
        if (mute) {
          await this.mikrofonuGuvenliKapat();
          this.yerelKonusmaSeviyesiniSifirla();
          return;
        }
        const ok = await this.mikrofonGucluAc();
        if (!ok) {
          this.micIstenenAcik = false;
          await this.mikrofonuGuvenliKapat();
          return;
        }
        // Unmute sonrası hoparlör + AEC — kendi sesi dönmesin, uzaklar duyulsun
        await this.hoparlorGucluAc().catch(() => undefined);
        this.uzakSesleriGucluAc();
        if (Platform.OS === 'ios') IosYankIptaliAc();
      } catch (e) {
        console.warn('[LiveKit] muteLocalAudio', e);
      }
    })();
  }

  /** Reconnect / gecikmeli doğrulama — istenmeyen mic yayınını engeller */
  private async mikrofonDurumunuDogrula(): Promise<void> {
    if (!this.asPublisher || !this.micIstenenAcik) {
      await this.mikrofonuGuvenliKapat();
      this.yerelKonusmaSeviyesiniSifirla();
      return;
    }
    await this.mikrofonGucluAc({ yalnizcaEnable: true });
  }

  /** Dinleyici veya mute: capture + yayın tamamen kapalı */
  private async mikrofonuGuvenliKapat(): Promise<void> {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    try {
      // stopMicTrackOnMute:true → track durur, sessiz frame gitmez
      await lp.setMicrophoneEnabled(false).catch(() => undefined);
      const pub = lp.getTrackPublication(Track.Source.Microphone);
      if (pub && !pub.isMuted) {
        await pub.mute().catch(() => undefined);
      }
    } catch (e) {
      console.warn('[LiveKit] mikrofon kapat', e);
    }
  }

  private yerelKonusmaSeviyesiniSifirla() {
    const id = this.room?.localParticipant?.identity;
    if (id) {
      try {
        KonusmaciSesSeviyesi.seviyeYaz(id, 0);
      } catch {
        /* ignore */
      }
    }
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

  /**
   * Oyun SFX / arka plan sonrası LiveKit sesini yenile.
   * zorla: tam configure (oyun çıkışı). Soft: yalnız hoparlör + hacim.
   */
  async sesOturumunuYenile(zorla = false): Promise<void> {
    try {
      const room = this.room;
      if (!room || room.state !== ConnectionState.Connected) return;
      const native = livekitNativeAl();
      if (native && (zorla || !this.audioSessionAcik)) {
        await this.sesOturumuHazirla(native, zorla).catch(() => undefined);
      }
      await this.hoparlorGucluAc();
      this.uzakSesleriGucluAc();
      // Ses odasında iOS dinleyici de playAndRecord — VPIO açık kalsın
      if (Platform.OS === 'ios') {
        IosYankIptaliAc();
      }
      if (this.asPublisher && this.micIstenenAcik) {
        await this.mikrofonGucluAc({ yalnizcaEnable: true }).catch(() => undefined);
      } else if (!this.asPublisher || !this.micIstenenAcik) {
        await this.mikrofonuGuvenliKapat().catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Hoparlör + uzak hacim — soft. Tam configure için sesOturumunuYenile(true).
   */
  private async sesPipelineGucluAc(): Promise<void> {
    await this.hoparlorGucluAc();
    this.uzakSesleriGucluAc();
  }

  async baglantiyiKes() {
    this.baglantiNesil += 1;
    try {
      await this.sirayaAl(() => this.baglantiyiKesIc());
    } catch {
      /* caller'a unhandled rejection sızmasın */
    }
  }

  private konusmacilariKuyrugaAl(speakers: Participant[]) {
    this.speakerBekleyen = speakers;
    if (this.speakerTimer) return;
    this.speakerTimer = setTimeout(() => {
      this.speakerTimer = null;
      const list = this.speakerBekleyen ?? [];
      this.speakerBekleyen = null;
      try {
        // Mute'lu / mikrofonu kapalı yereli animasyona yazma
        const yerel = this.room?.localParticipant;
        const yerelMute =
          !!yerel &&
          (!this.micIstenenAcik ||
            !!yerel.getTrackPublication(Track.Source.Microphone)?.isMuted);
        KonusmaciSesSeviyesi.aktifleriYaz(
          list
            .filter((s) => {
              if (yerelMute && s.identity === yerel?.identity) return false;
              // Uzak mute track → animasyon yok
              try {
                const mic = s.getTrackPublication?.(Track.Source.Microphone);
                if (mic?.isMuted) return false;
              } catch {
                /* ignore */
              }
              return true;
            })
            .map((s) => ({
              userId: s.identity,
              level: s.audioLevel ?? 0,
            })),
        );
      } catch {
        /* ignore */
      }
    }, 90);
  }

  /** Fast Refresh singleton'da prototype method kaybolabiliyor — instance-safe */
  private speakerGuvenliTemizle() {
    try {
      if (this.speakerTimer) {
        clearTimeout(this.speakerTimer);
        this.speakerTimer = null;
      }
      this.speakerBekleyen = null;
      KonusmaciSesSeviyesi.temizle?.();
    } catch {
      /* ignore */
    }
  }

  private async odayiGuvenliKes(room: Room | null | undefined) {
    if (!room) return;
    const disconnect = room.disconnect;
    if (typeof disconnect !== 'function') return;
    try {
      // RN'de WS 1001 sonrası disconnect bazen asılı kalır — çıkışı bloklama
      await Promise.race([
        Promise.resolve(disconnect.call(room, true)),
        new Promise<void>((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      /* AbortReason / native race / beklenen WS close */
    }
  }

  private async baglantiyiKesIc(opts?: { rolSifirla?: boolean }) {
    const rolSifirla = opts?.rolSifirla !== false;
    try {
      const room = this.room;
      this.room = null;
      await this.odayiGuvenliKes(room);
    } catch {
      /* ignore */
    }
    try {
      if (this.audioSessionAcik) {
        // iOS: registerGlobals/setupIOSAudioManagement oturumu yönetir —
        // agresif stop sonraki odada uzak sesi kırabilir. Android'de kapat.
        if (Platform.OS === 'android') {
          try {
            await livekitNativeAl()?.AudioSession.stopAudioSession?.();
          } catch {
            /* ignore */
          }
        }
        this.audioSessionAcik = false;
      }
      this.roomName = null;
      this.sonSesImza = null;
      this.kameraFacing = 'user';
      // uzakSesHacmi korunur — tercih kullanıcı slider'ında; kesince 1'e çekme
      if (rolSifirla) {
        this.gorusmeModu = false;
        this.sesOdasiModu = false;
        this.asPublisher = false;
        this.micIstenenAcik = false;
      }
      this.durum = 'disconnected';
      this.speakerGuvenliTemizle();
      try {
        this.yayinlaVideo();
      } catch {
        /* ignore */
      }
      try {
        this.yayinla('disconnected');
      } catch {
        /* ignore */
      }
    } catch {
      this.durum = 'disconnected';
    }
  }
}

const globalKayit = globalThis as typeof globalThis & {
  __tamusoLiveKitYoneticisi?: LiveKitBaglantiYoneticisiImpl;
  __tamusoLiveKitAppState?: boolean;
};

export const LiveKitBaglantiYoneticisi =
  globalKayit.__tamusoLiveKitYoneticisi ??
  (globalKayit.__tamusoLiveKitYoneticisi =
    new LiveKitBaglantiYoneticisiImpl());

if (Platform.OS !== 'web' && !globalKayit.__tamusoLiveKitAppState) {
  globalKayit.__tamusoLiveKitAppState = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      // Soft yenile — tam configure arka plandan dönüşte yarış yaratır
      void LiveKitBaglantiYoneticisi.sesOturumunuYenile(false);
    }
  });
}

const hmr =
  typeof module !== 'undefined'
    ? (module as { hot?: { dispose: (cb: () => void) => void } }).hot
    : undefined;
hmr?.dispose(() => {
  void LiveKitBaglantiYoneticisi.baglantiyiKes();
});

/** UI icin VideoView track tipi */
export type LiveKitVideoTrackRef = VideoTrack | null;

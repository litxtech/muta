import { Platform } from 'react-native';
import { LiveKitNativeVarMi } from '../bilesenler/LiveKitVideoViewAl';

/**
 * Konuşmacı kayıt — VPIO / yankı iptali (kendi sesini duyma).
 * mixWithOthers: expo-audio SFX ile çakışmayı azaltır.
 * allowBluetooth: HFP (kendi AEC).
 */
const IOS_KAYIT_SECENEK = [
  'mixWithOthers',
  'allowBluetooth',
  'defaultToSpeaker',
] as const;

const IOS_MEDYA_SECENEK = [
  'mixWithOthers',
  'allowBluetooth',
  'allowBluetoothA2DP',
  'allowAirPlay',
  'defaultToSpeaker',
] as const;

/**
 * Ses odası duplex — playAndRecord + voiceChat.
 * Android→iOS: playout'ta `playback` kategorisi uzak Opus'u sessiz bırakır;
 * dinleyici dahil herkes playAndRecord kullanmalı.
 */
export const IOS_SES_ODA_AYAR = {
  audioCategory: 'playAndRecord' as const,
  audioCategoryOptions: [...IOS_KAYIT_SECENEK],
  audioMode: 'voiceChat' as const,
};

const IOS_KAYIT_VPIO_KAPALI = {
  audioCategory: 'playAndRecord' as const,
  audioCategoryOptions: [...IOS_MEDYA_SECENEK],
  audioMode: 'default' as const,
};

/**
 * Canlı izleyici (RTMP/yayın) — ses odası DIŞI.
 * Ses odasında kullanılmaz (Android uzak sesi boğar).
 */
const IOS_YAYIN_DINLEME = {
  audioCategory: 'playback' as const,
  audioCategoryOptions: ['mixWithOthers'] as const,
  audioMode: 'spokenAudio' as const,
};

let hazir = false;

type LiveKitNativeMod = {
  registerGlobals: (opts?: { autoConfigureAudioSession?: boolean }) => void;
  setupIOSAudioManagement?: (
    preferSpeaker?: boolean,
    policy?: {
      recording?: typeof IOS_SES_ODA_AYAR;
      recordingWithoutVoiceProcessing?: typeof IOS_KAYIT_VPIO_KAPALI;
      playout?: typeof IOS_SES_ODA_AYAR | typeof IOS_YAYIN_DINLEME;
      deactivateOnStop?: boolean;
    },
  ) => () => void;
};

/**
 * WebRTC globals + iOS ses motoru — uygulama açılışında bir kez.
 *
 * ÖNEMLİ: autoConfigureAudioSession:false + setupIOSAudioManagement.
 * İkisini birden açmak (true + setup) AVAudioSession yarışı → Android→iOS sessizlik.
 * Bağlantı sırasında manuel setAppleAudioConfiguration ÇAĞIRMA.
 */
export function LiveKitGlobalsKaydet(): boolean {
  if (hazir) return true;
  if (!LiveKitNativeVarMi()) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require('@livekit/react-native') as LiveKitNativeMod;
    if (typeof native.registerGlobals !== 'function') return false;

    // Custom policy kullanıyorsak autoConfigure KAPALI olmalı (LiveKit docs)
    native.registerGlobals({ autoConfigureAudioSession: false });

    if (Platform.OS === 'ios' && typeof native.setupIOSAudioManagement === 'function') {
      try {
        native.setupIOSAudioManagement(true, {
          recording: IOS_SES_ODA_AYAR,
          recordingWithoutVoiceProcessing: IOS_KAYIT_VPIO_KAPALI,
          // Ses odası: playout da playAndRecord — Android Opus için şart
          playout: IOS_SES_ODA_AYAR,
          deactivateOnStop: false,
        });
      } catch {
        try {
          native.setupIOSAudioManagement(true);
        } catch {
          /* eski native */
        }
      }
    }

    hazir = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * iOS Apple Voice Processing (AEC) açık tut — kendi sesini duyma engeli.
 * Bypass/kapalı VPIO hoparlörden kendi sesini geri verir.
 */
export function IosYankIptaliAc(): void {
  if (Platform.OS !== 'ios') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require('@livekit/react-native') as {
      AudioDeviceModule?: {
        isVoiceProcessingEnabled?: () => boolean;
        setVoiceProcessingEnabled?: (enabled: boolean) => Promise<void>;
        setVoiceProcessingBypassed?: (bypassed: boolean) => void;
      };
    };
    const adm = native.AudioDeviceModule;
    if (!adm) return;
    adm.setVoiceProcessingBypassed?.(false);
    if (
      typeof adm.isVoiceProcessingEnabled === 'function' &&
      typeof adm.setVoiceProcessingEnabled === 'function' &&
      !adm.isVoiceProcessingEnabled()
    ) {
      void adm.setVoiceProcessingEnabled(true).catch(() => undefined);
    }
  } catch {
    /* native yok / eski SDK */
  }
}

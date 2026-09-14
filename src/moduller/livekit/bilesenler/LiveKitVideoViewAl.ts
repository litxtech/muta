/**
 * LiveKit VideoView — native WebRTC yoksa null (Expo Go / eski dev client).
 * require yalnızca NativeModules hazırsa; aksi halde LogBox ERROR + layout crash.
 */

import type React from 'react';
import { NativeModules, Platform } from 'react-native';
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';

export type LiveKitVideoViewProps = {
  style?: object;
  videoTrack: LocalVideoTrack | RemoteVideoTrack;
  objectFit?: 'cover' | 'contain';
  mirror?: boolean;
  zOrder?: number;
};

export function LiveKitNativeVarMi(): boolean {
  if (Platform.OS === 'web') return false;
  const nm = NativeModules as Record<string, unknown>;
  return !!(
    nm.WebRTCModule ||
    nm.LiveKitReactNativeModule ||
    nm.WebRTCModuleOptions
  );
}

let cached: React.ComponentType<LiveKitVideoViewProps> | null | undefined;

/** Cache'i sıfırla — native geç yüklenirse yeniden dene */
export function LiveKitVideoViewCacheTemizle(): void {
  cached = undefined;
}

export function LiveKitVideoViewAl(): React.ComponentType<LiveKitVideoViewProps> | null {
  if (cached !== undefined) return cached;
  try {
    if (!LiveKitNativeVarMi()) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@livekit/react-native') as {
      VideoView?: React.ComponentType<LiveKitVideoViewProps>;
    };
    cached = mod.VideoView ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

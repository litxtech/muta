import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import { LiveKitBaglantiYoneticisi } from '../../livekit/baglanti/LiveKitBaglantiYoneticisi';
import { LiveKitVideoViewAl } from '../../livekit/bilesenler/LiveKitVideoViewAl';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  video: boolean;
  cameraOn: boolean;
  mock?: boolean;
  peerAvatar?: string | null;
  peerName?: string;
};

/**
 * Uzak + yerel video katmani (LiveKit VideoView).
 * Mock / sesli aramada avatar sahnesi.
 */
export function GorusmeVideoSahne({
  video,
  cameraOn,
  mock,
  peerAvatar,
  peerName,
}: Props) {
  const VideoViewComp = LiveKitVideoViewAl();
  const [localVideo, setLocalVideo] = useState<LocalVideoTrack | null>(null);
  const [remoteVideo, setRemoteVideo] = useState<RemoteVideoTrack | null>(null);
  const [remoteIds, setRemoteIds] = useState<string[]>([]);

  useEffect(() => {
    return LiveKitBaglantiYoneticisi.videoDinle((s) => {
      setLocalVideo(s.localVideo);
      setRemoteVideo(s.remoteVideo);
      setRemoteIds(s.remoteIds);
    });
  }, []);

  const harf = (peerName ?? '?').charAt(0).toLocaleUpperCase('tr-TR');
  const nativeOk = !mock && video && !!VideoViewComp;
  const hasRemote = !!remoteVideo;

  return (
    <View style={styles.root}>
      {nativeOk && hasRemote && VideoViewComp && remoteVideo ? (
        <VideoViewComp
          style={StyleSheet.absoluteFill}
          videoTrack={remoteVideo}
          objectFit="cover"
          zOrder={0}
        />
      ) : (
        <LinearGradient
          colors={['#0B1A14', '#122820', '#0A0810']}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.uzakBos}>
            {peerAvatar ? (
              <Image source={{ uri: peerAvatar }} style={styles.uzakAvatar} />
            ) : (
              <View style={styles.uzakAvatarBos}>
                <Text style={styles.harf}>{harf}</Text>
              </View>
            )}
            <Text style={styles.uzakHint}>
              {video
                ? remoteIds.length > 0
                  ? 'Kamera bağlanıyor…'
                  : mock
                    ? 'Demo görüntü'
                    : 'Karşı taraf bekleniyor…'
                : 'Sesli arama'}
            </Text>
          </View>
        </LinearGradient>
      )}

      {video ? (
        <View style={styles.pip}>
          {nativeOk && cameraOn && localVideo && VideoViewComp ? (
            <VideoViewComp
              style={StyleSheet.absoluteFill}
              videoTrack={localVideo}
              objectFit="cover"
              mirror
              zOrder={1}
            />
          ) : (
            <View style={styles.pipKapali}>
              <Text style={styles.pipYazi}>
                {cameraOn ? (mock ? 'Sen' : 'Kamera') : 'Kapalı'}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  uzakBos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  uzakAvatar: { width: 120, height: 120, borderRadius: 60 },
  uzakAvatarBos: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: { fontSize: 44, fontWeight: '800', color: RenkTokenlari.text },
  uzakHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  pip: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: '#111',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pipKapali: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1624',
  },
  pipYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
  },
});

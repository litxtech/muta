import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import { LiveKitBaglantiYoneticisi } from '../../livekit/baglanti/LiveKitBaglantiYoneticisi';
import { LiveKitVideoViewAl } from '../../livekit/bilesenler/LiveKitVideoViewAl';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  /** host: yerel kamera; izleyici: uzak yayinci */
  rol: 'host' | 'izleyici';
  mock?: boolean;
  durumYazi?: string;
};

/**
 * Canli yayin video sahnesi — LiveKit VideoView.
 * Memo: yorum/hediye state degisince video remount olmaz.
 */
export const CanliYayinVideoSahne = React.memo(function CanliYayinVideoSahne({
  rol,
  mock,
  durumYazi,
}: Props) {
  const VideoViewComp = LiveKitVideoViewAl();
  const [localVideo, setLocalVideo] = useState<LocalVideoTrack | null>(null);
  const [remoteVideo, setRemoteVideo] = useState<RemoteVideoTrack | null>(null);

  useEffect(() => {
    return LiveKitBaglantiYoneticisi.videoDinle((s) => {
      setLocalVideo(s.localVideo);
      setRemoteVideo(s.remoteVideo);
    });
  }, []);

  const track =
    rol === 'host'
      ? localVideo
      : remoteVideo ?? localVideo;
  const nativeOk = !mock && !!track && !!VideoViewComp;

  const baslik = mock
    ? 'Demo yayın'
    : track
      ? 'Görüntü bağlanıyor…'
      : 'Görüntü yok';
  const alt =
    durumYazi ||
    (mock
      ? 'Ses/görüntü simülasyonu — native build ile gerçek kamera açılır'
      : rol === 'host'
        ? 'Kamera henüz bağlanmadı'
        : 'Yayıncı görüntüsü bekleniyor');

  return (
    <View style={styles.root}>
      {nativeOk && VideoViewComp && track ? (
        <VideoViewComp
          style={StyleSheet.absoluteFill}
          videoTrack={track}
          objectFit="cover"
          mirror={rol === 'host'}
          zOrder={0}
        />
      ) : (
        <LinearGradient
          colors={['#241830', '#0E0A14', '#16121E']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.bos}>
            <View style={styles.ikonHalka}>
              <Ionicons
                name={mock ? 'videocam-outline' : 'videocam-off-outline'}
                size={36}
                color={RenkTokenlari.primarySoft}
              />
            </View>
            <Text style={styles.bosBaslik}>{baslik}</Text>
            <Text style={styles.bosAlt} numberOfLines={3}>
              {alt}
            </Text>
            {!mock && !track ? (
              <ActivityIndicator
                color={RenkTokenlari.primarySoft}
                style={styles.spinner}
              />
            ) : null}
          </View>
        </LinearGradient>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0A0810',
  },
  bos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  ikonHalka: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,64,145,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.32)',
    marginBottom: 4,
  },
  bosBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    textAlign: 'center',
  },
  bosAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  spinner: { marginTop: 8 },
});

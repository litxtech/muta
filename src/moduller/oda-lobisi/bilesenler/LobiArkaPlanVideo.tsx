/**
 * Lobi arka plan — gerçek insan videoları, sessiz döngü.
 * Sadece lobi girişinde; ses odasında kullanılmaz.
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { LOBI_AMBIENT_VIDEOLARI } from '../sabitler/LobiAmbientVideolari';

const KLIP_SURESI_MS = 28_000;
const { width: W, height: H } = Dimensions.get('window');

type Props = {
  aktif?: boolean;
};

export function LobiArkaPlanVideo({ aktif = true }: Props) {
  const [index, setIndex] = useState(0);
  const kaynak =
    LOBI_AMBIENT_VIDEOLARI[index % LOBI_AMBIENT_VIDEOLARI.length]?.kaynak ??
    LOBI_AMBIENT_VIDEOLARI[0].kaynak;

  // expo-video: require() doğrudan VideoSource olarak kullanılır
  const player = useVideoPlayer(kaynak, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        if (!aktif) {
          player.pause();
          return;
        }
        await player.replaceAsync(kaynak);
        if (iptal) return;
        player.muted = true;
        player.loop = true;
        player.play();
      } catch (e) {
        console.warn('[LobiArkaPlanVideo] play', e);
      }
    })();
    return () => {
      iptal = true;
    };
  }, [aktif, kaynak, player]);

  useEffect(() => {
    if (!aktif || LOBI_AMBIENT_VIDEOLARI.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % LOBI_AMBIENT_VIDEOLARI.length);
    }, KLIP_SURESI_MS);
    return () => clearInterval(t);
  }, [aktif]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <LinearGradient
        colors={[RenkTokenlari.deepPlum, RenkTokenlari.bg, '#0A0610']}
        style={styles.yedek}
      />
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        playsInline
        {...(Platform.OS === 'android' ? { surfaceType: 'textureView' as const } : null)}
      />
      {/* Hafif karartma — video görünsün, metin okunabilsin */}
      <LinearGradient
        colors={[
          'rgba(10,6,16,0.28)',
          'rgba(10,6,16,0.18)',
          'rgba(10,6,16,0.55)',
        ]}
        locations={[0, 0.45, 1]}
        style={styles.overlay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: W,
    height: H,
    zIndex: 0,
    overflow: 'hidden',
    backgroundColor: '#0A0610',
  },
  yedek: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: W,
    height: H,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

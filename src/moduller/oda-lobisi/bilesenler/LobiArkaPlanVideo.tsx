/**
 * Lobi arka plan — gerçek insan videoları, sessiz döngü.
 * Birkaç klip arasında dönüşür.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { LOBI_AMBIENT_VIDEOLARI } from '../sabitler/LobiAmbientVideolari';

const KLIP_SURESI_MS = 28_000;

type Props = {
  aktif?: boolean;
};

export function LobiArkaPlanVideo({ aktif = true }: Props) {
  const [index, setIndex] = useState(0);

  const kaynak = useMemo(
    () => LOBI_AMBIENT_VIDEOLARI[index % LOBI_AMBIENT_VIDEOLARI.length],
    [index],
  );

  const player = useVideoPlayer(kaynak.kaynak, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (!aktif) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      player.replace(kaynak.kaynak);
      player.muted = true;
      player.loop = true;
      player.play();
    } catch {
      /* yedek gradient görünür */
    }
  }, [aktif, kaynak.kaynak, player]);

  useEffect(() => {
    if (!aktif || LOBI_AMBIENT_VIDEOLARI.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % LOBI_AMBIENT_VIDEOLARI.length);
    }, KLIP_SURESI_MS);
    return () => clearInterval(t);
  }, [aktif]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          'rgba(18,16,24,0.35)',
          'rgba(18,16,24,0.55)',
          RenkTokenlari.bg,
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18,16,24,0.25)',
  },
});

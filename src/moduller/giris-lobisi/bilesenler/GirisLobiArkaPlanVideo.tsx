/**
 * Giriş lobisi arka plan videosu — mail/şifre yazılırken izlenir.
 * Native VideoView üstte kalmasın diye düşük elevation + textureView.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { GIRIS_AMBIENT_VIDEOLARI } from '../sabitler/GirisAmbientVideolari';

const KLIP_SURESI_MS = 28_000;
const { width: W, height: H } = Dimensions.get('window');

type Props = {
  aktif?: boolean;
};

export function GirisLobiArkaPlanVideo({ aktif = true }: Props) {
  const [index, setIndex] = useState(0);
  const aktifRef = useRef(aktif);
  aktifRef.current = aktif;
  const sonKaynak = useRef<unknown>(null);

  const kaynak =
    GIRIS_AMBIENT_VIDEOLARI[index % GIRIS_AMBIENT_VIDEOLARI.length]?.kaynak ??
    GIRIS_AMBIENT_VIDEOLARI[0].kaynak;

  const player = useVideoPlayer(kaynak, (p) => {
    p.loop = true;
    p.muted = true;
    if (aktifRef.current) p.play();
  });

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        if (sonKaynak.current === kaynak) {
          if (aktifRef.current) {
            player.muted = true;
            player.loop = true;
            player.play();
          }
          return;
        }
        await player.replaceAsync(kaynak);
        if (iptal) return;
        sonKaynak.current = kaynak;
        player.muted = true;
        player.loop = true;
        if (aktifRef.current) player.play();
      } catch (e) {
        console.warn('[GirisLobiArkaPlanVideo] play', e);
      }
    })();
    return () => {
      iptal = true;
    };
  }, [kaynak, player]);

  useEffect(() => {
    try {
      if (!aktif) {
        player.pause();
        return;
      }
      player.muted = true;
      player.loop = true;
      player.play();
    } catch (e) {
      console.warn('[GirisLobiArkaPlanVideo] aktif', e);
    }
  }, [aktif, player]);

  useEffect(() => {
    if (!aktif || GIRIS_AMBIENT_VIDEOLARI.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % GIRIS_AMBIENT_VIDEOLARI.length);
    }, KLIP_SURESI_MS);
    return () => clearInterval(t);
  }, [aktif]);

  return (
    <View style={styles.wrap} pointerEvents="none" collapsable={false}>
      <LinearGradient
        colors={[RenkTokenlari.deepPlum, RenkTokenlari.bg, '#0A0610']}
        style={styles.yedek}
        pointerEvents="none"
      />
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        playsInline
        pointerEvents="none"
        surfaceType="textureView"
      />
      <LinearGradient
        colors={[...RenkTokenlari.overlayGradient]}
        locations={[0, 0.4, 1]}
        style={styles.overlay}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    width: W,
    height: H,
    zIndex: 0,
    elevation: 0,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.bg,
  },
  yedek: {
    ...StyleSheet.absoluteFill,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: W,
    height: H,
    zIndex: 0,
    elevation: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
});

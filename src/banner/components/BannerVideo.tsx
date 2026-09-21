import React, { useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BANNER_BORDER_RADIUS } from '../core/BannerConstants';
import { BannerImage } from './BannerImage';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { MedyaUriGuvenli } from '../../moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';

type Props = {
  uri?: string | null;
  thumbnailUrl?: string | null;
  alt?: string | null;
  aspectRatio: number;
  autoplay?: boolean;
  loop?: boolean;
  isActive?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
};

/** Aynı anda tek aktif video — isActive false iken pause */
export function BannerVideo({
  uri,
  thumbnailUrl,
  alt,
  aspectRatio,
  autoplay = true,
  loop = true,
  isActive = true,
  onStart,
  onComplete,
}: Props) {
  const started = useRef(false);
  const safeUri = MedyaUriGuvenli(uri);
  const safeThumb = MedyaUriGuvenli(thumbnailUrl);

  const player = useVideoPlayer(safeUri, (p) => {
    p.loop = loop;
    p.muted = true;
    if (autoplay && isActive && safeUri) {
      p.play();
    }
  });

  useEffect(() => {
    if (!player || !safeUri) return;
    try {
      player.loop = loop;
      player.muted = true;
      if (isActive && autoplay) {
        player.play();
        if (!started.current) {
          started.current = true;
          onStart?.();
        }
      } else {
        player.pause();
      }
    } catch {
      /* */
    }
  }, [player, safeUri, isActive, autoplay, loop, onStart]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (!player) return;
      try {
        if (s !== 'active') player.pause();
        else if (isActive && autoplay) player.play();
      } catch {
        /* */
      }
    });
    return () => sub.remove();
  }, [player, isActive, autoplay]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('playToEnd', () => {
      onComplete?.();
    });
    return () => {
      try {
        sub.remove();
      } catch {
        /* */
      }
    };
  }, [player, onComplete]);

  if (!safeUri) {
    return (
      <BannerImage
        uri={safeThumb}
        alt={alt}
        aspectRatio={aspectRatio}
      />
    );
  }

  return (
    <View style={[styles.wrap, { aspectRatio }]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        accessibilityLabel={alt ?? 'Banner videosu'}
      />
      <LinearGradient
        colors={['transparent', 'rgba(18,16,24,0.75)']}
        style={styles.overlay}
        pointerEvents="none"
      />
      {!isActive && safeThumb ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BannerImage uri={safeThumb} alt={alt} aspectRatio={aspectRatio} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderTopLeftRadius: BANNER_BORDER_RADIUS,
    borderTopRightRadius: BANNER_BORDER_RADIUS,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.surface,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

import React, { useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ModulHataSiniri } from '../../../ortak/hata-sinirlari/ModulHataSiniri';

type Props = {
  uri: string | null | undefined;
  style?: StyleProp<ViewStyle>;
  /** FlatList görünürlük — false iken native player mount etme */
  aktif?: boolean;
};

function MedyaUriGecerliMi(uri: string | null | undefined): uri is string {
  return typeof uri === 'string' && /^https?:\/\//i.test(uri.trim());
}

/**
 * Paylaşılan video kartı. Image video URL açamaz; boş kare görünür.
 * Android'de surfaceView overflow:hidden içinde boş kalır → textureView.
 * Boş/geçersiz uri veya pasif hücrede player oluşturulmaz (feed crash + bellek).
 * file:// / content:// kabul edilmez — yalnızca https.
 */
export function DurumVideoOnizleme({ uri, style, aktif = true }: Props) {
  if (!aktif || !MedyaUriGecerliMi(uri)) {
    return <View style={[styles.wrap, style]} pointerEvents="none" />;
  }
  return (
    <ModulHataSiniri
      modulAdi="durum-video-onizleme"
      varyant="kart"
      yedek={<View style={[styles.wrap, style, styles.hata]} pointerEvents="none" />}
    >
      <DurumVideoOnizlemeIc uri={uri.trim()} style={style} />
    </ModulHataSiniri>
  );
}

function DurumVideoOnizlemeIc({
  uri,
  style,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    try {
      player.muted = true;
      player.loop = true;
      player.play();
    } catch {
      /* native player henüz hazır değilse yok say */
    }
    return () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [player, uri]);

  return (
    <View style={[styles.wrap, style]} pointerEvents="none" collapsable={false}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        playsInline
        pointerEvents="none"
        {...(Platform.OS === 'android'
          ? { surfaceType: 'textureView' as const }
          : null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
  },
  hata: {
    backgroundColor: '#1a1a22',
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
});

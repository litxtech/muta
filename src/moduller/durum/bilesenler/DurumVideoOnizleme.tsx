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
  /**
   * oynat: sessiz döngü (feed)
   * kare: ilk kareyi gösterip durdur (profil ızgarası — bellek dostu)
   */
  mod?: 'oynat' | 'kare';
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
export function DurumVideoOnizleme({
  uri,
  style,
  aktif = true,
  mod = 'oynat',
}: Props) {
  if (!aktif || !MedyaUriGecerliMi(uri)) {
    return <View style={[styles.wrap, style]} pointerEvents="none" />;
  }
  return (
    <ModulHataSiniri
      modulAdi="durum-video-onizleme"
      varyant="kart"
      yedek={<View style={[styles.wrap, style, styles.hata]} pointerEvents="none" />}
    >
      <DurumVideoOnizlemeIc uri={uri.trim()} style={style} mod={mod} />
    </ModulHataSiniri>
  );
}

function DurumVideoOnizlemeIc({
  uri,
  style,
  mod,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  mod: 'oynat' | 'kare';
}) {
  const kare = mod === 'kare';
  const player = useVideoPlayer(uri, (p) => {
    p.loop = !kare;
    p.muted = true;
    if (!kare) p.play();
  });

  useEffect(() => {
    try {
      player.muted = true;
      player.loop = !kare;
    } catch {
      /* native player henüz hazır değilse yok say */
    }

    if (!kare) {
      try {
        player.play();
      } catch {
        /* ignore */
      }
      return () => {
        try {
          player.pause();
        } catch {
          /* ignore */
        }
      };
    }

    let durdu = false;
    const kareyiSabitle = () => {
      if (durdu) return;
      try {
        if (player.currentTime < 0.05) player.currentTime = 0.08;
        player.pause();
        durdu = true;
      } catch {
        /* ignore */
      }
    };

    const statusSub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        try {
          player.play();
        } catch {
          /* ignore */
        }
        setTimeout(kareyiSabitle, 120);
      }
    });
    const playingSub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying) setTimeout(kareyiSabitle, 80);
    });

    try {
      if (player.status === 'readyToPlay') {
        player.play();
        setTimeout(kareyiSabitle, 120);
      }
    } catch {
      /* ignore */
    }

    return () => {
      durdu = true;
      try {
        statusSub.remove();
      } catch {
        /* ignore */
      }
      try {
        playingSub.remove();
      } catch {
        /* ignore */
      }
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [player, uri, kare]);

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

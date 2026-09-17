import React, { useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Paylaşılan video kartı. Image video URL açamaz; boş kare görünür.
 * Android'de surfaceView overflow:hidden içinde boş kalır → textureView.
 */
export function DurumVideoOnizleme({ uri, style }: Props) {
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
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
});

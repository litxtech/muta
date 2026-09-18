import React, { useEffect } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

type Props = {
  uri: string | null;
  tur: 'image' | 'video' | null;
  onKapat: () => void;
};

function MesajVideoOynatici({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    try {
      player.muted = false;
      player.loop = false;
      player.play();
    } catch {
      /* native henüz hazır değilse */
    }
    return () => {
      try {
        player.pause();
      } catch {
        /* */
      }
    };
  }, [player, uri]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
      allowsPictureInPicture={false}
      playsInline
      {...(Platform.OS === 'android'
        ? { surfaceType: 'textureView' as const }
        : null)}
    />
  );
}

/** DM resim / video — uygulama içi tam ekran */
export function MesajMedyaGoruntuleyici({ uri, tur, onKapat }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const acik = Boolean(uri && tur);

  return (
    <Modal
      visible={acik}
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
      onRequestClose={onKapat}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Pressable
          style={styles.backdrop}
          onPress={onKapat}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        />

        {uri && tur === 'image' ? (
          <Pressable style={styles.icerik} onPress={(e) => e.stopPropagation()}>
            <Image
              source={{ uri }}
              style={{ width, height: height - insets.top - insets.bottom }}
              resizeMode="contain"
              accessibilityLabel="Mesaj fotoğrafı"
            />
          </Pressable>
        ) : null}

        {uri && tur === 'video' ? (
          <View
            style={[
              styles.videoWrap,
              {
                width,
                height: Math.min(height * 0.72, width * 1.35),
                marginTop: insets.top + 48,
              },
            ]}
            pointerEvents="box-none"
          >
            <MesajVideoOynatici uri={uri} />
          </View>
        ) : null}

        <Pressable
          style={[styles.kapatBtn, { top: Math.max(12, insets.top + 8) }]}
          onPress={onKapat}
          hitSlop={12}
          accessibilityLabel="Kapat"
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        <Text style={[styles.ipucu, { bottom: Math.max(16, insets.bottom + 12) }]}>
          {tur === 'video' ? 'Kontrollerle oynat · boşluğa dokunarak kapat' : 'Boşluğa dokunarak kapat'}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  icerik: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWrap: {
    zIndex: 2,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  kapatBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ipucu: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 3,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

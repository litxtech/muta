/**
 * Uygulama içi mini görüşme baloncuğu — sürükle + kenara snap.
 * UI-thread (Reanimated + Gesture Handler); LiveKit session'a dokunmaz.
 * Video preview YOK — çift VideoView riski; avatar kullanılır.
 */

import React, { useCallback, useEffect } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { yuzenTabBarToplamYukseklik } from '../../../components/YuzenTabBosluk';
import {
  GorusmeOturumSunumAyarla,
  type GorusmeOturumDurum,
} from '../oturum/GorusmeOturumYoneticisi';
import { useCeviri } from '../../../i18n/useCeviri';

const BUBBLE = 56;
const EDGE_PAD = 10;
const TAP_SLOP = 8;

type Props = {
  oturum: GorusmeOturumDurum;
};

export function GorusmeMiniBaloncuk({ oturum }: Props) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const tabAlt = yuzenTabBarToplamYukseklik(insets.bottom);

  const minX = EDGE_PAD;
  const maxX = Math.max(minX, W - BUBBLE - EDGE_PAD);
  const minY = insets.top + EDGE_PAD;
  const maxY = Math.max(minY, H - BUBBLE - tabAlt - EDGE_PAD);

  const x = useSharedValue(maxX);
  const y = useSharedValue(Math.min(maxY, Math.max(minY, H * 0.28)));
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Ekran / klavye değişince sınır içinde tut
  useEffect(() => {
    const clamp = () => {
      x.value = Math.min(maxX, Math.max(minX, x.value));
      y.value = Math.min(maxY, Math.max(minY, y.value));
    };
    clamp();
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const kb = e.endCoordinates?.height ?? 0;
        const yeniMaxY = Math.max(minY, H - BUBBLE - kb - EDGE_PAD - 8);
        if (y.value > yeniMaxY) {
          y.value = withSpring(yeniMaxY, { damping: 18, stiffness: 220 });
        }
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        y.value = withSpring(
          Math.min(maxY, Math.max(minY, y.value)),
          { damping: 18, stiffness: 220 },
        );
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [H, W, maxX, maxY, minX, minY, x, y]);

  const fullscreenAc = useCallback(() => {
    GorusmeOturumSunumAyarla('fullscreen');
    router.push(`/gorusme/${oturum.callId}` as any);
  }, [oturum.callId]);

  const pan = Gesture.Pan()
    .minDistance(TAP_SLOP)
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      const nx = startX.value + e.translationX;
      const ny = startY.value + e.translationY;
      x.value = Math.min(maxX, Math.max(minX, nx));
      y.value = Math.min(maxY, Math.max(minY, ny));
    })
    .onEnd(() => {
      const mid = W / 2;
      const hedefX = x.value + BUBBLE / 2 < mid ? minX : maxX;
      x.value = withSpring(hedefX, { damping: 16, stiffness: 240 });
      y.value = withSpring(Math.min(maxY, Math.max(minY, y.value)), {
        damping: 16,
        stiffness: 240,
      });
    });

  const tap = Gesture.Tap()
    .maxDistance(TAP_SLOP)
    .onEnd(() => {
      runOnJS(fullscreenAc)();
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const ad =
    oturum.peer?.display_name?.trim() ||
    oturum.peer?.username?.trim() ||
    t('gorusme.gorusme');
  const harf = ad.charAt(0).toLocaleUpperCase('tr-TR');
  const avatar = MedyaUriGuvenli(oturum.peer?.avatar_url);
  const video = oturum.call.call_type === 'video';

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.bubbleWrap, animStyle]}>
          <View style={styles.ring}>
            <View style={styles.bubble}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarBos}>
                  <Text style={styles.harf}>{harf}</Text>
                </View>
              )}
              <View style={styles.badge}>
                <Ionicons
                  name={video ? 'videocam' : 'call'}
                  size={10}
                  color="#fff"
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 120,
    elevation: 120,
  },
  bubbleWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUBBLE,
    height: BUBBLE,
  },
  ring: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    padding: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(72, 220, 170, 0.85)',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  bubble: {
    flex: 1,
    borderRadius: (BUBBLE - 4) / 2,
    overflow: 'hidden',
    backgroundColor: '#1A1220',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarBos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
  },
  harf: {
    ...TipografiTokenlari.h2,
    color: '#fff',
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

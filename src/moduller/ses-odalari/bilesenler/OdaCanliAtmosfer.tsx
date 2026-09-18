import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

type Props = {
  yogunluk?: 'kapali' | 'hafif' | 'normal';
};

/**
 * Sesli oda sahnesi — sabit aura + yumuşak opacity nabız.
 * Scale yok: sahne titremesini önler.
 */
export function OdaCanliAtmosfer({ yogunluk = 'hafif' }: Props) {
  const nabiz = useSharedValue(0);

  useEffect(() => {
    if (yogunluk === 'kapali') {
      nabiz.value = 0;
      return;
    }
    nabiz.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [yogunluk, nabiz]);

  const auraStil = useAnimatedStyle(() => ({
    opacity: 0.045 + nabiz.value * (yogunluk === 'normal' ? 0.04 : 0.025),
  }));

  if (yogunluk === 'kapali') return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.aura, auraStil]}>
        <LinearGradient
          colors={[
            'rgba(196,59,255,0.28)',
            'rgba(240,180,41,0.12)',
            'transparent',
          ]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View
        style={[
          styles.halka,
          { borderColor: RenkTokenlari.accent, opacity: 0.035 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  aura: {
    position: 'absolute',
    alignSelf: 'center',
    top: '12%',
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: 'hidden',
  },
  halka: {
    position: 'absolute',
    alignSelf: 'center',
    top: '18%',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
  },
});

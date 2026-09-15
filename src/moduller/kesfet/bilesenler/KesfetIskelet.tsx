import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Keşfet — yükleme sırasında nabız atan iskelet ızgara */
export function KesfetIskelet() {
  const opaklik = useSharedValue(0.45);

  useEffect(() => {
    opaklik.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opaklik]);

  const stil = useAnimatedStyle(() => ({ opacity: opaklik.value }));

  return (
    <Animated.View style={[styles.wrap, stil]}>
      <View style={styles.hero} />
      <View style={styles.satir}>
        <View style={styles.kart} />
        <View style={styles.kart} />
      </View>
      <View style={styles.satir}>
        <View style={styles.kart} />
        <View style={styles.kart} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
  },
  hero: {
    height: 150,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
  },
  satir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.md,
  },
  kart: {
    flex: 1,
    height: 168,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
  },
});

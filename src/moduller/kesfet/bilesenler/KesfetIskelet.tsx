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

/** Keşfet — yükleme sırasında nabız atan iskelet */
export function KesfetIskelet() {
  const opaklik = useSharedValue(0.45);

  useEffect(() => {
    opaklik.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opaklik]);

  const stil = useAnimatedStyle(() => ({ opacity: opaklik.value }));

  return (
    <Animated.View style={[styles.wrap, stil]}>
      <View style={styles.portalSatir}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.portal} />
        ))}
      </View>
      <View style={styles.modSatir}>
        <View style={styles.mod} />
        <View style={styles.mod} />
      </View>
      <View style={styles.modSatir}>
        <View style={styles.mod} />
        <View style={styles.mod} />
      </View>
      <View style={styles.trend} />
      <View style={styles.hero} />
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
    paddingTop: BoslukTokenlari.xs,
  },
  portalSatir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.md,
  },
  portal: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: RenkTokenlari.bgCard,
  },
  modSatir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm + 2,
  },
  mod: {
    flex: 1,
    height: 96,
    borderRadius: YaricapTokenlari.md + 2,
    backgroundColor: RenkTokenlari.bgCard,
  },
  trend: {
    height: 128,
    borderRadius: YaricapTokenlari.md + 2,
    backgroundColor: RenkTokenlari.bgCard,
  },
  hero: {
    height: 160,
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

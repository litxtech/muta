import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

type LekeProps = {
  renk: string;
  boyut: number;
  ust?: number;
  sol?: number;
  sag?: number;
  alt?: number;
  delayMs?: number;
  sureMs?: number;
};

function AtmosferLeke({
  renk,
  boyut,
  ust,
  sol,
  sag,
  alt,
  delayMs = 0,
  sureMs = 5200,
}: LekeProps) {
  const nabiz = useSharedValue(0);
  const kayma = useSharedValue(0);

  useEffect(() => {
    nabiz.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: sureMs, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: sureMs, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    kayma.value = withDelay(
      delayMs + 200,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: sureMs + 800,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {
            duration: sureMs + 800,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, kayma, nabiz, sureMs]);

  const stil = useAnimatedStyle(() => ({
    opacity: 0.22 + nabiz.value * 0.28,
    transform: [
      { scale: 0.88 + nabiz.value * 0.28 },
      { translateY: (kayma.value - 0.5) * 18 },
      { translateX: (kayma.value - 0.5) * 12 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.leke,
        {
          width: boyut,
          height: boyut,
          borderRadius: boyut / 2,
          backgroundColor: renk,
          top: ust,
          left: sol,
          right: sag,
          bottom: alt,
        },
        stil,
      ]}
    />
  );
}

/** Ana sayfa ambient glow — premium gece sahnesi */
export function AnaSayfaAtmosfer() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <AtmosferLeke
        renk={RenkTokenlari.primary}
        boyut={220}
        ust={-40}
        sol={-70}
        delayMs={0}
        sureMs={4800}
      />
      <AtmosferLeke
        renk={RenkTokenlari.magenta}
        boyut={180}
        ust={120}
        sag={-60}
        delayMs={600}
        sureMs={5600}
      />
      <AtmosferLeke
        renk={RenkTokenlari.violet}
        boyut={160}
        alt={180}
        sol={40}
        delayMs={1100}
        sureMs={6200}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  leke: {
    position: 'absolute',
  },
});

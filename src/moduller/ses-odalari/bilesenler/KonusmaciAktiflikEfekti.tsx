import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { KonusmaciSesSeviyesi } from '../../livekit/ses/KonusmaciSesSeviyesi';

type Props = {
  userId: string | null;
  size?: number;
  children: React.ReactNode;
};

/** Ses seviyesine tepki veren modern çift halka + soft glow */
export function KonusmaciAktiflikEfekti({ userId, size = 72, children }: Props) {
  const level = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);

  useEffect(() => {
    if (!userId) {
      level.value = withTiming(0, { duration: 200 });
      return;
    }
    const unsub = KonusmaciSesSeviyesi.dinle((id, lvl) => {
      if (id === userId) {
        level.value = withTiming(Math.min(1, Math.max(0, lvl)), {
          duration: 80,
        });
      }
    });
    return () => {
      unsub();
    };
  }, [userId, level]);

  const halka1 = useAnimatedStyle(() => {
    const s = 1 + level.value * 0.22 + pulse.value * 0.03;
    return {
      opacity: 0.2 + level.value * 0.55,
      transform: [{ scale: s }],
      borderColor:
        level.value > 0.15 ? RenkTokenlari.mint : RenkTokenlari.primarySoft,
    };
  });

  const halka2 = useAnimatedStyle(() => {
    const s = 1 + level.value * 0.38 + pulse.value * 0.05;
    return {
      opacity: interpolate(level.value, [0, 0.2, 1], [0, 0.25, 0.5]),
      transform: [{ scale: s }],
    };
  });

  const glow = useAnimatedStyle(() => ({
    opacity: level.value * 0.35,
    transform: [{ scale: 1 + level.value * 0.2 }],
  }));

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {userId ? (
        <>
          <Animated.View
            style={[
              styles.glow,
              {
                width: size + 28,
                height: size + 28,
                borderRadius: (size + 28) / 2,
              },
              glow,
            ]}
          />
          <Animated.View
            style={[
              styles.halo,
              {
                width: size + 22,
                height: size + 22,
                borderRadius: (size + 22) / 2,
              },
              halka2,
            ]}
          />
          <Animated.View
            style={[
              styles.halo,
              {
                width: size + 12,
                height: size + 12,
                borderRadius: (size + 12) / 2,
              },
              halka1,
            ]}
          />
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: RenkTokenlari.primarySoft,
  },
  glow: {
    position: 'absolute',
    backgroundColor: RenkTokenlari.primary,
  },
});

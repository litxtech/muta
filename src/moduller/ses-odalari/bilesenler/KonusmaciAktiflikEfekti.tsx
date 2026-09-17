import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { KonusmaciSesSeviyesi } from '../../livekit/ses/KonusmaciSesSeviyesi';

type Props = {
  userId: string | null;
  size?: number;
  hostMu?: boolean;
  children: React.ReactNode;
};

const FADE = { duration: 160, easing: Easing.out(Easing.quad) };
const ESIK = 0.1;

/**
 * Konuşurken halka + hafif nabız; sustuğunda tamamen durur.
 */
export function KonusmaciAktiflikEfekti({
  userId,
  size = 72,
  hostMu = false,
  children,
}: Props) {
  const level = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!userId) {
      level.value = withTiming(0, FADE);
      cancelAnimation(pulse);
      pulse.value = withTiming(1, FADE);
      return;
    }
    level.value = KonusmaciSesSeviyesi.seviyeGetir(userId);
    return KonusmaciSesSeviyesi.dinleKullanici(userId, (lvl) => {
      const onceki = level.value;
      level.value = withTiming(lvl, FADE);
      if (lvl > ESIK && onceki <= ESIK) {
        pulse.value = withRepeat(
          withSequence(
            withTiming(1.08, { duration: 280, easing: Easing.out(Easing.quad) }),
            withTiming(1, { duration: 280, easing: Easing.in(Easing.quad) }),
          ),
          -1,
          false,
        );
      } else if (lvl <= ESIK && onceki > ESIK) {
        cancelAnimation(pulse);
        pulse.value = withTiming(1, FADE);
      }
    });
  }, [userId, level, pulse]);

  const halka = useAnimatedStyle(() => {
    const aktif = level.value > ESIK;
    return {
      opacity: aktif ? 0.4 + level.value * 0.55 : 0,
      transform: [
        {
          scale: aktif ? pulse.value * (1 + level.value * 0.04) : 1,
        },
      ],
    };
  });

  const glow = useAnimatedStyle(() => {
    const aktif = level.value > ESIK;
    return {
      opacity: aktif ? 0.12 + level.value * 0.28 : 0,
      transform: [{ scale: aktif ? pulse.value : 1 }],
    };
  });

  const halkaBoy = size + 12;
  const glowBoy = size + 22;

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
            pointerEvents="none"
            style={[
              styles.glow,
              {
                width: glowBoy,
                height: glowBoy,
                borderRadius: glowBoy / 2,
                backgroundColor: hostMu
                  ? RenkTokenlari.accent
                  : RenkTokenlari.mint,
              },
              glow,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                width: halkaBoy,
                height: halkaBoy,
                borderRadius: halkaBoy / 2,
                borderColor: hostMu
                  ? RenkTokenlari.accent
                  : RenkTokenlari.mint,
              },
              halka,
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
    borderWidth: 2.5,
  },
  glow: {
    position: 'absolute',
  },
});

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
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

const FADE = { duration: 200, easing: Easing.out(Easing.quad) };
/** Genişleyen dalga — yavaş, net görünür */
const DALGA = { duration: 1300, easing: Easing.out(Easing.cubic) };
const ACIK = 0.08;
const KAPALI = 0.04;
/** Halkanın avatardan taşması (clip olmasın diye wrap büyütülür) */
const TASMA = 26;

/**
 * Konuşurken avatar etrafında dalga halkaları.
 * Scale nabız yok — sahne titremesin; sadece opacity + dalga.
 */
export function KonusmaciAktiflikEfekti({
  userId,
  size = 72,
  hostMu = false,
  children,
}: Props) {
  const level = useSharedValue(0);
  const aktif = useSharedValue(0);
  const dalga1 = useSharedValue(0);
  const dalga2 = useSharedValue(0);

  useEffect(() => {
    let calisiyor = false;

    const durdur = () => {
      if (!calisiyor) {
        aktif.value = 0;
        return;
      }
      calisiyor = false;
      aktif.value = withTiming(0, FADE);
      cancelAnimation(dalga1);
      cancelAnimation(dalga2);
      dalga1.value = 0;
      dalga2.value = 0;
    };

    if (!userId) {
      level.value = 0;
      durdur();
      return;
    }

    const baslat = () => {
      if (calisiyor) return;
      calisiyor = true;
      aktif.value = withTiming(1, FADE);
      dalga1.value = 0;
      dalga2.value = 0;
      dalga1.value = withRepeat(withTiming(1, DALGA), -1, false);
      dalga2.value = withDelay(650, withRepeat(withTiming(1, DALGA), -1, false));
    };

    const baslangic = KonusmaciSesSeviyesi.seviyeGetir(userId);
    level.value = baslangic;
    if (baslangic > ACIK) baslat();
    else {
      aktif.value = 0;
      dalga1.value = 0;
      dalga2.value = 0;
    }

    return KonusmaciSesSeviyesi.dinleKullanici(userId, (lvl) => {
      level.value = withTiming(lvl, { duration: 180 });
      if (lvl > ACIK) baslat();
      else if (lvl <= KAPALI) durdur();
    });
  }, [userId, level, aktif, dalga1, dalga2]);

  const renk = hostMu ? RenkTokenlari.accent : RenkTokenlari.mint;
  const halkaBoy = size + 10;
  const wrapBoy = size + TASMA * 2;

  const glow = useAnimatedStyle(() => {
    const a = aktif.value;
    return {
      opacity: a * (0.22 + level.value * 0.28),
    };
  });

  const cember = useAnimatedStyle(() => {
    const a = aktif.value;
    const l = level.value;
    return {
      opacity: a * (0.7 + l * 0.25),
      borderWidth: 2.5,
    };
  });

  const dalgaStili1 = useAnimatedStyle(() => {
    const t = dalga1.value;
    return {
      opacity: aktif.value * (1 - t) * 0.75,
      transform: [{ scale: 1 + t * 0.45 }],
    };
  });

  const dalgaStili2 = useAnimatedStyle(() => {
    const t = dalga2.value;
    return {
      opacity: aktif.value * (1 - t) * 0.55,
      transform: [{ scale: 1 + t * 0.45 }],
    };
  });

  return (
    <View
      style={{
        width: wrapBoy,
        height: wrapBoy,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      {userId ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dalga,
              {
                width: halkaBoy,
                height: halkaBoy,
                borderRadius: halkaBoy / 2,
                borderColor: renk,
              },
              dalgaStili1,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dalga,
              {
                width: halkaBoy,
                height: halkaBoy,
                borderRadius: halkaBoy / 2,
                borderColor: renk,
              },
              dalgaStili2,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                width: size + 18,
                height: size + 18,
                borderRadius: (size + 18) / 2,
                backgroundColor: renk,
              },
              glow,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.cember,
              {
                width: halkaBoy,
                height: halkaBoy,
                borderRadius: halkaBoy / 2,
                borderColor: renk,
              },
              cember,
            ]}
          />
        </>
      ) : null}
      <View style={styles.icerik}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  dalga: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  cember: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
  },
  icerik: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

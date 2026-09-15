import React, { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AnaSayfaCanliNokta } from './AnaSayfaCanliNokta';
import { AnaSayfaSesCubuklari } from './AnaSayfaSesCubuklari';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  canliSayisi: number;
  solAksiyon?: ReactNode;
  sagAksiyon?: ReactNode;
};

/** Premium feed üst bar — marka + canlı nabız */
export function AnaSayfaFeedBasligi({
  canliSayisi,
  solAksiyon,
  sagAksiyon,
}: Props) {
  const parilti = useSharedValue(0.35);

  useEffect(() => {
    parilti.value = withRepeat(
      withSequence(
        withTiming(0.7, {
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0.3, {
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
  }, [parilti]);

  const rozetParilti = useAnimatedStyle(() => ({
    opacity: parilti.value,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(AnimasyonTokenlari.yavas + 40).springify().damping(18)}
      style={styles.wrap}
    >
      <View style={styles.sol}>
        {solAksiyon}
        <View style={styles.baslikBlok}>
          <Text style={styles.marka}>TAMUSO</Text>
          <View style={styles.canliSatir}>
            <AnaSayfaCanliNokta boyut={7} />
            <Text style={styles.baslik}>Canlı sahne</Text>
            <AnaSayfaSesCubuklari yukseklik={11} />
          </View>
          <Text style={styles.alt}>
            {canliSayisi > 0
              ? `${canliSayisi} ses odası · şimdi yayında`
              : 'Sahneyi aç · odaları gez'}
          </Text>
        </View>
      </View>
      {sagAksiyon ? (
        <View style={styles.sag}>
          {canliSayisi > 0 ? (
            <View style={styles.sayac}>
              <LinearGradient
                colors={['rgba(232,64,145,0.28)', 'rgba(196,59,255,0.14)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sayacIc}
              >
                <Animated.View style={[styles.sayacHalka, rozetParilti]} />
                <Text style={styles.sayacYazi}>{canliSayisi}</Text>
              </LinearGradient>
            </View>
          ) : null}
          {sagAksiyon}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
  },
  sol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    flex: 1,
    minWidth: 0,
  },
  baslikBlok: { flex: 1, minWidth: 0, gap: 2 },
  marka: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 2.4,
    fontSize: 10,
    fontWeight: '800',
  },
  canliSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  baslik: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  sag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  sayac: {
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.45)',
  },
  sayacIc: {
    minWidth: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sayacHalka: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.primarySoft,
  },
  sayacYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    zIndex: 1,
  },
});
